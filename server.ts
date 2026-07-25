import express from "express";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { FinancialMetrics, SectorBenchmarks, AssessmentScores, AssessmentRun } from "./src/types";
import { db } from "./src/db/index.ts";
import { assessments } from "./src/db/schema.ts";
import { requireAuth, optionalAuth, AuthRequest } from "./src/middleware/auth.ts";
import { eq } from "drizzle-orm";

dotenv.config();

// Spawn Python FastAPI RAG Microservice
let ragProcess: any = null;
function startRAGService() {
  const venvPython = path.join(process.cwd(), "rag_service", "venv", "bin", "python");
  const mainPy = path.join(process.cwd(), "rag_service", "main.py");

  if (!fs.existsSync(venvPython)) {
    console.warn("[RAG Service] Virtualenv python not found at:", venvPython);
    return;
  }

  console.log("[RAG Service] Starting Python FastAPI RAG engine on port 8000...");
  const ragEnv = { ...process.env };
  delete ragEnv.PORT;
  ragEnv.RAG_PORT = "8000";

  ragProcess = spawn(venvPython, [mainPy], {
    env: ragEnv,
    stdio: "inherit",
  });

  ragProcess.on("error", (err: any) => {
    console.error("[RAG Service] Failed to spawn Python RAG engine:", err);
  });

  ragProcess.on("exit", (code: number) => {
    console.log(`[RAG Service] Process exited with code ${code}`);
  });
}

// Call launcher
startRAGService();

const app = express();
const PORT = 3000;

// Setup in-memory file upload middleware (max 15MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

app.use(express.json());

// Sector benchmarks definition
const SECTOR_BENCHMARKS: Record<string, SectorBenchmarks> = {
  Manufacturing: {
    sector: "Manufacturing",
    revenue_per_employee: { p25: 120000, p50: 175000, p75: 240000 },
    output_per_payroll: { p25: 3.5, p50: 4.2, p75: 5.1 },
    gross_margin: { p25: 25, p50: 35, p75: 45 },
    operating_margin: { p25: 5, p50: 12, p75: 20 },
  },
  Services: {
    sector: "Services",
    revenue_per_employee: { p25: 100000, p50: 145000, p75: 210000 },
    output_per_payroll: { p25: 2.8, p50: 3.8, p75: 4.9 },
    gross_margin: { p25: 40, p50: 55, p75: 70 },
    operating_margin: { p25: 8, p50: 18, p75: 28 },
  },
  Retail: {
    sector: "Retail",
    revenue_per_employee: { p25: 150000, p50: 190000, p75: 250000 },
    output_per_payroll: { p25: 4.2, p50: 5.3, p75: 6.5 },
    gross_margin: { p25: 20, p50: 28, p75: 38 },
    operating_margin: { p25: 2, p50: 6, p75: 12 },
  },
  Other: {
    sector: "Other",
    revenue_per_employee: { p25: 110000, p50: 160000, p75: 220000 },
    output_per_payroll: { p25: 3.2, p50: 4.0, p75: 5.5 },
    gross_margin: { p25: 28, p50: 38, p75: 50 },
    operating_margin: { p25: 5, p50: 10, p75: 18 },
  },
};

// Local JSON database removed in favor of high-performance Cloud SQL PostgreSQL database

