import React from "react";
import { FileText, Calendar, Trash2, Award, ArrowRight } from "lucide-react";
import { AssessmentRun } from "../types";

interface HistoryListProps {
  history: AssessmentRun[];
  selectedId: string | null;
  onSelect: (run: AssessmentRun) => void;
  onDelete: (id: string) => void;
  onStartNew: () => void;
}

export default function HistoryList({ history, selectedId, onSelect, onDelete, onStartNew }: HistoryListProps) {
  // Color code based on score
  const getBadgeColors = (score: number) => {
    if (score >= 67) {
      return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-150 dark:border-emerald-900/50";
    } else if (score >= 34) {
      return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-150 dark:border-amber-900/50";
    } else {
      return "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-150 dark:border-rose-900/50";
    }
  };

  return (
    <div id="history-sidebar-container" className="space-y-6">
      {/* Header & New Assessment Button */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
            Assessment Records
          </h3>
          <span className="px-2 py-0.5 rounded-full text-3xs bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 font-bold border border-zinc-200 dark:border-zinc-800">
            {history.length} Saved
          </span>
        </div>
        
        <button
          onClick={onStartNew}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-100 dark:shadow-none hover:shadow-xl transition-all cursor-pointer text-center"
        >
          ➕ Start New Assessment
        </button>
      </div>

      {/* History List */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {history.length === 0 ? (
          <div className="text-center py-8 px-4 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/20">
            <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-normal">
              No local assessments saved yet. Upload a financial document above to run your first calculation!
            </p>
          </div>
        ) : (
          history.map((run) => {
            const isSelected = selectedId === run.id;
            return (
              <div
                key={run.id}
                onClick={() => onSelect(run)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer text-left group relative ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/10 dark:bg-indigo-950/10 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-350 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
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
                  className="absolute top-3 right-3 text-zinc-450 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-lg hover:bg-rose-50/50 dark:hover:bg-rose-950/30 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="Delete Assessment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Score badge top-right */}
                <div className="flex items-start justify-between gap-4">
                  <div className="max-w-[75%]">
                    <h4 className="font-bold text-zinc-950 dark:text-white text-xs truncate mb-1 pr-4">
                      {run.companyName}
                    </h4>
                    <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-850 text-zinc-500 dark:text-zinc-400 text-3xs font-medium uppercase tracking-wider mb-2">
                      {run.sector}
                    </span>
                  </div>
                  
                  <div className={`px-2 py-1 rounded-lg border text-xs font-bold text-center shrink-0 ${getBadgeColors(run.scores.productivityIndex)}`}>
                    {run.scores.productivityIndex}
                  </div>
                </div>

                <div className="flex items-center gap-x-2 gap-y-1 text-4xs text-zinc-400 dark:text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 pt-2.5 mt-2">
                  <span className="flex items-center gap-0.5">
                    <Calendar className="w-3 h-3" />
                    {new Date(run.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5 truncate max-w-[120px]" title={run.fileName}>
                    <FileText className="w-3 h-3" />
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
