#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Creating PostgreSQL backup..."
docker compose exec -T postgres pg_dump -U postgres wow_community > "$BACKUP_DIR/wow_community-$STAMP.sql"

echo "Exporting recent chat messages..."
docker compose exec -T postgres psql -U postgres -d wow_community -c \
  "COPY (SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 50000) TO STDOUT WITH CSV HEADER" \
  > "$BACKUP_DIR/chat_messages-$STAMP.csv"

echo "Backups written to $BACKUP_DIR"