// Scoring logic
function calculateScores(metrics: any, sectorName: string): { scores: AssessmentScores, benchmarks: SectorBenchmarks } {
  const benchmarks = SECTOR_BENCHMARKS[sectorName] || SECTOR_BENCHMARKS["Other"];

  // 1. LABOUR EFFICIENCY (0-50)
  // Component A: Revenue per Employee (0-25)
  let revPerEmp = 0;
  let revPerEmpScore = 12.5; // default half if missing
  const refRevPerEmpP50 = benchmarks.revenue_per_employee.p50;

  if (metrics.revenue !== null && metrics.headcount !== null && metrics.headcount > 0) {
    revPerEmp = metrics.revenue / metrics.headcount;
    const ratio = revPerEmp / refRevPerEmpP50;
    revPerEmpScore = Math.min(Math.max(ratio * 12.5, 3), 25);
  }

  // Component B: Output per Payroll (0-25)
  let outputPerPayroll = 0;
  let outputPerPayrollScore = 12.5; // default half if missing
  const refOutputPerPayrollP50 = benchmarks.output_per_payroll.p50;

  if (metrics.revenue !== null && metrics.payroll !== null && metrics.payroll > 0) {
    outputPerPayroll = metrics.revenue / metrics.payroll;
    const ratio = outputPerPayroll / refOutputPerPayrollP50;
    outputPerPayrollScore = Math.min(Math.max(ratio * 12.5, 3), 25);
  }

  const labourEfficiencyScore = Math.round((revPerEmpScore + outputPerPayrollScore) * 10) / 10;

  // 2. FINANCIAL HEALTH (0-50)
  // Component A: Profit Margins (0-25)
  let grossMarginVal = metrics.grossMargin;
  if (grossMarginVal === null && metrics.revenue !== null && metrics.revenue > 0 && metrics.cogs !== null) {
    grossMarginVal = ((metrics.revenue - metrics.cogs) / metrics.revenue) * 100;
  }

  let grossMarginScore = 6.25; // default half
  if (grossMarginVal !== null) {
    const ratio = grossMarginVal / benchmarks.gross_margin.p50;
    grossMarginScore = Math.min(Math.max(ratio * 6.25, 1.5), 12.5);
  }

  let operatingMarginScore = 6.25; // default half
  if (metrics.operatingMargin !== null) {
    const ratio = metrics.operatingMargin / benchmarks.operating_margin.p50;
    operatingMarginScore = Math.min(Math.max(ratio * 6.25, 1.5), 12.5);
  }

  const marginScore = grossMarginScore + operatingMarginScore;

  // Component B: Liquidity (Current Ratio) (0-25)
  let currentRatio = 1.5;
  let liquidityScore = 12.5; // default
  if (metrics.currentAssets !== null && metrics.currentLiabilities !== null && metrics.currentLiabilities > 0) {
    currentRatio = metrics.currentAssets / metrics.currentLiabilities;
    if (currentRatio >= 1.5) {
      liquidityScore = 25;
    } else if (currentRatio >= 1.0) {
      // Linear scaling from 1.0 (15) to 1.5 (25)
      liquidityScore = 15 + ((currentRatio - 1.0) / 0.5) * 10;
    } else {
      liquidityScore = Math.max(3, currentRatio * 15);
    }
  }

  const financialHealthScore = Math.round((marginScore + liquidityScore) * 10) / 10;

  // 3. PRODUCTIVITY INDEX (0-100)
  const productivityIndex = Math.round((labourEfficiencyScore + financialHealthScore) * 10) / 10;

  // 4. DIGITAL MATURITY SCORE
  let toolsCount = metrics.digitalTools ? metrics.digitalTools.length : 0;
  let digitalMaturityScore = 30 + toolsCount * 12;
  const level = metrics.digitalMaturityLevel || "Medium";
  if (level === "High") digitalMaturityScore += 25;
  if (level === "Medium") digitalMaturityScore += 10;
  digitalMaturityScore = Math.min(Math.max(Math.round(digitalMaturityScore), 10), 100);

  const scores: AssessmentScores = {
    labourEfficiencyScore,
    labourDetails: {
      revenuePerEmployee: Math.round(revPerEmp),
      outputPerPayroll: Math.round(outputPerPayroll * 100) / 100,
      revenuePerEmployeeBenchmark: benchmarks.revenue_per_employee.p50,
      outputPerPayrollBenchmark: benchmarks.output_per_payroll.p50,
    },
    financialHealthScore,
    financialDetails: {
      grossMargin: grossMarginVal !== null ? Math.round(grossMarginVal * 10) / 10 : 0,
      operatingMargin: metrics.operatingMargin !== null ? Math.round(metrics.operatingMargin * 10) / 10 : 0,
      currentRatio: Math.round(currentRatio * 100) / 100,
      grossMarginBenchmark: benchmarks.gross_margin.p50,
      operatingMarginBenchmark: benchmarks.operating_margin.p50,
    },
    productivityIndex,
    digitalMaturityScore,
    digitalMaturityLevel: level as "Low" | "Medium" | "High",
    qualitativeAnalysis: metrics.qualitativeAnalysis || "Assessment completed successfully based on provided financials.",
    recommendations: metrics.recommendations && metrics.recommendations.length > 0 ? metrics.recommendations : [
      "Review current payroll allocation to optimize labour output.",
      "Track supplier expenses more accurately to raise gross margins.",
      "Explore standard automation software (ERPs, cloud bookkeeping) to improve digital flow."
    ]
  };

  return { scores, benchmarks };
}

