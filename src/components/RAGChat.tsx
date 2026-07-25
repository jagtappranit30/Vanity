import React, { useState, useEffect } from "react";
import { MessageSquare, Send, Sparkles, FileText, Database, ShieldCheck, ChevronDown, ChevronUp, Bot, User, RefreshCw } from "lucide-react";

interface RAGSource {
  chunk_id: string;
  page: number;
  text: string;
  similarity_score: number;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  sources?: RAGSource[];
  timestamp: string;
}

interface RAGChatProps {
  docId: string;
  companyName: string;
  fileName: string;
}

export const RAGChat: React.FC<RAGChatProps> = ({ docId, companyName, fileName }) => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: `Hello! I am Vantly's Document Assistant. Ask me any granular question about **${fileName}** for ${companyName}, and I will retrieve exact page citations and relevant context snippets.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [serviceStatus, setServiceStatus] = useState<{ healthy: boolean; docCount: number; checking: boolean }>({
    healthy: true,
    docCount: 1,
    checking: false,
  });
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);

  // Check health of Python RAG microservice on mount
  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setServiceStatus((prev) => ({ ...prev, checking: true }));
    try {
      const res = await fetch("/api/rag/health");
      if (res.ok) {
        const data = await res.json();
        setServiceStatus({
          healthy: data.status === "healthy",
          docCount: data.indexed_documents_count || 1,
          checking: false,
        });
      } else {
        setServiceStatus({ healthy: false, docCount: 0, checking: false });
      }
    } catch {
      setServiceStatus({ healthy: false, docCount: 0, checking: false });
    }
  };

  const handleAsk = async (promptText?: string) => {
    const q = (promptText || question).trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: "user",
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_id: docId,
          question: q,
          top_k: 4,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to query RAG service.");
      }

      const data = await res.json();

      const botMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        sender: "assistant",
        text: data.answer || "No response received from vector search engine.",
        sources: data.sources || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          sender: "assistant",
          text: `⚠️ RAG Error: ${err.message || "Failed to retrieve context vector answers."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestedQuestions = [
    "What are the cost of sales or COGS breakdown?",
    "Check liabilities and short-term debt balance",
    "Which digital software tools are explicitly named?",
    "Summarize turnover and payroll expenses with page citations",
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden flex flex-col transition-colors duration-300">
      {/* Header Bar */}
      <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-850 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-black text-sm text-zinc-950 dark:text-white">
                Python RAG Document Assistant
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                FastAPI + PyPDF + Ollama Vectors
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Context vector search over <strong className="text-zinc-700 dark:text-zinc-200 font-semibold">{fileName}</strong>
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={checkHealth}
            disabled={serviceStatus.checking}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
            title="Refresh RAG Service Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${serviceStatus.checking ? "animate-spin" : ""}`} />
          </button>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <Database className="w-3.5 h-3.5 text-indigo-500" />
            <span>Doc ID: <code className="font-mono text-xs">{docId.substring(0, 8)}</code></span>
          </div>
        </div>
      </div>

      {/* Suggested Chips */}
      <div className="px-6 py-2.5 bg-zinc-100/60 dark:bg-zinc-900/60 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <MessageSquare className="w-3 h-3 text-indigo-500" /> Quick Ask:
        </span>
        {suggestedQuestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => handleAsk(s)}
            disabled={loading}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-medium border border-zinc-200 dark:border-zinc-700/80 transition-all shadow-2xs"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Chat Messages Log */}
      <div className="p-6 min-h-[300px] max-h-[480px] overflow-y-auto flex flex-col gap-4 bg-zinc-50/50 dark:bg-zinc-900/40">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 max-w-[88%] ${
              msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs ${
                msg.sender === "user"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-none"
              }`}
            >
              {msg.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className="flex flex-col gap-1.5">
              <div
                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium rounded-tr-none"
                    : "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/80 shadow-2xs rounded-tl-none"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Vector Sources Citation Panel */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-700/80">
                    <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">
                      <FileText className="w-3.5 h-3.5" /> Cited Document Vector Chunks ({msg.sources.length})
                    </div>
                    <div className="flex flex-col gap-2">
                      {msg.sources.map((src, sIdx) => {
                        const isExpanded = expandedSourceId === `${msg.id}-${sIdx}`;
                        return (
                          <div
                            key={sIdx}
                            className="bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/70 dark:border-zinc-700/60 rounded-xl p-2.5 text-xs text-zinc-700 dark:text-zinc-300"
                          >
                            <div
                              onClick={() =>
                                setExpandedSourceId(isExpanded ? null : `${msg.id}-${sIdx}`)
                              }
                              className="flex items-center justify-between cursor-pointer font-medium text-zinc-900 dark:text-zinc-100"
                            >
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                                  Page {src.page}
                                </span>
                                <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                                  Score: {(src.similarity_score * 100).toFixed(1)}%
                                </span>
                              </div>
                              <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </div>

                            {isExpanded && (
                              <p className="mt-2 text-xs font-mono bg-white dark:bg-zinc-950 p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-800 leading-relaxed text-zinc-600 dark:text-zinc-350 select-text">
                                "{src.text}"
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 px-1">
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-3 mr-auto">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              <Bot className="w-4 h-4 animate-bounce" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2 shadow-2xs">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></div>
              Vectorizing query & searching document chunks via Python RAG engine...
            </div>
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={`Ask a question about ${fileName}...`}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 text-white font-medium text-sm flex items-center gap-2 shadow-sm transition-all shrink-0"
          >
            <span>Ask RAG</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 px-1">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" /> Grounded in original document text
          </span>
          <span>FastAPI • pypdf • Ollama Vector Embeddings</span>
        </div>
      </div>
    </div>
  );
};
