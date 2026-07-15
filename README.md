# Vantly

**See your business clearly.** Vantly is a full-stack productivity assessment platform for Small-to-Medium Enterprises (SMEs). Upload a financial document (PDF or CSV), and Vantly uses a local LLM to extract key metrics, score your business against sector benchmarks, and deliver actionable recommendations — all running 100% offline on your own hardware.

---

## Features

- **AI-Powered Financial Analysis** — Upload income statements, balance sheets, or general ledgers. Vantly uses Ollama (Qwen 2.5 7B by default) to extract revenue, headcount, COGS, payroll, margins, and liquidity figures with anti-hallucination guardrails.
- **Sector Benchmarking** — Scores are computed against industry-specific percentile benchmarks (Manufacturing, Services, Retail, Other) across labour efficiency and financial health dimensions.
- **Productivity Index** — A composite 0–100 score combining labour efficiency (revenue per employee, output per payroll) and financial health (gross/operating margins, current ratio).
- **RAG Document Q&A** — After assessment, ask follow-up questions about your uploaded document. A Python FastAPI microservice chunks, embeds, and retrieves relevant context using cosine similarity, then answers with the LLM.
- **Google Sign-In & Guest Mode** — Authenticated users get persistent assessment history stored in PostgreSQL. Guest users can run assessments immediately with rate limiting (10 per 15 minutes per IP).
- **Export Reports** — Download a detailed PDF report locally (via jsPDF) or export directly to Google Docs using the Google Docs API.
- **Digital Maturity Scoring** — Detects mentions of software tools, ERPs, and bookkeeping platforms in your documents and assigns a digital maturity level (Low / Medium / High).
- **100% Offline** — All LLM inference runs locally through Ollama. No data leaves your machine.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS v4, Framer Motion, Recharts, Lucide Icons |
| Backend | Express.js, TypeScript, esbuild |
| Database | PostgreSQL 15 (via Drizzle ORM) |
| Auth | Firebase Authentication (Google OAuth) |
| RAG Service | Python FastAPI, pypdf, NumPy (cosine similarity) |
| LLM | Ollama (Qwen 2.5:7B default, configurable) |
| Build | Vite, esbuild, Docker Compose |
| CI/CD | GitHub Actions (typecheck → build → Docker → deploy) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Browser (React SPA)                 │
│  UploadForm → ResultsDashboard → RAGChat → HistoryList   │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼───────────────────────────────────┐
│               Express.js Server (:3000)                  │
│                                                          │
│  /api/assess      – Upload & analyse documents           │
│  /api/history     – CRUD assessment runs (auth required) │
│  /api/export-docs – Export to Google Docs                 │
│  /api/rag/*       – Proxy to RAG microservice            │
│  /api/benchmarks  – Sector benchmark data                │
│  /api/health      – Health check                         │
└────┬──────────────────────────────────┬──────────────────┘
     │                                  │
     ▼                                  ▼
┌─────────────┐              ┌────────────────────┐
│ PostgreSQL  │              │ Python RAG Service  │
│   (:5432)   │              │      (:8000)        │
│             │              │                     │
│  users      │              │  /extract – PDF text│
│  assessments│              │  /index   – Chunk & │
│             │              │             embed   │
└─────────────┘              │  /query   – Vector  │
                             │             search  │
                             │  /health            │
                             └────────┬────────────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │  Ollama (:11434) │
                             │  qwen2.5:7b      │
                             └─────────────────┘
```

---

## Prerequisites

- **Docker Desktop** (recommended) — or Node.js 20+ and Python 3.11+ for local development
- **Ollama** — install from [ollama.com](https://ollama.com), then pull the default model:
  ```bash
  ollama pull qwen2.5:7b
  ```

---

## Quick Start (Docker)

1. **Clone the repository**
   ```bash
   git clone https://github.com/jagtappranit30/Vanity.git
   cd Vanity
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env if needed (defaults work out of the box with Docker)
   ```

3. **Start everything**
   ```bash
   docker compose up --build
   ```
   This spins up PostgreSQL, builds the app container (Node.js + Python), runs Drizzle migrations automatically, and starts the server.

4. **Open the app**
   ```
   http://localhost:3000
   ```

5. **Stop everything**
   ```bash
   docker compose down
   ```

---

## Local Development (Without Docker)

### 1. Database

Start a local PostgreSQL instance (e.g. via Homebrew, pgAdmin, or a container):
```bash
# Example with Docker (just the database)
docker run -d --name vantly-db \
  -e POSTGRES_DB=vantly \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15-alpine
```

### 2. Environment

```bash
cp .env.example .env
# Update SQL_HOST to "localhost" for local dev
```

### 3. Install Dependencies

```bash
# Node dependencies
npm install

# Python RAG service
cd rag_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..
```

### 4. Run Database Migrations

```bash
npx drizzle-kit push --config=src/db/drizzle.config.ts
```

### 5. Start the Dev Server

```bash
npm run dev
```

The Vite dev server with HMR starts at `http://localhost:3000`. The Express server and Python RAG microservice both start automatically.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `ollama` | LLM provider (only `ollama` supported) |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Default model for all tasks |
| `ASSESSMENT_MODEL` | (inherits `OLLAMA_MODEL`) | Override model for financial assessment |
| `RAG_MODEL` | (inherits `OLLAMA_MODEL`) | Override model for RAG queries |
| `STRATEGY_MODEL` | (inherits `OLLAMA_MODEL`) | Override model for strategy tasks |
| `SQL_HOST` | `db` (Docker) / `localhost` | PostgreSQL host |
| `SQL_USER` | `postgres` | PostgreSQL username |
| `SQL_PASSWORD` | `postgres` | PostgreSQL password |
| `SQL_DB_NAME` | `vantly` | PostgreSQL database name |
| `OPENAI_API_KEY` | — | Optional, only for RAGAS evaluation scoring |

---

## Project Structure

```
vantly/
├── src/
│   ├── App.tsx                     # Main application component
│   ├── main.tsx                    # React entry point
│   ├── types.ts                    # Shared TypeScript interfaces
│   ├── index.css                   # Global styles
│   ├── components/
│   │   ├── UploadForm.tsx          # File upload & sector selection
│   │   ├── ResultsDashboard.tsx    # Score visualisation & charts
│   │   ├── RAGChat.tsx             # Document Q&A chat interface
│   │   ├── HistoryList.tsx         # Assessment history sidebar
│   │   └── VantlyLogo.tsx          # Brand logo component
│   ├── context/
│   │   └── AuthContext.tsx         # Firebase Auth provider
│   ├── db/
│   │   ├── schema.ts              # Drizzle ORM schema (users, assessments)
│   │   ├── drizzle.config.ts       # Drizzle configuration
│   │   └── index.ts               # Database connection
│   ├── lib/
│   │   ├── firebase.ts            # Firebase client SDK setup
│   │   └── firebase-admin.ts      # Firebase Admin SDK (server-side auth)
│   ├── middleware/
│   │   └── auth.ts                # Express auth middleware (JWT verification)
│   └── utils/
│       └── pdfGenerator.ts        # Client-side PDF report generation
├── server.ts                       # Express API server (assessment engine, RAG proxy)
├── rag_service/
│   ├── main.py                    # FastAPI entry point
│   ├── rag_engine.py              # Vector store, chunking, embeddings, querying
│   └── requirements.txt           # Python dependencies
├── eval/                           # RAGAS evaluation harness (see eval/README.md)
├── Dockerfile                      # Multi-stage production build
├── docker-compose.yml              # Full stack orchestration
├── entrypoint.sh                   # Container startup (migration + launch)
├── firestore.rules                 # Firestore security rules
├── .github/workflows/ci-cd.yml    # CI/CD pipeline
├── vite.config.ts                  # Vite build configuration
├── tsconfig.json                   # TypeScript configuration
└── package.json                    # Node.js dependencies & scripts
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | — | Server health check |
| `GET` | `/api/benchmarks` | — | Sector benchmark data |
| `POST` | `/api/assess` | Optional | Upload document for assessment |
| `GET` | `/api/history` | Required | List user's assessment history |
| `GET` | `/api/history/:id` | Required | Get a specific assessment |
| `DELETE` | `/api/history/:id` | Required | Delete an assessment |
| `POST` | `/api/export-docs` | Required | Export assessment to Google Docs |
| `GET` | `/api/rag/health` | Optional | RAG microservice health |
| `POST` | `/api/rag/index` | Optional | Index a document for RAG |
| `POST` | `/api/rag/query` | Optional | Query indexed document |

---

## Scoring Methodology

**Productivity Index (0–100)** = Labour Efficiency (0–50) + Financial Health (0–50)

### Labour Efficiency (0–50)
- **Revenue per Employee** — compared against sector P50 benchmark (25 pts max)
- **Output per Payroll** — revenue ÷ payroll vs. sector P50 (25 pts max)

### Financial Health (0–50)
- **Profit Margins** — gross and operating margins vs. sector benchmarks (25 pts max)
- **Liquidity** — current ratio scoring: ≥1.5 = full marks, 1.0–1.5 = scaled, <1.0 = penalised (25 pts max)

Missing metrics default to baseline scores rather than zero — the system is designed for UK micro-entity accounts that often omit headcount, payroll, or operating margins.

---

## Evaluation

The `eval/` directory contains a RAGAS-based evaluation harness for the RAG pipeline. It uses hand-written QA pairs against synthetic financial fixtures to measure faithfulness, context precision, context recall, and answer relevancy.

```bash
cd eval
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python evaluate.py
```

See [eval/README.md](eval/README.md) for full documentation.

---

## CI/CD

The GitHub Actions pipeline (`.github/workflows/ci-cd.yml`) runs on every push to `main`:

1. **Node.js** — TypeScript typecheck + production build
2. **Python** — Syntax verification of RAG service
3. **Docker** — Full container build validation
4. **Deploy** — Optional Render deploy hook on `main` push

---

## License

This project is proprietary. All rights reserved.
