#!/bin/bash
set -e

# Only perform DB check if SQL_HOST is explicitly configured in environment
if [ -n "$SQL_HOST" ]; then
  echo "Checking database connectivity ($SQL_HOST:5432)..."
  COUNTER=0
  until nc -z -w 1 "$SQL_HOST" 5432 || [ $COUNTER -ge 5 ]; do
    echo "Database at $SQL_HOST:5432 not reachable yet ($COUNTER/5)..."
    sleep 1
    COUNTER=$((COUNTER+1))
  done

  if [ $COUNTER -lt 5 ]; then
    echo "Database connected! Running migrations..."
    npx drizzle-kit push --config=src/db/drizzle.config.ts || echo "Warning: Migration push skipped."
  else
    echo "Warning: Database check timed out for '$SQL_HOST'. Starting application..."
  fi
fi

echo "Starting Vantly application..."
export NODE_ENV=production
exec npm start

