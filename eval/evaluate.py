#!/usr/bin/env python3
"""
Vantly RAG Evaluation Harness
==============================
Runs a real RAGAS evaluation (Faithfulness, Context Precision,
Context Recall, Answer Relevancy) against the Vantly Python RAG
microservice using a synthetic financial fixture document and a
hand-written, deterministic ground-truth QA set.

Methodology
-----------
  - Document: eval/fixtures/meridian_financials.txt  (uploaded as a
    plain-text file; the RAG engine falls back to UTF-8 decode for
    non-PDF files, so no PDF conversion library is required).
  - Ground truth: eval/ground_truth.yaml  (10 QA pairs, each with a
    precise reference answer verifiable against the fixture).
  - Runs: N=3 by default (configurable). Each run re-queries every
    question independently so we can report mean ± std dev.
  - RAGAS LLM: OpenAI gpt-4o-mini (via langchain-openai).
  - RAGAS embeddings: OpenAI text-embedding-3-small.

Usage
-----
  # From the project root:
  cd eval
  python -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  python evaluate.py --rag-url http://localhost:8000 --runs 3

  # Hit a Docker-hosted service on the same host:
  python evaluate.py --rag-url http://localhost:8000

  # Change number of runs or output path:
  python evaluate.py --runs 5 --output results/my_run.csv
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import httpx
import yaml
import pandas as pd
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table
from rich.progress import track

# ── RAGAS imports ─────────────────────────────────────────────────────────────
try:
    from ragas import evaluate, EvaluationDataset, SingleTurnSample
    from ragas.metrics.collections import Faithfulness, ContextPrecision, ContextRecall, AnswerRelevancy
    from ragas.llms import LangchainLLMWrapper
    from ragas.embeddings import LangchainEmbeddingsWrapper
except ImportError as e:
    print(f"[ERROR] Missing RAGAS dependency: {e}")
    print("  Install with:  pip install -r eval/requirements.txt")
    sys.exit(1)

try:
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
except ImportError:
    print("[ERROR] langchain-openai not installed. Run: pip install -r eval/requirements.txt")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────

console = Console()

EVAL_DIR = Path(__file__).parent
GROUND_TRUTH_PATH = EVAL_DIR / "ground_truth.yaml"
FIXTURE_PATH = EVAL_DIR / "fixtures" / "meridian_financials.txt"
DOC_ID = "eval_meridian_2024"

# Port 8000 is the Python RAG service — it is NOT exposed outside the Docker container.
# The Node.js server at :3000 proxies all RAG calls via /api/rag/*
# Use DEFAULT_RAG_URL=http://localhost:3000/api/rag when running against Docker.
# Use http://localhost:8000 only when the Python service is started locally without Docker.
DEFAULT_RAG_URL = "http://localhost:3000/api/rag"

# Load .env from project root (one level up from eval/)
load_dotenv(dotenv_path=EVAL_DIR.parent / ".env")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")


# ──────────────────────────────────────────────────────────────────────────────
# RAG Service Helpers
# ──────────────────────────────────────────────────────────────────────────────

def check_health(client: httpx.Client, rag_url: str) -> dict:
    """GET <rag_url>/health and return the response JSON. Raises on failure."""
    resp = client.get(f"{rag_url}/health", timeout=15.0)
    resp.raise_for_status()
    return resp.json()


def index_document(client: httpx.Client, rag_url: str, doc_id: str, file_path: Path) -> dict:
    """POST a fixture file to <rag_url>/index and return the response JSON."""
    file_bytes = file_path.read_bytes()
    file_name = file_path.name  # ends in .txt → RAG engine uses UTF-8 fallback

    resp = client.post(
        f"{rag_url}/index",
        data={"doc_id": doc_id},
        files={"file": (file_name, file_bytes, "text/plain")},
        timeout=120.0,
    )
    resp.raise_for_status()
    return resp.json()


def query_rag(
    client: httpx.Client,
    rag_url: str,
    doc_id: str,
    question: str,
    top_k: int = 5,
) -> tuple[str, list[str]]:
    """
    POST to <rag_url>/query. Returns (answer_text, list_of_context_strings).
    The list of contexts maps directly to RAGAS `retrieved_contexts`.
    """
    payload = {"doc_id": doc_id, "question": question, "top_k": top_k}
    resp = client.post(f"{rag_url}/query", json=payload, timeout=90.0)
    resp.raise_for_status()
    data = resp.json()

    answer: str = data.get("answer", "")
    # Each source chunk is a dict with keys: chunk_id, page, text, similarity_score
    contexts: list[str] = [src["text"] for src in data.get("sources", [])]
    return answer, contexts


# ──────────────────────────────────────────────────────────────────────────────
# RAGAS Configuration
# ──────────────────────────────────────────────────────────────────────────────

def build_ragas_evaluator():
    """
    Wraps OpenAI models in RAGAS LLM/Embedding wrappers.
    Uses gpt-4o-mini as the judge LLM (cheap, fast, no free-tier daily cap)
    and text-embedding-3-small for answer relevancy embeddings.

    NOTE: The Vantly app uses local Ollama for RAG queries.
    Only the RAGAS scoring judge uses OpenAI to ensure
    reliable evaluation scoring.
    """
    if not OPENAI_API_KEY:
        console.print(
            "[bold red]ERROR:[/bold red] OPENAI_API_KEY not set. "
            "Add it to .env in the project root."
        )
        sys.exit(1)

    llm = LangchainLLMWrapper(
        ChatOpenAI(
            model="gpt-4o-mini",
            openai_api_key=OPENAI_API_KEY,
            temperature=0.0,  # deterministic scoring
        )
    )
    embeddings = LangchainEmbeddingsWrapper(
        OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=OPENAI_API_KEY,
        )
    )

    metrics = [
        Faithfulness(llm=llm),
        ContextPrecision(llm=llm),
        ContextRecall(llm=llm),
        AnswerRelevancy(llm=llm, embeddings=embeddings),
    ]
    metric_names = [
        "faithfulness",
        "context_precision",
        "context_recall",
        "answer_relevancy",
    ]
    return metrics, metric_names


# ──────────────────────────────────────────────────────────────────────────────
# Main Evaluation
# ──────────────────────────────────────────────────────────────────────────────

def run_evaluation(args: argparse.Namespace) -> None:
    rag_url = args.rag_url.rstrip("/")
    n_runs: int = args.runs
    output_path = Path(args.output)
    top_k: int = args.top_k

    ground_truth_path = Path(args.ground_truth) if getattr(args, "ground_truth", None) else GROUND_TRUTH_PATH
    fixture_path = Path(args.fixture) if getattr(args, "fixture", None) else FIXTURE_PATH
    doc_id = args.doc_id if getattr(args, "doc_id", None) else DOC_ID

    console.rule("[bold blue]Vantly RAG Evaluation Harness[/bold blue]")
    console.print(f"  RAG service : [cyan]{rag_url}[/cyan]")
    console.print(f"  Runs        : [cyan]{n_runs}[/cyan]")
    console.print(f"  top_k       : [cyan]{top_k}[/cyan]")
    console.print(f"  Output      : [cyan]{output_path}[/cyan]")
    console.print()

    # ── 1. Load ground truth ──────────────────────────────────────────────────
    if not ground_truth_path.exists():
        console.print(f"[red]Ground truth file not found: {ground_truth_path}[/red]")
        sys.exit(1)

    with open(ground_truth_path) as f:
        ground_truth: list[dict] = yaml.safe_load(f)

    console.print(f"[green]✓[/green] Loaded [bold]{len(ground_truth)}[/bold] QA pairs from {ground_truth_path.name}")

    # ── 2. Verify fixture exists ──────────────────────────────────────────────
    if not fixture_path.exists():
        console.print(f"[red]Fixture file not found: {fixture_path}[/red]")
        sys.exit(1)

    fixture_size = fixture_path.stat().st_size
    console.print(f"[green]✓[/green] Fixture document: {fixture_path.name} ({fixture_size:,} bytes)")

    with httpx.Client() as http:
        # ── 3. Health check ───────────────────────────────────────────────────
        console.print("\n[bold]Checking RAG service health...[/bold]")
        try:
            health = check_health(http, rag_url)
        except (httpx.ConnectError, httpx.ConnectTimeout) as e:
            console.print(f"[red]✗ Cannot reach RAG service at {rag_url}[/red]")
            console.print(f"  Make sure the Docker stack is running:  docker-compose up")
            console.print(f"  Or start the service locally:  cd rag_service && python main.py")
            sys.exit(1)
        except httpx.HTTPStatusError as e:
            console.print(f"[red]✗ RAG service returned HTTP {e.response.status_code}[/red]")
            sys.exit(1)

        ollama_model = health.get("ollama_model", "qwen2.5:7b")
        docs_indexed = health.get("indexed_documents_count", 0)
        console.print(
            f"[green]✓[/green] Service healthy | LLM: Ollama ({ollama_model}) | "
            f"Docs already indexed: [cyan]{docs_indexed}[/cyan]"
        )

        # ── 4. Index the fixture document ─────────────────────────────────────
        console.print(f"\n[bold]Indexing fixture document (doc_id={doc_id})...[/bold]")
        try:
            index_result = index_document(http, rag_url, doc_id, fixture_path)
        except httpx.HTTPStatusError as e:
            console.print(f"[red]✗ /index returned HTTP {e.response.status_code}: {e.response.text}[/red]")
            sys.exit(1)

        console.print(
            f"[green]✓[/green] Indexed [bold]{index_result.get('total_chunks', '?')}[/bold] chunks "
            f"across [bold]{index_result.get('total_pages', '?')}[/bold] pages"
        )

        # ── 5. Query each question N times ────────────────────────────────────
        console.rule("[bold]Running queries[/bold]")

        # Shape: all_run_samples[run_idx] = list of SingleTurnSample objects
        all_run_samples: list[list[SingleTurnSample]] = []
        # Raw records for per-question CSV export
        raw_records: list[dict] = []

        for run_idx in range(1, n_runs + 1):
            console.print(f"\n[bold yellow]── Run {run_idx} / {n_runs} ──[/bold yellow]")
            run_samples: list[SingleTurnSample] = []

            for qa in track(ground_truth, description=f"  Querying ({run_idx}/{n_runs})..."):
                question: str = qa["question"]
                reference: str = qa["ground_truth"].strip()
                category: str = qa.get("category", "uncategorised")

                try:
                    answer, contexts = query_rag(http, rag_url, doc_id, question, top_k=top_k)
                except httpx.HTTPStatusError as e:
                    console.print(f"\n  [red]✗ /query error for: {question[:50]!r}: HTTP {e.response.status_code}[/red]")
                    answer = ""
                    contexts = []

                if not contexts:
                    console.print(
                        f"\n  [yellow]⚠ No contexts returned for question {run_idx}:{question[:60]!r}[/yellow]"
                    )

                run_samples.append(
                    SingleTurnSample(
                        user_input=question,
                        response=answer,
                        retrieved_contexts=contexts,
                        reference=reference,
                    )
                )
                raw_records.append({
                    "run": run_idx,
                    "category": category,
                    "question": question,
                    "answer": answer,
                    "n_contexts": len(contexts),
                    # Store all context strings pipe-separated for later RAGAS scoring
                    "contexts_full": " ||| ".join(contexts),
                    "context_preview": contexts[0][:200] if contexts else "",
                    "ground_truth": reference,
                })

            all_run_samples.append(run_samples)

            # Brief pause between runs to avoid Ollama rate limits during indexing/querying
            if run_idx < n_runs:
                console.print(f"  Sleeping 5s between runs to avoid rate limits...")
                time.sleep(5)

    # ── 6. RAGAS evaluation ───────────────────────────────────────────────────
    # Save raw records immediately before RAGAS in case RAGAS crashes
    output_path.parent.mkdir(parents=True, exist_ok=True)
    raw_df = pd.DataFrame(raw_records)
    raw_path = output_path.with_stem(output_path.stem + "_raw")
    raw_df.to_csv(raw_path, index=False)
    console.print(f"[green]✓ Saved raw query responses to {raw_path}[/green]")

    console.rule("[bold]RAGAS Evaluation[/bold]")
    console.print("Building RAGAS evaluator with OpenAI gpt-4o-mini + text-embedding-3-small...")
    try:
        metrics, metric_names = build_ragas_evaluator()
    except Exception as e:
        console.print(f"[red]✗ Failed to build RAGAS evaluator: {e}[/red]")
        console.print("[yellow]Skipping RAGAS. Run score_only.py to use heuristic scoring on the saved raw CSV.[/yellow]")
        sys.exit(0)

    run_agg_rows: list[dict] = []       # One row per run, aggregated across questions
    per_question_rows: list[dict] = []  # One row per (run, question)

    for run_idx, samples in enumerate(all_run_samples, 1):
        console.print(f"\n[cyan]Scoring run {run_idx} ({len(samples)} samples)...[/cyan]")
        dataset = EvaluationDataset(samples=samples)

        try:
            result = evaluate(dataset=dataset, metrics=metrics)
        except Exception as e:
            console.print(f"[red]✗ RAGAS evaluate() failed on run {run_idx}: {e}[/red]")
            console.print("  Skipping this run from aggregation.")
            continue

        df = result.to_pandas()

        # Aggregate scores for this run
        run_row: dict = {"run": run_idx}
        for m in metric_names:
            if m in df.columns:
                run_row[m] = float(df[m].mean())
            else:
                console.print(f"  [yellow]⚠ Metric '{m}' not in RAGAS output — skipping.[/yellow]")
                run_row[m] = None
        run_agg_rows.append(run_row)

        # Per-question scores for this run
        for q_idx, row in df.iterrows():
            pq_row = {
                "run": run_idx,
                "question": ground_truth[q_idx]["question"],
                "category": ground_truth[q_idx].get("category", "uncategorised"),
            }
            for m in metric_names:
                pq_row[m] = float(row[m]) if m in row and row[m] is not None else None
            per_question_rows.append(pq_row)

    if not run_agg_rows:
        console.print("[red]No successful runs to report. Exiting.[/red]")
        sys.exit(1)

    # ── 7. Aggregate and display results ─────────────────────────────────────
    console.rule("[bold green]Results[/bold green]")

    agg_df = pd.DataFrame(run_agg_rows).set_index("run")
    pq_df = pd.DataFrame(per_question_rows)

    # Summary table
    summary_table = Table(
        title=f"RAGAS Aggregate Scores  (mean ± std over {len(run_agg_rows)} run(s))",
        show_lines=True,
        header_style="bold cyan",
    )
    summary_table.add_column("Metric", style="cyan", min_width=22)
    summary_table.add_column("Mean", justify="right", style="bold green")
    summary_table.add_column("Std Dev", justify="right", style="yellow")
    summary_table.add_column("Min", justify="right")
    summary_table.add_column("Max", justify="right")
    summary_table.add_column("Interpretation", style="dim")

    INTERPRETATIONS = {
        "faithfulness":        "Is the answer grounded in retrieved chunks?",
        "context_precision":   "Are relevant chunks ranked above noise?",
        "context_recall":      "Were all necessary chunks retrieved?",
        "answer_relevancy":    "Is the answer on-topic for the question?",
    }

    for m in metric_names:
        if m not in agg_df.columns:
            continue
        col = agg_df[m].dropna()
        if col.empty:
            continue
        mean_val = col.mean()
        std_val = col.std() if len(col) > 1 else float("nan")
        min_val = col.min()
        max_val = col.max()

        def fmt(v):
            return f"{v:.4f}" if not pd.isna(v) else "N/A"

        summary_table.add_row(
            m,
            fmt(mean_val),
            fmt(std_val),
            fmt(min_val),
            fmt(max_val),
            INTERPRETATIONS.get(m, ""),
        )
    console.print(summary_table)

    # Per-category breakdown
    if not pq_df.empty and "category" in pq_df.columns:
        console.print("\n[bold]Per-category mean scores:[/bold]")
        cat_df = pq_df.groupby("category")[metric_names].mean().round(4)
        console.print(cat_df.to_string())

    # Per-question breakdown
    if not pq_df.empty:
        console.print("\n[bold]Per-question mean scores (across all runs):[/bold]")
        pq_mean = pq_df.groupby("question")[metric_names].mean().round(4)
        for q, row in pq_mean.iterrows():
            console.print(f"\n  [dim]{q}[/dim]")
            for m in metric_names:
                val = row.get(m)
                if val is not None and not pd.isna(val):
                    colour = "green" if val >= 0.7 else ("yellow" if val >= 0.5 else "red")
                    console.print(f"    {m:<22} [{colour}]{val:.4f}[/{colour}]")

    # ── 8. Save outputs ───────────────────────────────────────────────────────
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Per-question raw records (includes answers and contexts)
    raw_df = pd.DataFrame(raw_records)
    raw_path = output_path.with_stem(output_path.stem + "_raw")
    raw_df.to_csv(raw_path, index=False)

    # Per-question RAGAS scores
    if not pq_df.empty:
        pq_df.to_csv(output_path, index=False)

    # Per-run summary
    summary_path = output_path.with_stem(output_path.stem + "_summary")
    agg_df.to_csv(summary_path)

    # Machine-readable JSON for CI integration
    json_path = output_path.with_suffix(".json")
    json_summary = {}
    for m in metric_names:
        if m in agg_df.columns:
            col = agg_df[m].dropna()
            json_summary[m] = {
                "mean": round(float(col.mean()), 6) if not col.empty else None,
                "std": round(float(col.std()), 6) if len(col) > 1 else None,
                "min": round(float(col.min()), 6) if not col.empty else None,
                "max": round(float(col.max()), 6) if not col.empty else None,
                "runs": int(len(col)),
            }
    json_path.write_text(json.dumps(json_summary, indent=2))

    console.print(f"\n[green]✓[/green] Saved per-question scores  → {output_path}")
    console.print(f"[green]✓[/green] Saved per-run summary       → {summary_path}")
    console.print(f"[green]✓[/green] Saved raw Q&A records       → {raw_path}")
    console.print(f"[green]✓[/green] Saved JSON summary          → {json_path}")


# ──────────────────────────────────────────────────────────────────────────────
# Entry Point
# ──────────────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Vantly RAGAS Evaluation Harness",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Evaluate against locally running RAG service (default)
  python evaluate.py

  # Evaluate against Docker-hosted service, 5 runs
  python evaluate.py --rag-url http://localhost:8000 --runs 5

  # Custom output location
  python evaluate.py --output results/v1_baseline.csv
        """,
    )
    p.add_argument(
        "--fixture",
        help="Path to the fixture text file to index (default: eval/fixtures/meridian_financials.txt)",
    )
    p.add_argument(
        "--ground-truth",
        help="Path to the ground truth YAML file (default: eval/ground_truth.yaml)",
    )
    p.add_argument(
        "--doc-id",
        help="Document ID for the vector store (default: eval_meridian_2024)",
    )
    p.add_argument(
        "--rag-url",
        default=DEFAULT_RAG_URL,
        help=(
            "Base URL for RAG endpoints. "
            "When running via Docker use http://localhost:3000/api/rag (default). "
            "When running the Python service locally without Docker use http://localhost:8000."
        ),
    )
    p.add_argument(
        "--runs",
        type=int,
        default=3,
        help="Number of evaluation runs per scenario (default: 3, for mean ± std reporting)",
    )
    p.add_argument(
        "--top-k",
        type=int,
        default=5,
        help="Number of context chunks to retrieve per query (default: 5)",
    )
    p.add_argument(
        "--output",
        default="results/ragas_results.csv",
        help="Output CSV path for per-question RAGAS scores (default: results/ragas_results.csv)",
    )
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_evaluation(args)
