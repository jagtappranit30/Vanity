import React, { useState, useEffect } from "react";
import { Layers, Award, ShieldAlert, Cpu, Lightbulb, FileText, BarChart3, HelpCircle, X, LogIn, Database, CheckCircle, ArrowRight, Users, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AssessmentRun } from "./types";
import { useAuth } from "./context/AuthContext.tsx";
import { useTheme } from "./context/ThemeContext.tsx";
import UploadForm from "./components/UploadForm";
import ResultsDashboard from "./components/ResultsDashboard";
import HistoryList from "./components/HistoryList";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { user, idToken, loading, signInWithGoogle, signOut } = useAuth();
  const [isGuestMode, setIsGuestMode] = useState<boolean>(() => {
    return localStorage.getItem("vantly_guest_mode") === "true";
  });
  const [history, setHistory] = useState<AssessmentRun[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentRun | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingCompanyName, setProcessingCompanyName] = useState("");
  const [processingSector, setProcessingSector] = useState("");
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const handleEnterAsGuest = () => {
    localStorage.setItem("vantly_guest_mode", "true");
    setIsGuestMode(true);
  };

  const handleExitGuestMode = () => {
    localStorage.removeItem("vantly_guest_mode");
    setIsGuestMode(false);
    setHistory([]);
    setSelectedAssessment(null);
  };

  useEffect(() => {
    if (user) {
      localStorage.removeItem("vantly_guest_mode");
      setIsGuestMode(false);
    }
  }, [user]);

  // Fetch assessment runs on component mount or token change
  const fetchHistory = async () => {
    if (!idToken) return;
    try {
      setIsLoadingHistory(true);
      const res = await fetch("/api/history", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
        // Default to showing the latest assessment if any exist
        if (data.length > 0 && !selectedAssessment) {
          setSelectedAssessment(data[0]);
        }
      }
    } catch (err) {
      console.error("Error loading history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (idToken) {
      fetchHistory();
    } else if (isGuestMode) {
      // Load from localStorage for guests
      try {
        const localDataStr = localStorage.getItem("vantly_guest_history");
        if (localDataStr) {
          const data = JSON.parse(localDataStr) as AssessmentRun[];
          setHistory(data);
          if (data.length > 0 && !selectedAssessment) {
            setSelectedAssessment(data[0]);
          }
        } else {
          setHistory([]);
          setSelectedAssessment(null);
        }
      } catch (err) {
        console.error("Error loading guest history from local storage:", err);
        setHistory([]);
      }
    } else {
      setHistory([]);
      setSelectedAssessment(null);
    }
  }, [idToken, isGuestMode]);

  // Sync guest history with localStorage
  useEffect(() => {
    if (isGuestMode && !idToken) {
      localStorage.setItem("vantly_guest_history", JSON.stringify(history));
    }
  }, [history, isGuestMode, idToken]);

  const handleStartAssessment = async (file: File, sector: string, companyName: string) => {
    setIsProcessing(true);
    setProcessingError(null);
    setProcessingCompanyName(companyName || "Your Company");
    setProcessingSector(sector);
    setSelectedAssessment(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sector", sector);
    formData.append("companyName", companyName);

    try {
      const response = await fetch("/api/assess", {
        method: "POST",
        body: formData,
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
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
        throw new Error(data?.error || "An error occurred during assessment.");
      }

      setHistory((prev) => [data, ...prev]);
      setSelectedAssessment(data);
    } catch (err: any) {
      console.error("Processing failed:", err);
      setProcessingError(err.message || "Failed to process document. Please check your network connection.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!idToken) {
      if (isGuestMode) {
        setHistory((prev) => prev.filter((r) => r.id !== id));
        if (selectedAssessment?.id === id) {
          setSelectedAssessment(null);
        }
      }
      return;
    }
    try {
      const res = await fetch(`/api/history/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (res.ok) {
        setHistory((prev) => prev.filter((r) => r.id !== id));
        if (selectedAssessment?.id === id) {
          setSelectedAssessment(null);
        }
      }
    } catch (err) {
      console.error("Error deleting assessment:", err);
    }
  };

  const handleStartNew = () => {
    setSelectedAssessment(null);
    setProcessingError(null);
  };

  // If loading authentication state, show clean modern spinner
  if (loading) {
    return (
      <div id="auth-loading-screen" className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-zinc-100 border-t-indigo-600 rounded-full animate-spin"></div>
        <span className="text-2xs text-zinc-450 font-bold uppercase tracking-widest mt-4">
          Verifying secure credentials...
        </span>
      </div>
    );
  }

  // If not logged in, show beautiful academic Bento Grid login screen
  if (!user && !isGuestMode) {
    return (
      <div id="login-landing-container" className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 transition-colors duration-300">
        <header className="w-full bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 shadow-3xs transition-colors duration-300">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-display font-black text-lg shadow-lg">
                V
              </div>
              <div>
                <span className="block font-display font-black text-base tracking-tight text-zinc-950 dark:text-white">
                  Vantly
                </span>
                <span className="block text-4xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest leading-none mt-1">
                  See your business clearly
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all cursor-pointer shadow-sm border border-zinc-200/50 dark:border-zinc-750"
                title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
              >
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>
              <div className="flex items-center gap-1.5 text-2xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                Secure Database Online
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Main Welcome Bento Block */}
            <div className="lg:col-span-2 bg-zinc-900 text-white rounded-[2.5rem] p-10 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between gap-6 min-h-[360px]">
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500 rounded-full blur-[100px] opacity-20 -mr-20 -mt-20"></div>
              
              <div className="relative z-10 max-w-sm flex flex-col justify-between h-full">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
                    Vantly Assessment Portal
                  </span>
                  <h1 className="text-3xl sm:text-4xl font-display font-black tracking-tight mt-3 mb-4 leading-tight">
                    See your business clearly
                  </h1>
                  <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed font-medium">
                    Upload SME accounts as PDF or CSV. Our system leverages advanced Gemini models and direct UK sector percentiles to evaluate productivity leverage, gross margins, and liquidity health.
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-zinc-800 flex flex-wrap items-center gap-4 text-3xs font-mono text-zinc-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Database className="w-3.5 h-3.5 text-indigo-500" />
                    Cloud SQL Relational Storage
                  </span>
                  <span>•</span>
                  <span>Analytics Engine v2026</span>
                </div>
              </div>

              {/* High-quality CSS UI preview mock card */}
              <div className="relative z-10 hidden md:flex flex-col justify-between w-64 bg-zinc-950/70 border border-zinc-800/80 rounded-3xl p-5 shadow-2xl backdrop-blur-md self-center">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
                    <span className="text-3xs font-mono text-zinc-400 font-bold tracking-widest uppercase">Live Demo Metrics</span>
                  </div>
                  <span className="text-4xs font-bold text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-850">VAN v3</span>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <span className="text-4xs font-bold text-zinc-500 uppercase tracking-wider block">Company Name</span>
                    <span className="text-xs font-bold text-zinc-100 block mt-0.5 truncate">Sterling Manufacturing Ltd</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-4xs font-bold text-zinc-500 uppercase tracking-wider">Productivity Index</span>
                      <span className="text-2xs font-mono font-bold text-indigo-400">84 / 100</span>
                    </div>
                    <div className="w-full bg-zinc-800/80 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full" style={{ width: "84%" }}></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-zinc-900/60 p-2 rounded-xl border border-zinc-850">
                      <span className="text-4xs text-zinc-500 font-bold uppercase tracking-wider block">Gross Margin</span>
                      <span className="text-xs font-bold text-emerald-400 block mt-0.5">42.5%</span>
                    </div>
                    <div className="bg-zinc-900/60 p-2 rounded-xl border border-zinc-850">
                      <span className="text-4xs text-zinc-500 font-bold uppercase tracking-wider block">Operating Ratio</span>
                      <span className="text-xs font-bold text-indigo-400 block mt-0.5">18.2%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-4xs font-semibold text-indigo-300 bg-indigo-950/40 border border-indigo-900/30 px-2 py-1 rounded-lg">
                    <CheckCircle className="w-3 h-3 text-indigo-400 shrink-0" />
                    Verified via sectoral benchmarks
                  </div>
                </div>
              </div>
            </div>

            {/* Login Control Bento Block */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between items-center text-center min-h-[360px] transition-colors duration-300">
              <div className="w-full">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
                  <LogIn className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-display font-black text-zinc-950 dark:text-white mb-2">
                  Access Portal
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed max-w-xs mx-auto">
                  Sign in with Google to sync across devices and export to Docs, or explore instantly with Direct Guest Access.
                </p>
              </div>

              <div className="w-full space-y-3">
                <button
                  onClick={signInWithGoogle}
                  className="w-full py-3.5 px-6 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 active:bg-zinc-950 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-zinc-200 dark:shadow-none hover:shadow-xl transition-all cursor-pointer border border-transparent dark:border-zinc-700"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  Sign In with Google
                </button>

                <button
                  onClick={handleEnterAsGuest}
                  className="w-full py-3.5 px-6 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 active:bg-indigo-200 text-indigo-600 dark:text-indigo-400 font-bold text-sm rounded-2xl flex items-center justify-center gap-2 border border-indigo-100 dark:border-indigo-900/50 transition-all cursor-pointer shadow-xs"
                >
                  <ArrowRight className="w-4 h-4 shrink-0" />
                  Direct Access (Guest Mode)
                </button>
              </div>

              <div className="text-4xs text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
                No registration required for guest sessions
              </div>
            </div>

            {/* Minor Info Bento blocks */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-3xs hover:shadow-md transition-all flex flex-col justify-between min-h-[160px] transition-colors duration-300">
              <div>
                <div className="w-8 h-8 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/45 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                  <Users className="w-4 h-4" />
                </div>
                <span className="block text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">Labour Pillar</span>
                <h4 className="font-bold text-zinc-900 dark:text-white text-sm mb-1">Leverage & Personnel Output</h4>
                <p className="text-zinc-500 dark:text-zinc-400 text-2xs leading-relaxed">
                  Evaluates employee productivity metrics and payroll costs against certified regional SME datasets.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-3xs hover:shadow-md transition-all flex flex-col justify-between min-h-[160px] transition-colors duration-300">
              <div>
                <div className="w-8 h-8 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/45 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <span className="block text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">Financial Pillar</span>
                <h4 className="font-bold text-zinc-900 dark:text-white text-sm mb-1">Margin & Defensive Liquidity</h4>
                <p className="text-zinc-500 dark:text-zinc-400 text-2xs leading-relaxed">
                  Applies exact margin benchmarks and current ratio liquidity checks to analyze SME operating headroom.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-3xs hover:shadow-md transition-all flex flex-col justify-between min-h-[160px] transition-colors duration-300">
              <div>
                <div className="w-8 h-8 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/45 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="block text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">Workspace Integration</span>
                <h4 className="font-bold text-zinc-900 dark:text-white text-sm mb-1">Direct Google Docs Export</h4>
                <p className="text-zinc-500 dark:text-zinc-400 text-2xs leading-relaxed">
                  Export dynamic, fully formatted business assessment reports straight into Google Docs via Workspace APIs.
                </p>
              </div>
            </div>
          </div>
        </main>

        <footer className="w-full bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 py-6 px-6 mt-auto text-center text-4xs text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest transition-colors duration-300">
          Vantly • See your business clearly
        </footer>
      </div>
    );
  }

  // If logged in, show full application workspace
  return (
    <div className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 transition-colors duration-300">
      {/* Platform Header */}
      <header className="sticky top-0 z-20 w-full bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-[0_8px_30px_rgb(0,0,0,0.02)] px-6 py-4 transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-display font-black text-lg shadow-lg">
              V
            </div>
            <div>
              <span className="block font-display font-black text-base tracking-tight text-zinc-950 dark:text-white">
                Vantly
              </span>
              <span className="block text-4xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest leading-none mt-1">
                See your business clearly
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all cursor-pointer shadow-xs border border-zinc-200/50 dark:border-zinc-700"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setShowInfoModal(true)}
              className="px-3 py-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              <HelpCircle className="w-4 h-4" />
              Academic Specs
            </button>
            <div className="h-5 w-[1px] bg-zinc-200 dark:bg-zinc-850"></div>

            {user ? (
              <div className="flex items-center gap-3">
                {user.photoURL && (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "Researcher"}
                    className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-800"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="hidden md:block text-right">
                  <span className="block text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-none">
                    {user.displayName || "Academic Researcher"}
                  </span>
                  <span className="text-4xs text-zinc-400 dark:text-zinc-550 font-semibold truncate max-w-[150px] block mt-0.5">
                    {user.email}
                  </span>
                </div>
                <button
                  onClick={signOut}
                  className="px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-750 border border-rose-100 dark:border-rose-900/50 rounded-xl transition-all cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="hidden md:block text-right">
                  <span className="block text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-none">
                    Guest Session
                  </span>
                  <span className="text-4xs text-amber-600 dark:text-amber-500 font-bold uppercase tracking-wider block mt-0.5">
                    Local Storage Mode
                  </span>
                </div>
                <button
                  onClick={signInWithGoogle}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={handleExitGuestMode}
                  className="px-3 py-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-xl transition-all cursor-pointer border border-zinc-200 dark:border-zinc-700/60"
                >
                  Exit
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar: Assessment Records */}
          <div className="lg:col-span-1 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-800 pb-8 lg:pb-0 lg:pr-8">
            <HistoryList
              history={history}
              selectedId={selectedAssessment?.id || null}
              onSelect={(run) => setSelectedAssessment(run)}
              onDelete={handleDelete}
              onStartNew={handleStartNew}
            />
          </div>

          {/* Right Area: Workspace canvas (Form or Results) */}
          <div className="lg:col-span-3 min-h-[500px]">
            <AnimatePresence mode="wait">
              {selectedAssessment || isProcessing ? (
                <motion.div
                  key={selectedAssessment ? `results-${selectedAssessment.id}` : "results-loading"}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <ResultsDashboard
                    assessment={selectedAssessment}
                    isLoading={isProcessing}
                    loadingCompanyName={processingCompanyName}
                    loadingSector={processingSector}
                    onBack={handleStartNew}
                    onDelete={handleDelete}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <UploadForm
                    onStartAssessment={handleStartAssessment}
                    isLoading={isProcessing}
                    error={processingError}
                    setError={setProcessingError}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer credits */}
      <footer className="w-full bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 py-6 px-6 mt-auto text-center text-4xs text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest transition-colors duration-300">
        Vantly • See your business clearly • Powered by Gemini & Cloud SQL
      </footer>

      {/* Academic Framework Specs Modal */}
      <AnimatePresence>
        {showInfoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInfoModal(false)}
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-xs"
            ></motion.div>

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-2xl w-full p-8 relative z-10 max-h-[90vh] overflow-y-auto transition-colors duration-300"
            >
              <button
                onClick={() => setShowInfoModal(false)}
                className="absolute top-6 right-6 p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-2xl font-display font-black text-zinc-950 dark:text-white mb-6 flex items-center gap-2">
                <Award className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                MSc Academic Evaluation Metrics
              </h2>

              <div className="space-y-6 text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed">
                <div>
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-xs mb-1.5">
                    1. Labour Efficiency Pillar (0 - 50 Score)
                  </h4>
                  <p className="mb-2 font-medium">
                    Measures employee resource utilization. Compares company metrics directly against Nottingham's certified SME sectoral percentiles:
                  </p>
                  <ul className="list-disc list-inside space-y-1 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-150 dark:border-zinc-850 font-mono text-2xs text-zinc-700 dark:text-zinc-300">
                    <li>Component A (25 pts): Revenue per Employee = (Revenue / Headcount) vs Sector Median</li>
                    <li>Component B (25 pts): Payroll leverage = (Revenue / Payroll costs) vs Sector Median</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-xs mb-1.5">
                    2. Financial Health Pillar (0 - 50 Score)
                  </h4>
                  <p className="mb-2 font-medium">
                    Evaluates operating feasibility, profitability headroom, and liquidity safety runtimes:
                  </p>
                  <ul className="list-disc list-inside space-y-1 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-150 dark:border-zinc-850 font-mono text-2xs text-zinc-700 dark:text-zinc-300">
                    <li>Component A (25 pts): Gross & Operating Profit Margins vs Sector Median margins</li>
                    <li>Component B (25 pts): Liquidity ratio = Current Assets / Current Liabilities. Ideals: &ge;1.5</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-xs mb-1.5">
                    3. Digital Maturity diagnostic (0 - 100 Score)
                  </h4>
                  <p className="font-medium">
                    Tracks modern technology adoption (Xero, Salesforce, HubSpot, OCR integrations, automated bank feeds). Digital maturity operates as a leading indicator of productivity growth, but is separated from current financial indexes to ensure pure objective reporting.
                  </p>
                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 text-4xs font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
                  Research Framework: SMEs under 250 employees. Datasets derived from Companies House filings and regional sector analysis (NTU Business School guidelines, 2026).
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
