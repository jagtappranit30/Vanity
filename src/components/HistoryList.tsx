import React, { useState } from "react";
import { FileText, Calendar, Trash2, Search, Plus, Building2, BarChart2 } from "lucide-react";
import { AssessmentRun } from "../types";

interface HistoryListProps {
  history: AssessmentRun[];
  selectedId: string | null;
  onSelect: (run: AssessmentRun) => void;
  onDelete: (id: string) => void;
  onStartNew: () => void;
}

export default function HistoryList({ history, selectedId, onSelect, onDelete, onStartNew }: HistoryListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Color code based on score
  const getBadgeColors = (score: number) => {
    if (score >= 67) {
      return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50";
    } else if (score >= 34) {
      return "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/50";
    } else {
      return "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200/50 dark:border-rose-800/50";
    }
  };

  // Filter history based on search query
  const filteredHistory = history.filter((run) => {
    const query = searchQuery.toLowerCase();
    return (
      run.companyName.toLowerCase().includes(query) ||
      run.sector.toLowerCase().includes(query) ||
      run.fileName.toLowerCase().includes(query)
    );
  });

  return (
    <div id="history-sidebar-container" className="space-y-6 flex flex-col h-full">
      {/* Header and Quick Action */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Recent Analytics
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 font-semibold border border-zinc-200/60 dark:border-zinc-800/60">
            {history.length} Saved
          </span>
        </div>

        <button
          onClick={onStartNew}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 dark:shadow-none hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 border border-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          Start New Assessment
        </button>

        {/* Search Bar */}
        {history.length > 0 && (
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by company or sector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-xs"
            />
          </div>
        )}
      </div>

      {/* History List */}
      <div className="flex-1 space-y-3 overflow-y-auto pr-1 max-h-[580px] scrollbar-thin">
        {history.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/10">
            <Building2 className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-xs font-medium text-zinc-450 dark:text-zinc-500 leading-normal">
              No assessments found. Upload financial accounts to start!
            </p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-normal">
              No records match "{searchQuery}"
            </p>
          </div>
        ) : (
          filteredHistory.map((run) => {
            const isSelected = selectedId === run.id;
            return (
              <div
                key={run.id}
                onClick={() => onSelect(run)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer text-left group relative ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/15 dark:bg-indigo-950/15 shadow-[0_4px_20px_rgba(79,70,229,0.05)] ring-1 ring-indigo-500/20"
                    : "border-zinc-200/85 dark:border-zinc-800 hover:border-zinc-350 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md"
                }`}
              >
                {/* Delete button (only show on hover) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete the record for ${run.companyName}?`)) {
                      onDelete(run.id);
                    }
                  }}
                  className="absolute top-3.5 right-3.5 text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="Delete Assessment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Score badge top-right */}
                <div className="flex items-start justify-between gap-4">
                  <div className="max-w-[72%]">
                    <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-xs truncate mb-1 pr-3">
                      {run.companyName || "Unnamed SME"}
                    </h4>
                    <span className="inline-block px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-550 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-2">
                      {run.sector}
                    </span>
                  </div>
                  
                  <div className={`px-2 py-1 rounded-lg border text-xs font-black text-center shrink-0 min-w-[34px] ${getBadgeColors(run.scores.productivityIndex)}`}>
                    {run.scores.productivityIndex}
                  </div>
                </div>

                <div className="flex items-center gap-x-2 gap-y-1 text-[10px] font-medium text-zinc-400 dark:text-zinc-550 border-t border-zinc-100 dark:border-zinc-800/80 pt-2.5 mt-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-zinc-350 dark:text-zinc-650" />
                    {new Date(run.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 truncate max-w-[120px]" title={run.fileName}>
                    <FileText className="w-3 h-3 text-zinc-350 dark:text-zinc-650" />
                    {run.fileName}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
