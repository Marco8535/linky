#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=== Linky Database Initialization ==="

if [ ! -f .env.production ]; then
  echo "ERROR: .env.production not found. Copy the template and fill in values first."
  exit 1
fi

# Source env for DATABASE_URL
set -a
source .env.production
set +a

if [ "$DATABASE_URL" = "FILL_MANUALLY" ] || [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not configured in .env.production"
  exit 1
fi

echo "Running Prisma migrations against production database..."
docker compose -f docker-compose.production.yml run --rm api \
  npx prisma migrate deploy --schema=./packages/prisma/prisma/schema.prisma

echo ""
echo "=== Database initialized successfully ==="
