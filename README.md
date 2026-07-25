# Vantly AI — SME Performance & Productivity Analyzer

Vantly is a full-stack AI-powered intelligence platform that analyzes SME (Small-to-Medium Enterprise) financial statements (PDFs and CSVs), evaluates key operational metrics, compares them against sector benchmarks, and generates strategic productivity improvements.

## 🚀 Features

- **Multi-Format Ingestion**: Upload financial statements in **PDF** or **CSV** formats.
- **Precision AI Extraction**: Extracts key operational metrics (Revenue, Headcount, Payroll, COGS, Assets, Liabilities) using the **Google GenAI SDK** with strict anti-hallucination guardrails and chain-of-thought verification.
- **Dual Engine Architecture**:
  - **Node.js + Express**: Core business logic, PostgreSQL database connection, Drizzle ORM integrations.
  - **Python FastAPI + RAG Engine**: Semantic vector search and context retrieval for answering user queries regarding statements.
- **Industry Benchmarking**: Automatically maps SME performance against industry median benchmarks (Services, Manufacturing, Retail, etc.).
- **Google Docs Integration**: Export detailed, structured productivity reports directly to Google Docs.
- **Interactive RAG Chat**: Chat with your financial documents to answer custom inquiries without manual document auditing.

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons, Motion (Framer Motion)
- **Backend Services**: Express.js (Node.js), FastAPI (Python 3)
- **Database & ORM**: PostgreSQL, Drizzle ORM
- **AI Integrations**: Google GenAI SDK (Gemini 2.5 Flash, Gemini 1.5 Flash), `pypdf` for semantic layout extraction

---

## 🐳 Running with Docker (Recommended)

Running Vantly via Docker Compose is the easiest way to spin up the entire application stack, including the PostgreSQL database, the Node Express backend, and the Python RAG microservice.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (installed and running)

### Setup Steps
1. Create a `.env` file in the root directory:
   ```bash
   GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
   ```
2. Start the services:
   ```bash
   docker-compose up --build
   ```
3. Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 💻 Running Locally (Development Mode)

If you prefer to run the application components individually on your host machine:

### 1. Prerequisites
- Node.js (v18+)
- Python (3.9+)
- PostgreSQL instance running locally or on the cloud

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY="your_api_key_here"

# Database Configuration
SQL_HOST="localhost"
SQL_DB_NAME="vantly"
SQL_USER="postgres"
SQL_PASSWORD="your_postgres_password"
SQL_ADMIN_USER="postgres"
SQL_ADMIN_PASSWORD="your_postgres_password"
```

### 3. Install & Start Node Backend & React Frontend
```bash
# Install dependencies
npm install

# Run database migration push
npx drizzle-kit push --config=src/db/drizzle.config.ts

# Start the application in development mode
npm run dev
```
*Note: The Node backend automatically spawns the Python RAG service as a subprocess in development mode.*

### 4. Install Python dependencies (for RAG service)
If running manually, set up the virtualenv:
```bash
cd rag_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```