// --- API ROUTES ---

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Get Benchmarks
app.get("/api/benchmarks", (req, res) => {
  res.json(SECTOR_BENCHMARKS);
});

// Get History
app.get("/api/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userUid = req.user!.uid;
    const runs = await db
      .select()
      .from(assessments)
      .where(eq(assessments.userUid, userUid));
    
    // Return descending sorted by date
    const sorted = runs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(sorted);
  } catch (error: any) {
    console.error("Failed to load assessments:", error);
    res.status(500).json({ error: "Failed to load assessment history from database." });
  }
});

// Get single assessment
app.get("/api/history/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userUid = req.user!.uid;
    const result = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, req.params.id));
    
    if (result.length === 0) {
      return res.status(404).json({ error: "Assessment run not found." });
    }
    
    const run = result[0];
    if (run.userUid !== userUid) {
      return res.status(403).json({ error: "Forbidden: You do not own this assessment." });
    }
    
    res.json(run);
  } catch (error: any) {
    console.error("Failed to load assessment details:", error);
    res.status(500).json({ error: "Failed to load assessment from database." });
  }
});

// Delete single assessment
app.delete("/api/history/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userUid = req.user!.uid;
    const result = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, req.params.id));
    
    if (result.length === 0) {
      return res.status(404).json({ error: "Assessment run not found." });
    }
    
    const run = result[0];
    if (run.userUid !== userUid) {
      return res.status(403).json({ error: "Forbidden: You do not own this assessment." });
    }
    
    await db.delete(assessments).where(eq(assessments.id, req.params.id));
    res.json({ success: true, message: "Assessment deleted successfully." });
  } catch (error: any) {
    console.error("Failed to delete assessment:", error);
    res.status(500).json({ error: "Failed to delete assessment from database." });
  }
});

// Export Assessment Report to Google Doc
app.post("/api/export-docs", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userUid = req.user!.uid;
    const { assessmentId, googleAccessToken } = req.body;

    if (!assessmentId) {
      return res.status(400).json({ error: "Missing assessmentId parameter." });
    }
    if (!googleAccessToken) {
      return res.status(400).json({ error: "Google access token is required to export reports." });
    }

    const result = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId));

    if (result.length === 0) {
      return res.status(404).json({ error: "Assessment run not found." });
    }

    const run = result[0];
    if (run.userUid !== userUid) {
      return res.status(403).json({ error: "Forbidden: You do not own this assessment." });
    }

    const metrics = run.metrics as any;
    const scores = run.scores as any;

    const { google } = await import("googleapis");
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: googleAccessToken });

    const docs = google.docs({ version: "v1", auth: oauth2Client });

    // Create a brand new Google Doc
    const docTitle = `${run.companyName} - Vantly Business Performance Report`;
    const createRes = await docs.documents.create({
      requestBody: {
        title: docTitle,
      },
    });

    const documentId = createRes.data.documentId;
    if (!documentId) {
      throw new Error("Failed to create Google Doc");
    }

    const textContent = `VANLY BUSINESS PERFORMANCE & PRODUCTIVITY REPORT
================================================================================
Company Name:       ${run.companyName}
Date of Assessment: ${new Date(run.date).toLocaleDateString()}
Sector / Industry:  ${run.sector}
Source Document:    ${run.fileName} (${run.fileType})
================================================================================

1. EXECUTIVE SUMMARY
--------------------------------------------------------------------------------
Vantly Productivity Index: ${scores.productivityIndex} / 100
Labour Efficiency Score:   ${scores.labourEfficiencyScore} / 50
Financial Health Score:    ${scores.financialHealthScore} / 50
Digital Maturity Level:    ${scores.digitalMaturityLevel} (Score: ${scores.digitalMaturityScore} / 100)

Expert Qualitative Overview:
${scores.qualitativeAnalysis}

2. KEY OPERATIONAL & FINANCIAL METRICS
--------------------------------------------------------------------------------
* LABOUR EFFICIENCY:
  - Revenue per Employee:  $${scores.labourDetails.revenuePerEmployee?.toLocaleString() || "N/A"}
    (Industry Median Benchmark: $${scores.labourDetails.revenuePerEmployeeBenchmark?.toLocaleString() || "N/A"})
  - Output per Payroll Ratio: ${scores.labourDetails.outputPerPayroll || "N/A"}x
    (Industry Median Benchmark: ${scores.labourDetails.outputPerPayrollBenchmark || "N/A"}x)

* FINANCIAL HEALTH:
  - Gross Profit Margin:   ${scores.financialDetails.grossMargin || "N/A"}%
    (Industry Median Benchmark: ${scores.financialDetails.grossMarginBenchmark || "N/A"}%)
  - Operating Profit Margin: ${scores.financialDetails.operatingMargin !== null ? scores.financialDetails.operatingMargin + "%" : "N/A"}
    (Industry Median Benchmark: ${scores.financialDetails.operatingMarginBenchmark || "N/A"}%)
  - Current Ratio (Liquidity): ${scores.financialDetails.currentRatio || "N/A"}x

3. DIGITAL TOOLS & ECOSYSTEM
--------------------------------------------------------------------------------
Identified Systems & Platforms:
${metrics.digitalTools && metrics.digitalTools.length > 0 ? metrics.digitalTools.map((t: string) => `  - ${t}`).join("\n") : "  - No software or bookkeeping packages explicitly detected."}

4. STRATEGIC PRODUCTIVITY RECOMMENDATIONS
--------------------------------------------------------------------------------
Based on this analysis, we recommend implementing the following high-impact operational improvements:

${scores.recommendations.map((rec: string, index: number) => `[${index + 1}] ${rec}`).join("\n\n")}

--------------------------------------------------------------------------------
Report generated automatically by Vantly - See your business clearly.
`;

    // Populate Google Doc with the generated report content
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: textContent,
            },
          },
        ],
      },
    });

    const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;
    res.json({ success: true, documentId, docUrl });

  } catch (error: any) {
    console.error("Google Docs Export Error:", error);
    res.status(500).json({ error: `Google Docs export failed: ${error.message || error}` });
  }
});

