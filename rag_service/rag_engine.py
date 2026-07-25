import os
import io
import math
import logging
import requests
from typing import List, Dict, Any, Optional
import numpy as np
from pypdf import PdfReader
from google import genai
from google.genai import types

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rag_engine")

class RAGEngine:
    def __init__(self):
        self.provider = os.environ.get("LLM_PROVIDER", "").lower()
        self.ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
        self.ollama_model = os.environ.get("OLLAMA_MODEL", "gpt-oss")

        self.api_key = os.environ.get("GEMINI_API_KEY")
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None
            logger.info("GEMINI_API_KEY not set in environment.")

        # In-memory vector store structure:
        # { doc_id: [{ "id": str, "text": str, "page": int, "embedding": np.ndarray }] }
        self.vector_store: Dict[str, List[Dict[str, Any]]] = {}

    def extract_text(self, file_bytes: bytes, file_name: str) -> List[Dict[str, Any]]:
        """Extracts text page by page from PDF or raw file."""
        pages = []
        is_pdf = file_name.lower().endswith(".pdf") or file_bytes[:4] == b"%PDF"

        if is_pdf:
            try:
                reader = PdfReader(io.BytesIO(file_bytes))
                for idx, page in enumerate(reader.pages):
                    text = page.extract_text() or ""
                    if text.strip():
                        pages.append({"page": idx + 1, "text": text.strip()})
            except Exception as e:
                logger.error(f"Error parsing PDF with pypdf: {e}")
                # Fallback to UTF-8 decoding
                raw_text = file_bytes.decode("utf-8", errors="ignore")
                pages.append({"page": 1, "text": raw_text})
        else:
            raw_text = file_bytes.decode("utf-8", errors="ignore")
            pages.append({"page": 1, "text": raw_text})

        return pages

    def create_chunks(self, pages: List[Dict[str, Any]], chunk_size: int = 500, overlap: int = 100) -> List[Dict[str, Any]]:
        """Chunks page text with sliding window overlap and preserves metadata."""
        chunks = []
        chunk_counter = 0

        for page_data in pages:
            page_num = page_data["page"]
            text = page_data["text"]

            if len(text) <= chunk_size:
                chunk_counter += 1
                chunks.append({
                    "chunk_id": f"p{page_num}_c{chunk_counter}",
                    "page": page_num,
                    "text": text
                })
                continue

            start = 0
            while start < len(text):
                end = start + chunk_size
                chunk_text = text[start:end].strip()
                if chunk_text:
                    chunk_counter += 1
                    chunks.append({
                        "chunk_id": f"p{page_num}_c{chunk_counter}",
                        "page": page_num,
                        "text": chunk_text
                    })
                start += (chunk_size - overlap)

        return chunks

    def _get_embedding(self, text: str) -> np.ndarray:
        """Generates embedding vector using a Gemini embedding model or fallback vector.

        NOTE: The google-genai SDK routes embed_content() through batchEmbedContents.
        text-embedding-004 does NOT support batchEmbedContents in v1beta — use
        gemini-embedding-001 instead, which does.
        """
        EMBEDDING_MODELS = ["gemini-embedding-001", "gemini-embedding-2"]
        if self.client:
            for model_name in EMBEDDING_MODELS:
                try:
                    response = self.client.models.embed_content(
                        model=model_name,
                        contents=text
                    )
                    if hasattr(response, "embeddings") and response.embeddings and len(response.embeddings) > 0:
                        values = response.embeddings[0].values
                        if values:
                            vec = np.array(values, dtype=np.float32)
                            norm = np.linalg.norm(vec)
                            return vec / (norm + 1e-10)
                    elif hasattr(response, "embedding") and response.embedding and hasattr(response.embedding, "values") and response.embedding.values:
                        values = response.embedding.values
                        vec = np.array(values, dtype=np.float32)
                        norm = np.linalg.norm(vec)
                        return vec / (norm + 1e-10)
                    # model responded but returned no values — try next
                except Exception as e:
                    logger.warning(
                        f"Embedding failed with model '{model_name}': {e}. Trying next model."
                    )

        # Deterministic lightweight hash fallback vector (128 dims)
        vec = np.zeros(128, dtype=np.float32)
        words = text.lower().split()
        for w in words:
            idx = abs(hash(w)) % 128
            vec[idx] += 1.0
        norm = np.linalg.norm(vec)
        return vec / (norm + 1e-10)

    def index_document(self, doc_id: str, file_bytes: bytes, file_name: str) -> Dict[str, Any]:
        """Indexes a document into the vector store."""
        pages = self.extract_text(file_bytes, file_name)
        chunks = self.create_chunks(pages)

        indexed_chunks = []
        for c in chunks:
            emb = self._get_embedding(c["text"])
            indexed_chunks.append({
                "chunk_id": c["chunk_id"],
                "page": c["page"],
                "text": c["text"],
                "embedding": emb
            })

        self.vector_store[doc_id] = indexed_chunks
        logger.info(f"Indexed document '{doc_id}' with {len(indexed_chunks)} chunks across {len(pages)} pages.")

        return {
            "doc_id": doc_id,
            "total_pages": len(pages),
            "total_chunks": len(indexed_chunks),
            "status": "indexed"
        }

    def search_similar_chunks(self, doc_id: str, query: str, top_k: int = 4) -> List[Dict[str, Any]]:
        """Searches vector store for top_k most similar chunks using cosine similarity."""
        if doc_id not in self.vector_store or not self.vector_store[doc_id]:
            return []

        query_emb = self._get_embedding(query)
        chunks = self.vector_store[doc_id]

        results = []
        for c in chunks:
            sim = float(np.dot(query_emb, c["embedding"]))
            results.append((sim, c))

        results.sort(key=lambda x: x[0], reverse=True)
        top_results = results[:top_k]

        return [
            {
                "chunk_id": item[1]["chunk_id"],
                "page": item[1]["page"],
                "text": item[1]["text"],
                "similarity_score": round(item[0], 4)
            }
            for item in top_results
        ]

    def resolve_task_llm(self, task: str = "rag"):
        global_provider = os.environ.get("LLM_PROVIDER", "").lower()
        task_env_prefix = task.upper()
        task_provider = os.environ.get(f"{task_env_prefix}_LLM_PROVIDER", "").lower() or global_provider
        gemini_key = os.environ.get("GEMINI_API_KEY")
        ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")

        provider = "gemini"
        if task_provider == "ollama" or (not gemini_key and ollama_url):
            provider = "ollama"
        elif task_provider == "gemini":
            provider = "gemini"

        model = os.environ.get(f"{task_env_prefix}_MODEL")
        if not model:
            if provider == "gemini":
                model = "gemini-3.6-flash"
            else:
                model = os.environ.get("OLLAMA_MODEL", "gpt-oss")

        return provider, model, ollama_url, gemini_key

    def query(self, doc_id: str, question: str, top_k: int = 5) -> Dict[str, Any]:
        """Queries the vector index using the configured multi-LLM task router."""
        relevant_chunks = self.search_similar_chunks(doc_id, question, top_k=top_k)

        if not relevant_chunks:
            return {
                "answer": f"No indexed content found for document ID '{doc_id}'. Please ensure a financial document has been uploaded.",
                "sources": [],
                "doc_id": doc_id
            }

        context_str = "\n\n".join([
            f"--- [SOURCE CHUNK: Page {c['page']} (Relevance: {c['similarity_score']})] ---\n{c['text']}"
            for c in relevant_chunks
        ])

        system_prompt = (
            "You are Vantly's Financial Document Assistant. Your job is to answer user questions about "
            "financial statements using ONLY the provided document context snippets.\n"
            "STRICT RULES:\n"
            "1. Base your answer strictly on the provided context snippets.\n"
            "2. If the answer is not contained in the snippets, state clearly that it is not disclosed in the document.\n"
            "3. Cite page numbers where applicable (e.g., '[Page 2]').\n"
            "4. Be concise, precise, and professional."
        )

        user_prompt = f"Document Context:\n{context_str}\n\nQuestion: {question}"

        provider, model_name, ollama_url, gemini_key = self.resolve_task_llm("rag")
        logger.info(f"[Multi-LLM Router] Task: Vector RAG Q&A | Provider: {provider.upper()} | Model: {model_name}")

        answer = ""
        if provider == "ollama":
            try:
                logger.info(f"Querying local Ollama model '{model_name}' at {ollama_url}...")
                resp = requests.post(
                    f"{ollama_url}/api/generate",
                    json={
                        "model": model_name,
                        "system": system_prompt,
                        "prompt": user_prompt,
                        "stream": False,
                        "options": {"temperature": 0.2}
                    },
                    timeout=60
                )
                if resp.status_code == 200:
                    answer = resp.json().get("response", "")
            except Exception as e:
                logger.warning(f"Ollama query failed: {e}")

        if not answer and self.client:
            models_to_try = [model_name, "gemini-3.6-flash", "gemini-2.0-flash"]
            for m in models_to_try:
                for attempt in range(1, 4):
                    try:
                        response = self.client.models.generate_content(
                            model=m,
                            contents=user_prompt,
                            config=types.GenerateContentConfig(
                                system_instruction=system_prompt,
                                temperature=0.2
                            )
                        )
                        if response and response.text:
                            answer = response.text
                            break
                    except Exception as e:
                        logger.warning(f"RAG query error with model {m} (attempt {attempt}): {e}")
                        if attempt < 3:
                            import time
                            time.sleep(1.5 * attempt)
                if answer:
                    break

        if not answer:
            answer = "RAG context retrieved successfully:\n\n" + "\n".join([f"• Page {c['page']}: {c['text'][:150]}..." for c in relevant_chunks])

        return {
            "answer": answer,
            "sources": relevant_chunks,
            "doc_id": doc_id
        }

# Global singleton instance
rag_engine = RAGEngine()
