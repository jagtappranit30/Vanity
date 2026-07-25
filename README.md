<div align="center">

# Vantly
### *Financial Health & Productivity Assessment Platform*

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-20-5FA04E?style=flat-square&logo=node.js)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python)](https://www.python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql)](https://www.postgresql.org)
[![Firebase](https://img.shields.io/badge/Firebase-Auth-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)](https://www.docker.com)
[![CI/CD Pipeline](https://github.com/jagtappranit30/Vanity/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/jagtappranit30/Vanity/actions)

> **Vantly** is a full-stack financial health & productivity assessment platform designed for SMEs. Upload a financial document (PDF or CSV), choose your industry sector, and receive an in-depth automated analysis covering labour efficiency, financial health, digital maturity, and benchmarked sector comparisons.

</div>

---

## Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🧰 Tech Stack](#-tech-stack)
- [🚀 Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development (without Docker)](#local-development-without-docker)
  - [Running with Docker Compose](#running-with-docker-compose)
- [⚙️ Environment Variables](#️-environment-variables)
- [📂 Project Structure](#-project-structure)
- [🔒 Authentication & Security](#-authentication--security)
- [🤖 AI & RAG System](#-ai--rag-system)
- [📊 Assessment Scoring Model](#-assessment-scoring-model)
- [🐳 Docker Deployment](#-docker-deployment)
- [🗃️ Database Schema](#️-database-schema)

---

## ✨ Features

| Feature | Description |
|---|---|
| 📄 **Document Upload** | Drag-and-drop PDF or CSV upload (up to 15MB) with sector classification |
| 🤖 **AI Analysis** | Gemini-powered extraction of financial metrics, KPIs, and narrative insights |
| 📊 **Results Dashboard** | Interactive charts for labour efficiency, financial health, and digital maturity scores |
| 💬 **RAG Chat Assistant** | Ask natural-language questions about your uploaded document with page-level citations |
| 📈 **Sector Benchmarking** | Compare your metrics against P25/P50/P75 industry benchmarks across Manufacturing, Services, Retail, and more |
| 🕑 **Assessment History** | Persistent, per-user history stored in Firestore and PostgreSQL |
| 🌙 **Dark/Light Mode** | Full theme support with smooth transitions |
| 🔐 **Firebase Auth** | Secure user authentication with email/password sign-up and sign-in |
| 📤 **PDF Export** | Download a detailed assessment report as a PDF |
| 🐳 **Dockerized** | Full Docker Compose setup for one-command deployment |

---

## 🏗️ Architecture

Vantly follows a **polyglot microservices architecture**. Three services run in one Docker Compose network:

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Browser                          │
│                    React 19 + Vite Frontend                     │
│            (Auth, Upload, Dashboard, RAG Chat UI)               │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP :3000
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Node.js / Express Server                    │
│                     (TypeScript — server.ts)                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  /api/assess  → Gemini SDK → Financial metric extraction │   │
│  │  /api/upload  → Multer → File buffer → RAG indexing     │   │
│  │  /api/rag/*   → Proxy → Python RAG microservice         │   │
│  │  /api/history → Drizzle ORM → PostgreSQL                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────┬───────────────────────┬───────────────────────┘
                  │ SQL (pg)              │ HTTP :8000
                  ▼                       ▼
┌─────────────────────────┐  ┌───────────────────────────────────┐
│  PostgreSQL 15 Database  │  │   Python FastAPI RAG Microservice │
│  (Drizzle ORM schema)    │  │   pypdf + Gemini text-embedding   │
│  - users                 │  │   In-memory vector store          │
│  - assessments           │  │   /index  → chunk + embed PDF    │
└─────────────────────────┘  │   /query  → cosine similarity +  │
                              │            Gemini answer          │
                              └───────────────────────────────────┘
                                        ↑
                              Firebase Auth (token verification)
                              Cloud Firestore (assessment history)
```

---

## 🧰 Tech Stack

### Frontend
- **React 19** with TypeScript — Component-based UI
- **Vite 6** — Blazing-fast dev server and bundler
- **Tailwind CSS 4** — Utility-first styling
- **Recharts** — Interactive financial charts and visualisations
- **Framer Motion** — Smooth animations and transitions
- **Lucide React** — Icon library
- **jsPDF** — Client-side PDF report generation

### Backend (Node.js)
- **Express 4** — REST API server
- **TypeScript** compiled via `tsx` for development
- **Drizzle ORM** — Type-safe PostgreSQL schema and queries
- **Multer** — Multipart file upload handling
- **Firebase Admin SDK** — Server-side token verification
- **`@google/genai` SDK** — Gemini 2.5 Flash AI integration

### RAG Microservice (Python)
- **FastAPI** — Async REST API for document AI
- **pypdf** — PDF text extraction and chunking
- **Google Generative AI Python SDK** — Text embedding (`text-embedding-004`)
- **NumPy** — Cosine similarity calculations for vector search
- **Uvicorn** — ASGI server

### Infrastructure
- **PostgreSQL 15** — Persistent relational data store
- **Firebase Authentication** — User identity and session management
- **Cloud Firestore** — Assessment history (NoSQL secondary store)
- **Docker + Docker Compose** — Containerised local and cloud deployments

---

## 🚀 Getting Started

### Prerequisites

- [Docker](https://www.docker.com/get-started) & Docker Compose v2+ *(recommended)*
- **Or** Node.js 20+, Python 3.11+, PostgreSQL 15 for local development
- A [Google AI Studio](https://aistudio.google.com) API key (Gemini)
- A [Firebase project](https://console.firebase.google.com) with Authentication and Firestore enabled

---

### Local Development (without Docker)

**1. Clone the repository**

```bash
git clone https://github.com/jagtappranit30/Vanity.git
cd Vanity
```

**2. Install Node.js dependencies**

```bash
npm install
```

**3. Set up the Python RAG service**

```bash
cd rag_service
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

**4. Configure environment variables**

```bash
cp .env.example .env
# Edit .env and fill in your credentials (see Environment Variables section)
```

**5. Push the database schema**

```bash
npx drizzle-kit push
```

**6. Start all services**

Open two terminals:

```bash
# Terminal 1 — Node.js backend + React frontend
npm run dev

# Terminal 2 — Python RAG microservice
cd rag_service && source venv/bin/activate
python main.py
```

The app will be available at `http://localhost:3000`.

---

### Running with Docker Compose

The easiest way to run the full stack locally:

**1. Clone and configure**

```bash
git clone https://github.com/jagtappranit30/Vanity.git
cd Vanity
cp .env.example .env
# Edit .env with your GEMINI_API_KEY and Firebase credentials
```

**2. Build and start all containers**

```bash
docker-compose up --build
```

This will start three services:
| Service | Container | Port |
|---|---|---|
| PostgreSQL | `vantly-db` | `5432` |
| App (Node + React + Python) | `vantly-app` | `3000` |

**3. Open the app**

Navigate to [http://localhost:3000](http://localhost:3000).

**4. Stopping the stack**

```bash
docker-compose down           # Stop containers
docker-compose down -v        # Stop and remove the database volume
```

---

## ⚙️ Environment Variables

# ── LLM Provider Selection ─────────────────────────────────
LLM_PROVIDER=gemini             # Options: "gemini" (cloud) or "ollama" (local offline)

# ── Cloud LLM (Gemini) ────────────────────────────────────
GEMINI_API_KEY=your-api-key-here

# ── Local Offline LLM (Ollama) ─────────────────────────────
OLLAMA_BASE_URL=http://localhost:11434  # inside Docker: http://host.docker.internal:11434
OLLAMA_MODEL=llama3                    # Model installed via `ollama pull llama3`

# ── Database (Local Dev) ──────────────────────────────────
SQL_HOST=localhost
SQL_PORT=5432
SQL_DB_NAME=vantly
SQL_USER=postgres
SQL_PASSWORD=postgres

# ── Firebase (Admin SDK — server-side) ────────────────────
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ── App URL ────────────────────────────────────────────────
APP_URL=http://localhost:3000
```

> **Note:** Firebase client-side configuration (API key, Auth domain, etc.) is embedded in [`src/lib/firebase.ts`](file:///Users/pranitjagtap/Downloads/vantly/src/lib/firebase.ts). Update this file with your Firebase web app credentials.

---

## 📂 Project Structure

```
vantly/
├── src/                        # Frontend source (React + TypeScript)
│   ├── components/
│   │   ├── UploadForm.tsx       # Document upload with sector selection
│   │   ├── ResultsDashboard.tsx # Charts, scores, and recommendations
│   │   ├── RAGChat.tsx          # AI document chat interface
│   │   ├── HistoryList.tsx      # Past assessment browser
│   │   └── VantlyLogo.tsx       # Branded logo component
│   ├── context/
│   │   ├── AuthContext.tsx      # Firebase Auth context provider
│   │   └── ThemeContext.tsx     # Dark/light mode context provider
│   ├── db/
│   │   ├── index.ts             # Drizzle ORM database connection
│   │   ├── schema.ts            # PostgreSQL table definitions
│   │   ├── users.ts             # User queries
│   │   └── drizzle.config.ts    # Drizzle Kit migration config
│   ├── lib/
│   │   ├── firebase.ts          # Firebase client-side config
│   │   └── firebase-admin.ts    # Firebase Admin SDK setup
│   ├── middleware/
│   │   └── auth.ts              # Express JWT middleware
│   ├── utils/                   # Scoring helpers and utilities
│   ├── types.ts                 # Shared TypeScript interfaces
│   ├── App.tsx                  # Root application component & routing
│   └── main.tsx                 # Vite entry point
│
├── rag_service/                 # Python FastAPI microservice
│   ├── main.py                  # FastAPI routes (/health, /index, /query)
│   ├── rag_engine.py            # Vector store + Gemini embedding logic
│   └── requirements.txt         # Python dependencies
│
├── server.ts                    # Express server (all API routes)
├── Dockerfile                   # Multi-stage build (Node + Python)
├── entrypoint.sh                # Docker startup script (waits for DB, runs migrations)
├── docker-compose.yml           # Full stack orchestration
├── vite.config.ts               # Vite + Tailwind configuration
├── firestore.rules              # Firestore security rules
└── .env.example                 # Environment variable template
```

---

## 🔒 Authentication & Security

Vantly uses **Firebase Authentication** for user identity management:

- Users sign up / sign in via email and password in the React frontend.
- Firebase issues a **JWT ID token** which is attached to every API request as a `Bearer` token in the `Authorization` header.
- The Express server verifies this token using the **Firebase Admin SDK** before processing any protected endpoint.
- **Firestore Security Rules** enforce strict per-user data isolation:
  - Users can only read/write their own documents.
  - Assessments are immutable after creation (no `update` allowed).
  - A global deny-all rule blocks any unmatched access patterns.

---

## 🤖 AI & RAG System

### Gemini AI Assessment (`server.ts`)

When a document is uploaded, the Express server:
1. Extracts text from the PDF/CSV using Gemini's file API.
2. Sends a structured prompt to **Gemini 2.5 Flash** requesting JSON extraction of financial metrics (revenue, headcount, COGS, payroll, margins, digital tools, etc.).
3. Returns a validated `FinancialMetrics` object to the frontend.

### Python RAG Microservice (`rag_service/`)

A separate **FastAPI** service provides grounded, document-level Q&A:

1. **`POST /index`** — Accepts a PDF file, chunks it into overlapping text segments, generates embeddings via Gemini's `text-embedding-004` model, and stores them in an in-memory vector store.
2. **`POST /query`** — Takes a question and `doc_id`, performs cosine similarity search to find the top-K most relevant chunks, and sends them as context to Gemini for a grounded answer with page citations.
3. **`GET /health`** — Returns service status, Gemini API configuration state, and indexed document count.

The Node.js server acts as a **transparent proxy** for all RAG requests, forwarding them from the frontend to the Python service.

---

## 📊 Assessment Scoring Model

Vantly computes a **0–100 Productivity Index** from two pillars:

### Labour Efficiency Score (0–50 points)
| Metric | Description |
|---|---|
| Revenue per Employee | Benchmarked against sector P50 |
| Output per Payroll | Payroll efficiency vs. sector median |

### Financial Health Score (0–50 points)
| Metric | Description |
|---|---|
| Gross Margin | Compared to sector P25/P50/P75 |
| Operating Margin | Profitability relative to peers |
| Current Ratio | Liquidity (Current Assets / Current Liabilities) |

### Digital Maturity (0–100, qualitative)
Assessed by counting identified digital tools (ERP, CRM, e-commerce platforms, automation software, etc.) and classifying into **Low / Medium / High** maturity bands.

Sector benchmarks are available for **Manufacturing**, **Professional Services**, **Retail & Commerce**, and **General / Other**.

---

## 🐳 Docker Deployment

The [Dockerfile](file:///Users/pranitjagtap/Downloads/vantly/Dockerfile) uses a single-stage build that runs both the Node.js and Python environments:

1. Starts from `node:20-bookworm-slim`.
2. Installs Python 3, `python3-venv`, and `netcat-openbsd` via `apt-get`.
3. Installs Node.js dependencies (`npm ci`).
4. Creates a Python virtual environment and installs RAG service dependencies.
5. Runs `vite build` to produce the static React frontend.
6. Uses [entrypoint.sh](file:///Users/pranitjagtap/Downloads/vantly/entrypoint.sh) as the container entrypoint, which:
   - Waits for PostgreSQL to be ready (`nc` port check).
   - Runs `drizzle-kit push` to apply the latest schema.
   - Starts the Python RAG service in the background.
   - Starts the Node.js production server.

```bash
# Build only
docker-compose build

# Full stack up (detached)
docker-compose up -d

# View logs
docker-compose logs -f app

# Tear down
docker-compose down
```

---

## 🗃️ Database Schema

Managed by **Drizzle ORM** with automatic schema push via `drizzle-kit push`.

```
users
 ├── id          (serial, primary key)
 ├── uid         (text, unique) — Firebase UID
 └── email       (text)

assessments
 ├── id          (text, primary key) — UUID
 ├── user_id     (integer, FK → users.id)
 ├── company_name (text)
 ├── sector      (text)
 ├── file_name   (text)
 ├── file_type   (text: 'PDF' | 'CSV')
 ├── metrics     (jsonb) — extracted FinancialMetrics
 ├── scores      (jsonb) — computed AssessmentScores
 ├── benchmarks  (jsonb) — SectorBenchmarks used
 └── created_at  (timestamp, default: now)
```

---

<div align="center">

Built with ❤️ using React, Node.js, Python, and PostgreSQL.

</div>