// Assess Document Endpoint
app.post("/api/assess", optionalAuth, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    const file = req.file;
    const sector = (req.body.sector || "Other") as string;
    const customCompanyName = req.body.companyName as string;

    if (!file) {
      return res.status(400).json({ error: "No file was uploaded. Please upload a PDF or CSV file." });
    }

    const fileExtension = path.extname(file.originalname).toUpperCase();
    const isPDF = fileExtension === ".PDF" || file.mimetype === "application/pdf";
    const isCSV = fileExtension === ".CSV" || file.mimetype === "text/csv" || file.mimetype === "application/vnd.ms-excel";

// Extract plain text from PDF or CSV buffer for offline Ollama processing
function extractTextForOllama(buffer: Buffer, isPDF: boolean): string {
  if (!isPDF) {
    return buffer.toString("utf-8");
  }
  const raw = buffer.toString("binary");
  const textBlocks: string[] = [];
  const regex = /\(([^)]+)\)\s*Tj|\[([^\]]+)\]\s*TJ/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    const text = match[1] || match[2];
    if (text) textBlocks.push(text.replace(/\\/g, ""));
  }
  if (textBlocks.length > 5) {
    return textBlocks.join(" ");
  }
  return buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
}

interface TaskLLMConfig {
  provider: "gemini" | "ollama";
  model: string;
  ollamaUrl?: string;
  geminiApiKey?: string;
}

