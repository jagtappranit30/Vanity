FROM node:20-bookworm-slim

# Install system dependencies (Python, virtualenv, netcat for readiness check)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files first
COPY package*.json ./
COPY rag_service/requirements.txt ./rag_service/requirements.txt

# Install Node dependencies
RUN npm install

# Create Python virtual environment and install dependencies
RUN python3 -m venv /app/rag_service/venv && \
    /app/rag_service/venv/bin/pip install --no-cache-dir --upgrade pip && \
    /app/rag_service/venv/bin/pip install --no-cache-dir -r /app/rag_service/requirements.txt

# Copy all application code
COPY . .

# Build the Vite frontend and compile server.ts
RUN npm run build

# Make the entrypoint script executable
RUN chmod +x entrypoint.sh

ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
