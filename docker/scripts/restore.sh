#!/bin/bash
# DigitalGer — PostgreSQL Restore Script
# Usage: ./docker/scripts/restore.sh /path/to/backup.sql.gz
# WARNING: This will REPLACE the current database. Use with caution.

set -euo pipefail

BACKUP_FILE="${1:-}"
ENV_FILE="/opt/DigitalGer/.env.production"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  echo "Latest backup: $(ls -t /opt/DigitalGer/backups/digitalger_*.sql.gz 2>/dev/null | head -1)"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Load env
if [ -f "$ENV_FILE" ]; then
  export $(grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB)=' "$ENV_FILE" | xargs)
fi

POSTGRES_USER="${POSTGRES_USER:-digitalger}"
POSTGRES_DB="${POSTGRES_DB:-digitalger}"

echo "WARNING: This will REPLACE the '${POSTGRES_DB}' database with: $BACKUP_FILE"
read -p "Type 'yes' to continue: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "[$(date)] Restoring from $BACKUP_FILE ..."

gunzip -c "$BACKUP_FILE" | docker compose -f /opt/DigitalGer/docker/docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "[$(date)] Restore complete."
