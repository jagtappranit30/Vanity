import React, { useState, useRef } from "react";
import { Upload, FileText, AlertCircle, RefreshCw, Layers } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../context/AuthContext.tsx";

interface UploadFormProps {
  onStartAssessment: (file: File, sector: string, companyName: string) => void;
  isLoading: boolean;
  error: string | null;
  setError: (val: string | null) => void;
}

const SECTORS = [
  { id: "Manufacturing", name: "Manufacturing", icon: "🏭", desc: "Production, assembly, and industrial operations" },
  { id: "Services", name: "Professional Services", icon: "💼", desc: "Consulting, B2B services, and client delivery" },
  { id: "Retail", name: "Retail & Commerce", icon: "🛒", desc: "Brick-and-mortar stores, online shops, and distribution" },
  { id: "Other", name: "Other / General", icon: "📦", desc: "General SME businesses across other domains" },
];

export default function UploadForm({ onStartAssessment, isLoading, error, setError }: UploadFormProps) {
  const { idToken } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [sector, setSector] = useState("Manufacturing");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "csv") {
      setError("Unsupported format. Please upload a PDF or CSV document.");
      return;
    }
    if (selectedFile.size > 15 * 1024 * 1024) {
      setError("File exceeds 15MB limit. Please upload a smaller document.");
      return;
    }
    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please upload a financial document to continue.");
      return;
    }
    onStartAssessment(file, sector, companyName);
  };

  return (
    <div id="upload-form-container" className="max-w-4xl mx-auto">
      <AnimatePresence mode="wait">
        <motion.form
          key="form-state"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          onSubmit={handleSubmit}
          className="space-y-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-colors duration-300"
        >
            {/* Form Header */}
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Cognitive Analyzer</span>
              <h2 className="text-3xl font-display font-bold text-zinc-900 dark:text-white mt-1 mb-2">
                New Productivity Assessment
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm">
                Provide basic company metadata and upload accounts to benchmark performance.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 rounded-2xl flex items-start gap-3 text-sm animate-shake">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <span className="font-semibold">Analysis Blocked: </span>
                  {error}
                </div>
              </div>
            )}

            {/* General Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="company-name" className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-tight mb-2">
                  Company Name <span className="text-zinc-400 dark:text-zinc-500 font-light lowercase">(optional)</span>
                </label>
                <input
                  id="company-name"
                  type="text"
                  placeholder="e.g. Sterling Manufacturing Ltd"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-tight mb-2">
                  Business Sector
                </label>
                <div className="relative">
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full appearance-none px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-zinc-950"
                  >
                    {SECTORS.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.icon} {sec.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Sector Visual Selector Cards */}
            <div>
              <span className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
                Selected Sector Context
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {SECTORS.map((sec) => {
                  const isSelected = sector === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setSector(sec.id)}
                      className={`text-left p-5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20 ring-1 ring-indigo-600/10"
                          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-950 shadow-xs"
                      }`}
                    >
                      <span className="text-3xl mb-3 block">{sec.icon}</span>
                      <span className={`block font-bold text-sm ${isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-900 dark:text-white"}`}>{sec.name}</span>
                      <span className="block text-xs text-zinc-400 dark:text-zinc-500 mt-1 leading-snug">{sec.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Document Upload Area */}
            <div>
              <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-tight mb-2">
                Financial Document Upload
              </label>
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileInput}
                className={`border-2 border-dashed rounded-[2rem] p-10 text-center cursor-pointer transition-all ${
                  dragActive
                    ? "border-indigo-600 dark:border-indigo-500/50 bg-indigo-50/10 dark:bg-indigo-950/20"
                    : file
                    ? "border-zinc-300 dark:border-zinc-700 bg-zinc-50/30 dark:bg-zinc-900/30"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-zinc-50/10 dark:hover:bg-zinc-900/10"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {file ? (
                  <div className="flex flex-col items-center max-w-sm mx-auto">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-sm">
                      <FileText className="w-6 h-6" />
                    </div>
                    <span className="block font-semibold text-zinc-900 dark:text-white text-sm truncate max-w-full mb-1">
                      {file.name}
                    </span>
                    <span className="block text-xs text-zinc-400 dark:text-zinc-500 mb-4">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.name.split(".").pop()?.toUpperCase()} Document
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                    >
                      Remove Document
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-850 flex items-center justify-center text-zinc-400 mb-4 shadow-xs">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="block font-bold text-zinc-900 dark:text-white text-sm mb-1">
                      Drag & drop your financial statements here
                    </span>
                    <span className="block text-xs text-zinc-400 dark:text-zinc-500 mb-4">
                      Supports PDF or CSV accounting statements (e.g. P&L, Balance Sheet) up to 15MB
                    </span>
                    <button
                      type="button"
                      className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-transparent dark:border-zinc-700"
                    >
                      Select Document
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end pt-5 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="submit"
                disabled={!file}
                className={`px-6 py-3.5 rounded-xl font-semibold text-sm shadow-lg flex items-center gap-2 transition-all cursor-pointer ${
                  file
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 dark:shadow-none hover:shadow-xl"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-450 dark:text-zinc-550 cursor-not-allowed shadow-none border border-transparent dark:border-zinc-750"
                }`}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    🚀 Calculate Productivity Index
                  </>
                )}
              </button>
            </div>
          </motion.form>
      </AnimatePresence>
    </div>
  );
}
