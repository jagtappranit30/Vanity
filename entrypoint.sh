#!/bin/bash
set -e

SQL_HOST="${SQL_HOST:-db}"

if [ -n "$SQL_HOST" ]; then
  echo "Waiting for database ($SQL_HOST:5432) to be ready..."
  COUNTER=0
  until nc -z -w 1 "$SQL_HOST" 5432 || [ $COUNTER -ge 30 ]; do
    echo "Database at $SQL_HOST:5432 is unavailable - sleeping ($COUNTER/30)"
    sleep 1
    COUNTER=$((COUNTER+1))
  done

  if [ $COUNTER -lt 30 ]; then
    echo "Database is up! Running migrations..."
    npx drizzle-kit push --config=src/db/drizzle.config.ts || echo "Warning: Migration push skipped or failed."
  else
    echo "Warning: Database readiness check timed out for host '$SQL_HOST'. Proceeding with application startup..."
  fi
fi

echo "Starting Vantly application..."
export NODE_ENV=production
exec npm start

