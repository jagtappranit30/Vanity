import express from "express";
import path from "path";
import fs from "fs";
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

    if (!isPDF && !isCSV) {
      return res.status(400).json({ error: "Unsupported file format. Please upload a PDF or CSV financial document." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: "GEMINI_API_KEY environment variable is not configured. Please open the Settings > Secrets menu in AI Studio and define your Gemini API Key."
      });
    }

    // Initialize Gemini API client inside handler for lazy initialization
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });

    let mimeType = isPDF ? "application/pdf" : "text/csv";
    if (isCSV && !file.mimetype.includes("csv")) {
      mimeType = "text/plain"; // fallback for CSV content representation
    }

    // Prepare multi-part input for Gemini containing the file buffer and the instructions
    const documentPart = {
      inlineData: {
        data: file.buffer.toString("base64"),
        mimeType: mimeType,
      }
    };

    const promptText = `You are an elite SME Productivity & Financial Analyst.
Analyze the attached financial statement (which is a ${isPDF ? "PDF" : "CSV"} document) for an SME in the '${sector}' sector.

Your task is to:
1. Extract key financial metrics with highest precision. If a metric is not mentioned or cannot be calculated, use null.
   - revenue: annual total sales/revenue.
   - headcount: total number of employees.
   - cogs: Cost of Goods Sold or Cost of Sales.
   - payroll: Total wages/salaries expenses.
   - grossMargin: Gross Margin percentage (0-100).
   - operatingMargin: Operating profit margin percentage (0-100).
   - currentAssets: Current Assets from Balance sheet.
   - currentLiabilities: Current Liabilities from Balance sheet.
2. Scan for mentions of software systems, bookkeeping packages, digital ERP/CRM tools (e.g. QuickBooks, Xero, Sage, SAP, Excel).
3. Classify their digital maturity level as exactly 'Low', 'Medium', or 'High' based on these tools and process automation clues.
4. Formulate 3 to 5 highly practical, specific productivity improvement suggestions tailored to this specific firm's metrics.
5. Provide a crisp qualitative summary analyzing their bottlenecks and potential growth pathways.

You must return the result as a single JSON object matching the requested schema exactly.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [documentPart, promptText],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            companyName: {
              type: Type.STRING,
              description: "The name of the company if found, or null/empty if not present."
            },
            revenue: {
              type: Type.NUMBER,
              description: "Total annual revenue. If missing, use null."
            },
            headcount: {
              type: Type.INTEGER,
              description: "Total average number of employees. If missing, use null."
            },
            cogs: {
              type: Type.NUMBER,
              description: "Cost of Goods Sold / Cost of Sales. If missing, use null."
            },
            payroll: {
              type: Type.NUMBER,
              description: "Total wage/payroll cost. If missing, use null."
            },
            grossMargin: {
              type: Type.NUMBER,
              description: "Gross Profit Margin percentage (0 to 100). If missing, use null."
            },
            operatingMargin: {
              type: Type.NUMBER,
              description: "Operating Margin percentage (0 to 100). If missing, use null."
            },
            currentAssets: {
              type: Type.NUMBER,
              description: "Total current assets from Balance Sheet. If missing, use null."
            },
            currentLiabilities: {
              type: Type.NUMBER,
              description: "Total current liabilities from Balance Sheet. If missing, use null."
            },
            digitalTools: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Software tools, systems, or platforms explicitly mentioned or inferred from the report."
            },
            confidence: {
              type: Type.NUMBER,
              description: "Precision confidence score of extraction from 0 to 100."
            },
            extractedJustifications: {
              type: Type.STRING,
              description: "Short notes on where numbers were found (e.g., 'Revenue from Page 3 Income Statement, Headcount from Note 5')."
            },
            digitalMaturityLevel: {
              type: Type.STRING,
              description: "Must be exactly 'Low', 'Medium', or 'High'."
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 to 5 customized operational/financial recommendations."
            },
            qualitativeAnalysis: {
              type: Type.STRING,
              description: "An overall summary highlighting constraints and efficiency pathways."
            }
          },
          required: [
            "companyName",
            "revenue",
            "headcount",
            "digitalTools",
            "confidence",
            "extractedJustifications",
            "digitalMaturityLevel",
            "recommendations",
            "qualitativeAnalysis"
          ]
        }
      }
    });

    if (!response.text) {
      throw new Error("Empty response from Gemini assessment engine.");
    }

    const geminiResult = JSON.parse(response.text.trim());

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

    res.json(newRun);

  } catch (error: any) {
    console.error("Assessment error:", error);
    res.status(500).json({
      error: `Assessment failed: ${error.message || error}`
    });
  }
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
