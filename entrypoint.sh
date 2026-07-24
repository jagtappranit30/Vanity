#!/bin/bash
set -e

echo "Waiting for database to be ready..."
until nc -z -w 1 "$SQL_HOST" 5432; do
  echo "Database at $SQL_HOST:5432 is unavailable - sleeping"
  sleep 1
done

echo "Database is up! Running migrations..."
npx drizzle-kit push --config=src/db/drizzle.config.ts

echo "Starting Vantly application..."
export NODE_ENV=production
exec npm start