// Multi-LLM Router by Use Case
function resolveTaskLLM(task: "assessment" | "rag" | "strategy"): TaskLLMConfig {
  const globalProvider = (process.env.LLM_PROVIDER || "").toLowerCase();
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

  const taskEnvPrefix = task.toUpperCase();
  const taskProvider = process.env[`${taskEnvPrefix}_LLM_PROVIDER`]?.toLowerCase() || globalProvider;

  let provider: "gemini" | "ollama" = "gemini";
  if (taskProvider === "ollama") {
    provider = "ollama";
  } else if (taskProvider === "gemini") {
    provider = "gemini";
  } else if (!geminiApiKey && ollamaUrl) {
    provider = "ollama";
  }

  let model = process.env[`${taskEnvPrefix}_MODEL`];
  if (!model) {
    if (provider === "gemini") {
      model = task === "assessment" ? "gemini-3.6-flash" : task === "rag" ? "gemini-3.6-flash" : "gemini-3.6-flash";
    } else {
      model = process.env.OLLAMA_MODEL || "llama3";
    }
  }

  return {
    provider,
    model,
    ollamaUrl,
    geminiApiKey,
  };
}

    const llmConfig = resolveTaskLLM("assessment");
    console.log(`[Multi-LLM Router] Task: Financial Assessment | Provider: ${llmConfig.provider.toUpperCase()} | Model: ${llmConfig.model}`);

    const useOllama = llmConfig.provider === "ollama";
    const apiKey = llmConfig.geminiApiKey;
    const ollamaUrl = llmConfig.ollamaUrl;
    const ollamaModel = llmConfig.model;

    let geminiResult: any = null;

    let mimeType = isPDF ? "application/pdf" : "text/csv";
    if (isCSV && !file.mimetype.includes("csv")) {
      mimeType = "text/plain"; // fallback for CSV content representation
    }

    const promptText = `You are an elite SME Productivity & Financial Analyst.
Analyze the attached financial statement (which is a ${isPDF ? "PDF" : "CSV"} document) for an SME in the '${sector}' sector.

CRITICAL ANTI-HALLUCINATION INSTRUCTIONS:
- In the "thoughtProcess" string, you MUST first perform step-by-step reasoning. Write down each metric you need to find, look for it, write down where it is, and verify the math before outputting any final number.
- You must ONLY extract numbers that are explicitly written in the attached text, or directly derivable from them with 100% mathematical certainty.
- NEVER guess, approximate, estimate, or extrapolate any of these metrics: revenue, headcount, cogs, payroll, grossMargin, operatingMargin, currentAssets, currentLiabilities.
- Micro-entity accounts in the UK or other regions frequently do NOT disclose headcount or payroll values. If headcount or payroll is not explicitly written in the document, you MUST return null. NEVER guess headcount based on company size or turnover.
- If a metric is missing, return null for that field. Do not use 0 as a default.
- In the "extractedJustifications" string, you MUST document the exact page number, table name, or section heading where you found each non-null value (e.g., "Revenue: Page 2, Statement of Profit or Loss, 'Turnover: £450,000'").
- If a metric is missing and returned as null, explicitly state in the "extractedJustifications" string that it was not found (e.g., "Headcount: Not disclosed in the uploaded accounts").
- Do NOT list hypothetical software tools in "digitalTools" simply because they are common in the industry; only list tools explicitly named or directly referred to in the document.

Your task is to:
1. First, reason and double-check all metrics inside the "thoughtProcess" block.
2. Extract key financial metrics with highest precision. If a metric is not mentioned or cannot be calculated, use null.
   - revenue: annual total sales/revenue.
   - headcount: total number of employees.
   - cogs: Cost of Goods Sold or Cost of Sales.
   - payroll: Total wages/salaries expenses.
   - grossMargin: Gross Margin percentage (0-100).
   - operatingMargin: Operating profit margin percentage (0-100).
   - currentAssets: Current Assets from Balance sheet.
   - currentLiabilities: Current Liabilities from Balance sheet.
3. Scan for mentions of software systems, bookkeeping packages, digital ERP/CRM tools (e.g. QuickBooks, Xero, Sage, SAP, Excel).
4. Classify their digital maturity level as exactly 'Low', 'Medium', or 'High' based on these tools and process automation clues.
5. Formulate 3 to 5 highly practical, specific productivity improvement suggestions tailored to this specific firm's metrics.
6. Provide a crisp qualitative summary analyzing their bottlenecks and potential growth pathways.

You must return the result as a single JSON object matching the requested schema exactly.`;

    if (useOllama) {
      let targetUrl = ollamaUrl || "http://localhost:11434";
      // Translate localhost -> host.docker.internal when running inside Docker container
      if (process.env.SQL_HOST === "db" && (targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1"))) {
        targetUrl = targetUrl.replace("localhost", "host.docker.internal").replace("127.0.0.1", "host.docker.internal");
      }

      console.log(`[Ollama Request] Calling local offline Ollama model '${ollamaModel}' at ${targetUrl}...`);
      const docText = extractTextForOllama(file.buffer, isPDF);

      const jsonFormatGuide = `
You MUST return ONLY a JSON object (no markdown, no backticks, no codeblocks) with this EXACT structure:
{
  "companyName": "Company Name string or null",
  "revenue": number or null,
  "headcount": integer or null,
  "cogs": number or null,
  "payroll": number or null,
  "grossMargin": number or null,
  "operatingMargin": number or null,
  "currentAssets": number or null,
  "currentLiabilities": number or null,
  "digitalTools": ["tool1", "tool2"],
  "confidence": number from 0 to 100,
  "thoughtProcess": "chain of thought reasoning",
  "extractedJustifications": "notes on metrics locations",
  "digitalMaturityLevel": "Low" or "Medium" or "High",
  "recommendations": ["suggestion 1", "suggestion 2"],
  "qualitativeAnalysis": "analysis summary text"
}
`;
      const fullPrompt = `${promptText}\n\n${jsonFormatGuide}\n\nDOCUMENT TEXT CONTENT:\n${docText}`;

      let ollamaRes: Response;
      try {
        ollamaRes = await fetch(`${targetUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: ollamaModel,
            prompt: fullPrompt,
            format: "json",
            stream: false,
            options: { temperature: 0.1 }
          })
        });
      } catch (netErr: any) {
        console.error(`[Ollama Network Error] Failed connecting to ${targetUrl}:`, netErr.message);
        throw new Error(`Unable to connect to local Ollama service at ${targetUrl}. Ensure Ollama is active or set LLM_PROVIDER=gemini.`);
      }

      if (!ollamaRes.ok) {
        const errText = await ollamaRes.text();
        throw new Error(`Ollama API error (${ollamaRes.status}): ${errText}`);
      }

      const ollamaData: any = await ollamaRes.json();
      const rawText = (ollamaData.response || "{}").trim();
      const cleanedText = rawText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
      geminiResult = JSON.parse(cleanedText);
    } else {
      if (!apiKey) {
        return res.status(400).json({
          error: "No LLM provider configured. Set GEMINI_API_KEY for Google Gemini, or set LLM_PROVIDER=ollama and OLLAMA_BASE_URL=http://localhost:11434 for local offline Ollama."
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const documentPart = {
        inlineData: {
          data: file.buffer.toString("base64"),
          mimeType: mimeType,
        }
      };

      const callGeminiWithRetry = async (models: string[], reqOptions: any, maxRetries = 3) => {
        let lastError: any = null;
        for (const modelName of models) {
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              console.log(`[Gemini Request] Calling model=${modelName} (Attempt ${attempt}/${maxRetries})...`);
              const res = await ai.models.generateContent({
                ...reqOptions,
                model: modelName,
              });
              if (res && res.text) {
                return res;
              }
            } catch (err: any) {
              lastError = err;
              console.warn(`[Gemini Retry Warning] Model ${modelName} attempt ${attempt} failed: ${err.message}`);
              if (attempt < maxRetries) {
                const backoffMs = attempt * 1500;
                await new Promise((resolve) => setTimeout(resolve, backoffMs));
              }
            }
          }
        }
        throw lastError || new Error("All Gemini model attempts failed.");
      };

      const response = await callGeminiWithRetry(
        ["gemini-3.6-flash", "gemini-2.0-flash", "gemini-2.5-pro"],
        {
          contents: [documentPart, promptText],
          config: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                companyName: { type: Type.STRING },
                revenue: { type: Type.NUMBER },
                headcount: { type: Type.INTEGER },
                cogs: { type: Type.NUMBER },
                payroll: { type: Type.NUMBER },
                grossMargin: { type: Type.NUMBER },
                operatingMargin: { type: Type.NUMBER },
                currentAssets: { type: Type.NUMBER },
                currentLiabilities: { type: Type.NUMBER },
                digitalTools: { type: Type.ARRAY, items: { type: Type.STRING } },
                confidence: { type: Type.NUMBER },
                thoughtProcess: { type: Type.STRING },
                extractedJustifications: { type: Type.STRING },
                digitalMaturityLevel: { type: Type.STRING },
                recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                qualitativeAnalysis: { type: Type.STRING }
              },
              required: [
                "companyName", "revenue", "headcount", "digitalTools", "confidence",
                "thoughtProcess", "extractedJustifications", "digitalMaturityLevel",
                "recommendations", "qualitativeAnalysis"
              ]
            }
          }
        }
      );

      if (!response.text) {
        throw new Error("Empty response from Gemini assessment engine.");
      }

      const rawText = response.text.trim();
      const cleanedText = rawText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
      geminiResult = JSON.parse(cleanedText);
    }

    // Merge custom name if provided
    const companyName = customCompanyName || geminiResult.companyName || "SME Enterprise";

    const metrics: FinancialMetrics = {
      companyName,
      revenue: geminiResult.revenue,
      headcount: geminiResult.headcount,
      cogs: geminiResult.cogs,
      payroll: geminiResult.payroll,
      grossMargin: geminiResult.grossMargin,
      operatingMargin: geminiResult.operatingMargin,
      currentAssets: geminiResult.currentAssets,
      currentLiabilities: geminiResult.currentLiabilities,
      digitalTools: geminiResult.digitalTools || [],
      confidence: geminiResult.confidence || 85,
      extractedJustifications: geminiResult.extractedJustifications || "Extracted using general ledger analysis."
    };

    // Run scoring engine against benchmarks
    const { scores, benchmarks } = calculateScores(geminiResult, sector);

    // Save assessment run to Cloud SQL database linked to authenticated user (if signed in)
    const id = Math.random().toString(36).substring(2, 11);
    
    const newRun: AssessmentRun = {
      id,
      date: new Date().toISOString(),
      companyName,
      sector,
      fileName: file.originalname,
      fileType: isPDF ? "PDF" : "CSV",
      metrics,
      scores,
      benchmarks,
    };

    if (req.user?.uid) {
      await db.insert(assessments).values({
        id: newRun.id,
        userUid: req.user.uid,
        date: newRun.date,
        companyName: newRun.companyName,
        sector: newRun.sector,
        fileName: newRun.fileName,
        fileType: newRun.fileType,
        metrics: newRun.metrics,
        scores: newRun.scores,
        benchmarks: newRun.benchmarks,
      });
    }

    // Auto-index document into Python RAG service
    try {
      const formData = new FormData();
      formData.append("doc_id", newRun.id);
      const blob = new Blob([file.buffer], { type: mimeType });
      formData.append("file", blob, file.originalname);

      fetch("http://127.0.0.1:8000/index", {
        method: "POST",
        body: formData,
      }).then(r => r.json()).then(resData => {
        console.log("[RAG Auto-Index] Document successfully indexed:", resData);
      }).catch(err => {
        console.warn("[RAG Auto-Index] Non-blocking index error:", err.message);
      });
    } catch (ragErr: any) {
      console.warn("[RAG Auto-Index Warning]:", ragErr.message);
    }

    res.json(newRun);

  } catch (error: any) {
    console.error("Assessment error:", error);
    res.status(500).json({
      error: `Assessment failed: ${error.message || error}`
    });
  }
});

// --- RAG PYTHON MICROSERVICE PROXY ENDPOINTS ---

// Check Python RAG service health
app.get("/api/rag/health", async (req, res) => {
  try {
    const response = await fetch("http://127.0.0.1:8000/health");
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(503).json({ status: "offline", error: "RAG microservice unavailable: " + err.message });
  }
});

// Query RAG system for document context & vector search QA
app.post("/api/rag/query", async (req, res) => {
  try {
    const { doc_id, question, top_k } = req.body;
    if (!doc_id || !question) {
      return res.status(400).json({ error: "doc_id and question are required." });
    }

    const response = await fetch("http://127.0.0.1:8000/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc_id, question, top_k: top_k || 4 }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to communicate with Python RAG engine: " + err.message });
  }
});

// Manual index document into RAG system
app.post("/api/rag/index", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const docId = req.body.doc_id;
    if (!file || !docId) {
      return res.status(400).json({ error: "file and doc_id are required." });
    }

    const formData = new FormData();
    formData.append("doc_id", docId);
    const blob = new Blob([file.buffer], { type: file.mimetype });
    formData.append("file", blob, file.originalname);

    const response = await fetch("http://127.0.0.1:8000/index", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to index document in RAG engine: " + err.message });
  }
});

// Catch-all 404 handler for /api routes to prevent HTML response fallthrough to Vite
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Custom error handling middleware for all API routes to ensure JSON responses instead of HTML fallbacks
app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[API Error Handler]:", err);
  res.status(err.status || err.statusCode || 500).json({
    error: err.message || "An unexpected error occurred on the API server."
  });
});

// Serve frontend application based on environment
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // In dev mode, mount Vite as middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In prod, serve compiled static files from dist
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running at http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer();
