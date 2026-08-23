#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"

mkdir -p "$BACKUP_DIR"

# Source env for DATABASE_URL
set -a
source "$PROJECT_DIR/.env.production"
set +a

if [ "$DATABASE_URL" = "FILL_MANUALLY" ] || [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not configured in .env.production"
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/linky_backup_$TIMESTAMP.sql.gz"

echo "=== Linky Database Backup ==="
echo "$(date '+%Y-%m-%d %H:%M:%S')"
echo "Backing up to: $BACKUP_FILE"

pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

echo "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"

# Cleanup backups older than 7 days
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "linky_backup_*.sql.gz" -mtime +7 -delete

REMAINING=$(find "$BACKUP_DIR" -name "linky_backup_*.sql.gz" | wc -l)
echo "Backups retained: $REMAINING"
echo "=== Backup complete ==="
