#!/bin/bash
# DigitalGer — PostgreSQL Daily Backup Script
# Usage: ./docker/scripts/backup.sh
# Cron: 0 2 * * * /opt/DigitalGer/docker/scripts/backup.sh >> /opt/DigitalGer/logs/backup.log 2>&1

set -euo pipefail

BACKUP_DIR="/opt/DigitalGer/backups"
ENV_FILE="/opt/DigitalGer/.env.production"
RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Load env
if [ -f "$ENV_FILE" ]; then
  export $(grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB)=' "$ENV_FILE" | xargs)
fi

POSTGRES_USER="${POSTGRES_USER:-digitalger}"
POSTGRES_DB="${POSTGRES_DB:-digitalger}"
BACKUP_FILE="${BACKUP_DIR}/digitalger_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup → $BACKUP_FILE"

# Dump from running postgres container
docker compose -f /opt/DigitalGer/docker/docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup complete — size: $BACKUP_SIZE"

# Remove backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "digitalger_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Cleaned backups older than ${RETENTION_DAYS} days"

# Keep latest symlink
ln -sf "$BACKUP_FILE" "${BACKUP_DIR}/latest.sql.gz"
echo "[$(date)] Done"
