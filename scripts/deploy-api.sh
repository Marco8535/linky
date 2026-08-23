#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=== Linky API Deployment ==="
echo "$(date '+%Y-%m-%d %H:%M:%S')"

# Pull latest code
echo "[1/4] Pulling latest code..."
git pull --ff-only

# Build Docker image
echo "[2/4] Building Docker image..."
docker compose -f docker-compose.production.yml build --no-cache

# Run database migrations
echo "[3/4] Running database migrations..."
docker compose -f docker-compose.production.yml run --rm api \
  npx prisma migrate deploy --schema=./packages/prisma/prisma/schema.prisma

# Deploy
echo "[4/4] Starting services..."
docker compose -f docker-compose.production.yml up -d

echo ""
echo "=== Deployment complete ==="
echo "Checking health..."
sleep 5
docker compose -f docker-compose.production.yml ps
