import React, { useState } from "react";
import { 
  Award, TrendingUp, DollarSign, Users, ShieldAlert, Cpu, 
  Lightbulb, CheckCircle, FileText, Download, Trash2, Calendar, FileJson, RefreshCw, ExternalLink
} from "lucide-react";
import { motion } from "motion/react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { AssessmentRun } from "../types";
import { useAuth } from "../context/AuthContext.tsx";
import { generateAssessmentPDF } from "../utils/pdfGenerator";

interface ResultsDashboardProps {
  assessment: AssessmentRun | null;
  onBack: () => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
  loadingCompanyName?: string;
  loadingSector?: string;
}

export default function ResultsDashboard({
  assessment,
  onBack,
  onDelete,
  isLoading = false,
  loadingCompanyName = "Your Company",
  loadingSector = "Manufacturing"
}: ResultsDashboardProps) {
  const { idToken, googleAccessToken, signInWithGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "labour" | "financial" | "digital" | "justification">("overview");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);

  // Loading phase messages
  const LOADING_STEPS = [
    "Uploading financial statement to workspace server...",
    "Initializing Gemini 3.5 Flash cognitive parsing...",
    "Scanning Balance Sheet & Profit & Loss statements...",
    "Extracting Revenue, COGS, and liquidity figures...",
    "Measuring labour productivity & payroll leverage...",
    "Synthesizing customized AI recommendations...",
    "Finalizing sector percentile benchmarks...",
  ];

  const [loadingStep, setLoadingStep] = useState(0);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  if (isLoading || !assessment) {
    const displayCompany = loadingCompanyName || "Your Company";
    const displaySector = loadingSector || "Manufacturing";
    return (
      <div id="results-skeleton-root" className="space-y-8 max-w-5xl mx-auto">
        {/* Header Actions Skeleton */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
              <span>←</span>
              <div className="w-48 h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-display font-bold text-zinc-900 dark:text-white truncate">
                {displayCompany}
              </h1>
              <span className="px-2.5 py-1 rounded-full text-2xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-150 dark:border-indigo-900/50">
                {displaySector} Sector
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-zinc-550 mt-1">
              <div className="w-24 h-4 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
              <div className="w-32 h-4 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="w-36 h-9 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
            <div className="w-28 h-9 bg-zinc-100 dark:bg-zinc-850 rounded-xl"></div>
          </div>
        </div>

        {/* Main Stats Bento Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Productivity Index Card Skeleton */}
          <div className="md:col-span-2 bg-zinc-900 dark:bg-zinc-900/80 border border-transparent dark:border-zinc-800 text-white rounded-[2rem] p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[220px]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-[80px] opacity-25 -mr-16 -mt-16"></div>
            
            <div className="relative z-10">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-450 dark:text-zinc-550">
                Vantly Productivity Index
              </span>
              <div className="flex items-baseline gap-4 mt-3">
                <div className="h-16 w-32 bg-zinc-800 dark:bg-zinc-800/80 rounded-2xl animate-pulse"></div>
                <div className="w-24 h-6 bg-indigo-600/30 rounded-full"></div>
              </div>
            </div>

            {/* AI Status Step Monitor integrated directly into skeleton */}
            <div className="relative z-10 border-t border-zinc-800/60 dark:border-zinc-800/40 pt-5 mt-4 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <div className="flex-1">
                <span className="text-4xs text-indigo-400 font-bold block uppercase tracking-wider">Analysis Phase</span>
                <span className="text-xs font-bold text-zinc-100 block truncate mt-0.5 animate-pulse">
                  {LOADING_STEPS[loadingStep]}
                </span>
              </div>
              <span className="text-4xs text-zinc-400 font-bold font-mono">
                {Math.round(((loadingStep + 1) / LOADING_STEPS.length) * 100)}%
              </span>
            </div>
          </div>

          {/* Pillar Breakdown Stats Card Skeleton */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Pillar Breakouts
              </span>
              <div className="space-y-5 mt-5">
                {/* Labour Efficiency Pillar */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <div className="w-24 h-3.5 bg-zinc-200 dark:bg-zinc-850 rounded"></div>
                    <div className="w-10 h-3.5 bg-zinc-200 dark:bg-zinc-850 rounded"></div>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-zinc-850 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-zinc-300 dark:bg-zinc-750 h-full rounded-full w-1/2"></div>
                  </div>
                </div>

                {/* Financial Health Pillar */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <div className="w-24 h-3.5 bg-zinc-200 dark:bg-zinc-850 rounded"></div>
                    <div className="w-10 h-3.5 bg-zinc-200 dark:bg-zinc-850 rounded"></div>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-zinc-850 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-zinc-300 dark:bg-zinc-750 h-full rounded-full w-[45%]"></div>
                  </div>
                </div>

                {/* Digital Maturity Pillar */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <div className="w-24 h-3.5 bg-zinc-200 dark:bg-zinc-850 rounded"></div>
                    <div className="w-10 h-3.5 bg-zinc-200 dark:bg-zinc-850 rounded"></div>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-zinc-850 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-zinc-200 dark:bg-zinc-800 h-full rounded-full w-[60%]"></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="w-48 h-3.5 bg-zinc-200 dark:bg-zinc-850 rounded mt-4"></div>
          </div>
        </div>

        {/* Tabs Navigation Skeleton */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto pb-1 gap-2 scrollbar-none">
          {["AI Recommendations", "Labour Efficiency", "Financial Health", "Digital Maturity", "Audit Traceability"].map((tabLabel, idx) => (
            <div
              key={idx}
              className={`px-4 py-2.5 border-b-2 border-transparent font-bold text-xs flex items-center gap-2 shrink-0 ${
                idx === 0 ? "border-indigo-600/40 text-indigo-600/40 bg-indigo-50/5 dark:bg-indigo-950/10 rounded-t-xl" : "text-zinc-300 dark:text-zinc-650"
              }`}
            >
              <div className="w-3.5 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800"></div>
              <span>{tabLabel}</span>
            </div>
          ))}
        </div>

        {/* Tab Panel Content Skeleton */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] min-h-[350px] space-y-6">
          <div className="space-y-3">
            <div className="w-32 h-4 bg-zinc-200 dark:bg-zinc-850 rounded-md"></div>
            <div className="w-64 h-6 bg-zinc-250 dark:bg-zinc-800 rounded-lg"></div>
            <div className="space-y-2 bg-zinc-50/70 dark:bg-zinc-950/40 p-5 rounded-2xl border border-zinc-150 dark:border-zinc-800">
              <div className="w-full h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg"></div>
              <div className="w-[95%] h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg"></div>
              <div className="w-[85%] h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg"></div>
            </div>
          </div>
          
          <div className="pt-4 space-y-4">
            <div className="w-56 h-6 bg-zinc-250 dark:bg-zinc-850 rounded-lg"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-5 rounded-2xl border border-zinc-150 dark:border-zinc-850/80 bg-white dark:bg-zinc-900 flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-850 shrink-0"></div>
                  <div className="space-y-2 flex-1 pt-1">
                    <div className="w-[80%] h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded-md"></div>
                    <div className="w-[50%] h-3 bg-zinc-150 dark:bg-zinc-850 rounded-md"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { metrics, scores, benchmarks, companyName, sector, date, fileName, fileType } = assessment;

  const handleExportGoogleDoc = async () => {
    setIsExporting(true);
    setExportError(null);
    setDocUrl(null);
    try {
      if (!googleAccessToken) {
        throw new Error("Google access authorization missing. Click 'Authorize Google Docs' to connect.");
      }

      const response = await fetch("/api/export-docs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          assessmentId: assessment.id,
          googleAccessToken,
        }),
      });

      let data: any = null;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        if (text.includes("<!doctype") || text.includes("<!DOCTYPE") || text.includes("<html")) {
          throw new Error(`Server returned HTML error (Status ${response.status}). The server might be restarting or there is a configuration issue.`);
        }
        throw new Error(text || `Server returned error status ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(data?.error || "Failed to export report to Google Docs.");
      }

      setDocUrl(data.docUrl);
    } catch (err: any) {
      console.error("Export failed:", err);
      setExportError(err.message || "Failed to export report.");
    } finally {
      setIsExporting(false);
    }
  };

  // Format currency
  const formatCurrency = (val: number | null) => {
    if (val === null) return "N/A";
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(val);
  };

  // Get index status details
  const getIndexStatus = (index: number) => {
    if (index >= 67) {
      return {
        label: "Market Leader",
        colorBg: "bg-emerald-500",
        colorText: "text-emerald-700",
        colorBorder: "border-emerald-200",
        colorLightBg: "bg-emerald-50",
        desc: "Operating significantly above the sector median. Highly optimized workflows, healthy margins, and efficient labour leverage.",
        emoji: "🟢"
      };
    } else if (index >= 34) {
      return {
        label: "Median Competitor",
        colorBg: "bg-amber-500",
        colorText: "text-amber-700",
        colorBorder: "border-amber-200",
        colorLightBg: "bg-amber-50",
        desc: "Performing at par with typical sector operations. Solid foundation but substantial headroom exists to raise payroll leverage and digitize.",
        emoji: "🟡"
      };
    } else {
      return {
        label: "Underperforming",
        colorBg: "bg-rose-500",
        colorText: "text-rose-700",
        colorBorder: "border-rose-200",
        colorLightBg: "bg-rose-50",
        desc: "Currently running below sector median. Urgent strategic adjustments are recommended to address labour output leakages or thin margins.",
        emoji: "🔴"
      };
    }
  };

  const status = getIndexStatus(scores.productivityIndex);

  // Setup comparative data for charts
  const revPerEmpData = [
    { name: companyName || "SME Actual", value: scores.labourDetails.revenuePerEmployee, fill: "#0f172a" },
    { name: `${sector} P25`, value: benchmarks.revenue_per_employee.p25, fill: "#cbd5e1" },
    { name: `${sector} Median (P50)`, value: benchmarks.revenue_per_employee.p50, fill: "#64748b" },
    { name: `${sector} P75`, value: benchmarks.revenue_per_employee.p75, fill: "#334155" },
  ];

  const marginData = [
    { name: "Gross Margin %", Actual: scores.financialDetails.grossMargin, Median: benchmarks.gross_margin.p50 },
    { name: "Operating Margin %", Actual: scores.financialDetails.operatingMargin, Median: benchmarks.operating_margin.p50 },
  ];

  const currentRatioData = [
    { name: "Current Ratio", value: scores.financialDetails.currentRatio, fill: "#0f172a" },
    { name: "Target Ratio", value: 1.5, fill: "#64748b" },
  ];

  return (
    <div id="results-dashboard-root" className="space-y-8 max-w-5xl mx-auto">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <button
            onClick={onBack}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-350 flex items-center gap-1.5 transition-colors cursor-pointer mb-2 uppercase tracking-wider"
          >
            ← Back to Assessment Dashboard
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold text-zinc-900 dark:text-white truncate">
              {companyName}
            </h1>
            <span className="px-2.5 py-1 rounded-full text-2xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-150 dark:border-indigo-900/50">
              {sector} Sector
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-zinc-550 mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              {fileName} ({fileType})
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {exportError && (
            <span className="text-2xs text-rose-650 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/20 px-3 py-1.5 rounded-lg border border-rose-100 dark:border-rose-900/50 max-w-xs truncate">
              ⚠️ {exportError}
            </span>
          )}

          {docUrl ? (
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-100 dark:shadow-none"
            >
              <ExternalLink className="w-4 h-4" />
              Open Google Doc ↗
            </a>
          ) : !googleAccessToken ? (
            <button
              onClick={signInWithGoogle}
              className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 text-indigo-700 dark:text-indigo-450 border border-indigo-200 dark:border-indigo-850 hover:border-indigo-300 dark:hover:border-indigo-750 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              Authorize Google Docs
            </button>
          ) : (
            <button
              onClick={handleExportGoogleDoc}
              disabled={isExporting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:bg-zinc-150 dark:disabled:bg-zinc-850 disabled:text-zinc-400 dark:disabled:text-zinc-600"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Export to Google Doc
                </>
              )}
            </button>
          )}

          <button
            onClick={() => generateAssessmentPDF(assessment)}
            className="px-4 py-2 bg-zinc-900 dark:bg-zinc-850 hover:bg-zinc-800 dark:hover:bg-zinc-750 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-zinc-200/50 dark:shadow-none border border-transparent dark:border-zinc-700"
          >
            <Download className="w-4 h-4" />
            Download PDF Report
          </button>

          {onDelete && (
            <button
              onClick={() => {
                if (confirm("Are you sure you want to delete this assessment?")) {
                  onDelete(assessment.id);
                }
              }}
              className="px-4 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 hover:border-rose-300 dark:hover:border-rose-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Delete Record
            </button>
          )}
        </div>
      </div>

      {/* Main Stats Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Core Productivity Index Card (High Contrast Dark Bento block) */}
        <div className="md:col-span-2 bg-zinc-900 dark:bg-zinc-900/80 border border-transparent dark:border-zinc-800 text-white rounded-[2rem] p-8 shadow-2xl shadow-zinc-200/5 dark:shadow-none relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-[80px] opacity-25 -mr-16 -mt-16"></div>
          
          <div className="relative z-10">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
              Composite Benchmark Index
            </span>
            <div className="flex items-baseline gap-4 mt-3">
              <h1 className="text-6xl font-display font-black tracking-tight">
                {scores.productivityIndex}
                <span className="text-xl text-zinc-500 dark:text-zinc-400 font-light ml-1">/100</span>
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-900/30">
                {status.label}
              </span>
            </div>
            <p className="text-zinc-300 text-sm mt-4 leading-relaxed max-w-xl">
              {status.desc}
            </p>
          </div>

          <div className="relative z-10 pt-6 border-t border-zinc-800 flex justify-between items-center text-3xs font-mono text-zinc-500">
            <span>Formula: Avg(Labour Efficiency, Financial Health)</span>
            <span>Ref: Vantly Analytics Framework</span>
          </div>
        </div>

        {/* Pillar Breakdown Stats Card (White Bento block with custom shadows) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between transition-colors duration-300">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Pillar Breakouts
            </span>
            <div className="space-y-5 mt-5">
              <div>
                <div className="flex justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  <span className="flex items-center gap-1.5 uppercase font-display">
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    Labour Efficiency
                  </span>
                  <span className="font-mono text-zinc-900 dark:text-white">{scores.labourEfficiencyScore}/50</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-850 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${(scores.labourEfficiencyScore / 50) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  <span className="flex items-center gap-1.5 uppercase font-display">
                    <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
                    Financial Health
                  </span>
                  <span className="font-mono text-zinc-900 dark:text-white">{scores.financialHealthScore}/50</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-850 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${(scores.financialHealthScore / 50) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  <span className="flex items-center gap-1.5 uppercase font-display">
                    <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                    Digital Maturity
                  </span>
                  <span className="font-mono text-zinc-900 dark:text-white">{scores.digitalMaturityScore}/100</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-850 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-zinc-900 dark:bg-zinc-700 h-full rounded-full transition-all duration-500"
                    style={{ width: `${scores.digitalMaturityScore}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-4xs font-semibold uppercase text-zinc-400 dark:text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-4">
            *Diagnostic metric • separated from core financial score
          </div>
        </div>
      </div>

      {/* Tabs Navigation (Pills/Bento Capsules) */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto pb-1 gap-2 scrollbar-none">
        {[
          { id: "overview", label: "AI Recommendations", icon: Lightbulb },
          { id: "labour", label: "Labour Efficiency", icon: Users },
          { id: "financial", label: "Financial Health", icon: DollarSign },
          { id: "digital", label: "Digitalization", icon: Cpu },
          { id: "justification", label: "Audit Justification", icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 border-b-2 font-bold text-xs flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
                isSelected
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-450 bg-indigo-50/10 dark:bg-indigo-950/20 rounded-t-xl"
                  : "border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-350"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels with animations */}
      <div id="results-tab-panel" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] min-h-[350px] transition-colors duration-300">
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Cognitive Synthesis</span>
              <h3 className="text-xl font-display font-bold text-zinc-900 dark:text-white mt-1 mb-3">
                Qualitative SME Performance Analysis
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed whitespace-pre-line bg-zinc-50/70 p-5 rounded-2xl border border-zinc-150 dark:border-zinc-800">
                {scores.qualitativeAnalysis}
              </p>
            </div>

            <div className="pt-4">
              <h3 className="text-xl font-display font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                Actionable AI-Powered SME Recommendations
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scores.recommendations.map((rec, idx) => (
                  <div key={idx} className="p-5 rounded-2xl border border-zinc-150 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-500/30 hover:shadow-sm transition-all flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950 shrink-0 text-indigo-600 dark:text-indigo-450 flex items-center justify-center font-bold text-xs">
                      {idx + 1}
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-350 text-xs leading-relaxed font-medium">
                      {rec}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "labour" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Pillar 1 Analysis</span>
                <h3 className="text-xl font-display font-bold text-zinc-900 dark:text-white mt-1 mb-2">
                  Labour Efficiency Analysis
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed mb-6 font-medium">
                  Labour efficiency measures the financial leverage generated from payroll capital and headcount deployment. Operating at a high value represents maximum task automation and product value-add per employee.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-150 dark:border-zinc-800">
                    <span className="text-4xs text-zinc-400 dark:text-zinc-500 font-bold block uppercase tracking-wider">Revenue per Employee</span>
                    <span className="text-2xl font-black text-zinc-900 dark:text-white block mt-1">
                      {scores.labourDetails.revenuePerEmployee > 0 ? formatCurrency(scores.labourDetails.revenuePerEmployee) : "N/A"}
                    </span>
                    <span className="text-3xs font-semibold text-zinc-400 dark:text-zinc-500 block mt-1 uppercase">
                      Sector Median: {formatCurrency(scores.labourDetails.revenuePerEmployeeBenchmark)}
                    </span>
                  </div>

                  <div className="p-5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-150 dark:border-zinc-800">
                    <span className="text-4xs text-zinc-400 dark:text-zinc-500 font-bold block uppercase tracking-wider">Output per Payroll £</span>
                    <span className="text-2xl font-black text-zinc-900 dark:text-white block mt-1">
                      {scores.labourDetails.outputPerPayroll > 0 ? `£${scores.labourDetails.outputPerPayroll}` : "N/A"}
                    </span>
                    <span className="text-3xs font-semibold text-zinc-400 dark:text-zinc-500 block mt-1 uppercase">
                      Sector Median: £{scores.labourDetails.outputPerPayrollBenchmark}
                    </span>
                  </div>
                </div>
              </div>

              {/* Chart Visualizing Rev per Emp */}
              <div className="bg-zinc-50/50 dark:bg-zinc-950/40 p-6 rounded-2xl border border-zinc-150 dark:border-zinc-800 shadow-3xs">
                <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-6 text-center">
                  Revenue per Employee Benchmark comparison
                </h4>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revPerEmpData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#71717a" }} interval={0} angle={-15} textAnchor="end" />
                      <YAxis tickFormatter={(val) => `£${val / 1000}k`} tick={{ fontSize: 10, fill: "#71717a" }} />
                      <Tooltip formatter={(value) => [`£${Number(value).toLocaleString()}`, "Revenue per Employee"]} />
                      <Bar dataKey="value">
                        {revPerEmpData.map((entry, index) => {
                          const isActual = entry.name === (companyName || "SME Actual");
                          return <Cell key={`cell-${index}`} fill={isActual ? "#4f46e5" : "#18181b"} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "financial" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Pillar 2 Analysis</span>
                <h3 className="text-xl font-display font-bold text-zinc-900 dark:text-white mt-1 mb-2">
                  Financial Health & Liquidity breakout
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed mb-6 font-medium">
                  While productivity indices measure throughput, financial health determines viability, margins, and defensive liquidity reserves. True SME health balances high gross margins with robust working capital coverage.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-150 dark:border-zinc-800">
                    <span className="text-4xs text-zinc-400 dark:text-zinc-500 font-bold block uppercase tracking-wider">Gross Margin %</span>
                    <span className="text-2xl font-black text-zinc-900 dark:text-white block mt-1">
                      {scores.financialDetails.grossMargin}%
                    </span>
                    <span className="text-3xs font-semibold text-zinc-400 dark:text-zinc-500 block mt-1 uppercase">
                      Sector Median: {scores.financialDetails.grossMarginBenchmark}%
                    </span>
                  </div>

                  <div className="p-5 bg-zinc-50 dark:bg-zinc-955 rounded-2xl border border-zinc-150 dark:border-zinc-800">
                    <span className="text-4xs text-zinc-400 dark:text-zinc-500 font-bold block uppercase tracking-wider">Operating Margin %</span>
                    <span className="text-2xl font-black text-zinc-900 dark:text-white block mt-1">
                      {scores.financialDetails.operatingMargin}%
                    </span>
                    <span className="text-3xs font-semibold text-zinc-400 dark:text-zinc-500 block mt-1 uppercase">
                      Sector Median: {scores.financialDetails.operatingMarginBenchmark}%
                    </span>
                  </div>

                  <div className="p-5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-150 dark:border-zinc-800 sm:col-span-2">
                    <span className="text-4xs text-zinc-400 dark:text-zinc-500 font-bold block uppercase tracking-wider">Liquidity (Current Ratio)</span>
                    <span className="text-2xl font-black text-zinc-900 dark:text-white block mt-1">
                      {scores.financialDetails.currentRatio}x
                    </span>
                    <p className="text-2xs font-semibold mt-1 text-zinc-700 dark:text-zinc-300">
                      {scores.financialDetails.currentRatio >= 1.5 
                        ? "🟢 Healthy working capital runway (Ratio > 1.5)" 
                        : scores.financialDetails.currentRatio >= 1.0 
                        ? "🟡 Marginal cash flow runway. Cash flow matches obligations closely." 
                        : "🔴 Risk of working capital squeeze. Liquidity ratio is below 1.0."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Comparative margins */}
              <div className="bg-zinc-50/50 dark:bg-zinc-955/40 p-6 rounded-2xl border border-zinc-150 dark:border-zinc-800 shadow-3xs">
                <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-6 text-center">
                  Margin Benchmark Comparison (%)
                </h4>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={marginData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717a" }} />
                      <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 10, fill: "#71717a" }} />
                      <Tooltip formatter={(value) => [`${value}%`]} />
                      <Bar dataKey="Actual" fill="#4f46e5" name="Actual Performance" />
                      <Bar dataKey="Median" fill="#18181b" name="Sector Median" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "digital" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-150 dark:border-zinc-800 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider mb-1">Digital Maturity Level</h4>
                  <p className="text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed mb-4">
                    Determined based on structural signals of process digitalization, modern cloud general ledger accounting packages, and process automation tools detected inside the report.
                  </p>
                  
                  <div className="flex items-center gap-3 mt-4">
                    <span className="text-4xl">
                      {scores.digitalMaturityLevel === "High" ? "⚡" : scores.digitalMaturityLevel === "Medium" ? "⚙️" : "📁"}
                    </span>
                    <div>
                      <span className="block font-bold text-zinc-900 dark:text-white text-lg">{scores.digitalMaturityLevel} Maturity</span>
                      <span className="text-2xs text-zinc-400 dark:text-zinc-500 font-semibold">Diag Score: {scores.digitalMaturityScore}/100</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 mt-6">
                  <span className="text-4xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-2">Detected Tech Signals:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {metrics.digitalTools.length > 0 ? (
                      metrics.digitalTools.map((tool, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-lg text-2xs font-semibold text-zinc-700 dark:text-zinc-300 shadow-3xs">
                          🛠️ {tool}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-450 italic">No explicit bookkeeping/digital ERP system detected in statement.</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-zinc-900 dark:bg-zinc-900/80 border border-transparent dark:border-zinc-800 text-white rounded-2xl relative overflow-hidden flex flex-col justify-between">
                <div className="relative">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Modernizing Operations</h4>
                  <p className="text-zinc-300 text-xs leading-relaxed">
                    SMEs utilizing modern API-driven SaaS suites (such as Xero, QuickBooks, automated payroll) experience a 2.3x reduction in administrative overhead, dramatically raising their Labour Efficiency index.
                  </p>
                </div>

                <div className="relative pt-6 border-t border-zinc-800">
                  <span className="text-2xs text-amber-400 font-bold block mb-1 uppercase tracking-wider">💡 Digital Maturity Recommendation:</span>
                  <p className="text-zinc-300 text-xs leading-relaxed italic">
                    {scores.digitalMaturityLevel === "Low" 
                      ? "Migrate manual records to a cloud accounting platform (Xero/QuickBooks) with automated bank feeds to reduce admin leakages." 
                      : scores.digitalMaturityLevel === "Medium" 
                      ? "Introduce connected OCR plugins (e.g. Dext, Hubdoc) to fully automate accounting journal entries and reduce invoice lag."
                      : "Consider connecting CRM pipelines via automated webhooks to link inventory forecasting closely with sales pipelines."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "justification" && (
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-2xl">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-450 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white">AI Audit & Document Traceability</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mt-0.5">
                  To maintain the strict auditing transparency demanded in Vantly evaluations, Gemini tracks the audit traces of every single extracted financial field.
                </p>
              </div>
            </div>

            <div className="border border-zinc-150 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-3xs">
              <div className="grid grid-cols-2 bg-zinc-50 dark:bg-zinc-950 p-3.5 border-b border-zinc-150 dark:border-zinc-800 text-2xs font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest">
                <span>extracted financial field</span>
                <span>extracted value</span>
              </div>
              <div className="divide-y divide-zinc-150 dark:divide-zinc-800 text-sm">
                {[
                  { label: "Annual Gross Revenue", value: formatCurrency(metrics.revenue) },
                  { label: "Reported Average Headcount", value: metrics.headcount !== null ? `${metrics.headcount} employees` : "N/A" },
                  { label: "Cost of Goods Sold (COGS)", value: formatCurrency(metrics.cogs) },
                  { label: "Annual Wage Payroll Cost", value: formatCurrency(metrics.payroll) },
                  { label: "Reported Gross Profit Margin", value: metrics.grossMargin !== null ? `${metrics.grossMargin}%` : "N/A" },
                  { label: "Reported Operating Profit Margin", value: metrics.operatingMargin !== null ? `${metrics.operatingMargin}%` : "N/A" },
                  { label: "Balance Sheet Current Assets", value: formatCurrency(metrics.currentAssets) },
                  { label: "Balance Sheet Current Liabilities", value: formatCurrency(metrics.currentLiabilities) },
                ].map((item, idx) => (
                  <div key={idx} className="grid grid-cols-2 p-3.5 hover:bg-zinc-50/20 dark:hover:bg-zinc-950/20 transition-all">
                    <span className="font-bold text-zinc-800 dark:text-zinc-300 text-xs">{item.label}</span>
                    <span className="font-mono text-xs text-zinc-950 dark:text-white font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-150 dark:border-zinc-800">
              <span className="text-4xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-2">Audit Trace Log:</span>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono leading-relaxed whitespace-pre-wrap bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                {metrics.extractedJustifications}
              </p>
              <div className="flex items-center justify-between text-4xs font-semibold uppercase text-zinc-400 dark:text-zinc-500 mt-3">
                <span>Extraction Engine: Google Gemini 3.5 Flash</span>
                <span>Trace Confidence: {metrics.confidence}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
