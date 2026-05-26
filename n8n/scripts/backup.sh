#!/bin/sh
# DigitalGer n8n — Daily backup script
# Runs inside VPS via cron
# Exports workflows + credentials → keeps 7 local → uploads to R2

set -e

CONTAINER="digitalger-n8n"
BACKUP_DIR="/opt/DigitalGer/n8n/backups"
DATE=$(date +%Y%m%d-%H%M%S)
LOCAL_KEEP=7

# R2 config (set in cron environment or export before calling)
R2_BUCKET="${R2_BUCKET:-digitalger-assets}"
R2_PREFIX="n8n-backups"
R2_ENDPOINT="${R2_ENDPOINT}"
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

log "=== n8n backup started: $DATE ==="

# ── 1. Export workflows ───────────────────────────────────────────────────────
WORKFLOW_FILE="$BACKUP_DIR/workflows-$DATE.json"
docker exec "$CONTAINER" n8n export:workflow --all \
  --output="/home/node/backups/workflows-$DATE.json"
log "Workflows exported: $WORKFLOW_FILE"

# ── 2. Export credentials ─────────────────────────────────────────────────────
CRED_FILE="$BACKUP_DIR/credentials-$DATE.json"
docker exec "$CONTAINER" n8n export:credentials --all \
  --output="/home/node/backups/credentials-$DATE.json"
log "Credentials exported: $CRED_FILE"

# ── 3. Bundle into tar.gz ─────────────────────────────────────────────────────
ARCHIVE="$BACKUP_DIR/n8n-backup-$DATE.tar.gz"
tar -czf "$ARCHIVE" \
  -C "$BACKUP_DIR" \
  "workflows-$DATE.json" \
  "credentials-$DATE.json"
rm -f "$WORKFLOW_FILE" "$CRED_FILE"
log "Archive created: $ARCHIVE"

# ── 4. Upload to Cloudflare R2 ────────────────────────────────────────────────
if [ -n "$R2_ENDPOINT" ] && [ -n "$AWS_ACCESS_KEY_ID" ]; then
  aws s3 cp "$ARCHIVE" \
    "s3://$R2_BUCKET/$R2_PREFIX/$(basename $ARCHIVE)" \
    --endpoint-url "$R2_ENDPOINT" \
    --no-progress \
    2>&1 && log "Uploaded to R2: $R2_PREFIX/$(basename $ARCHIVE)" \
          || log "WARN: R2 upload failed — local backup kept"
else
  log "WARN: R2 credentials not set — skipping upload"
fi

# ── 5. Keep only last N local archives ───────────────────────────────────────
ARCHIVE_COUNT=$(ls -1 "$BACKUP_DIR"/n8n-backup-*.tar.gz 2>/dev/null | wc -l)
if [ "$ARCHIVE_COUNT" -gt "$LOCAL_KEEP" ]; then
  DELETE_COUNT=$((ARCHIVE_COUNT - LOCAL_KEEP))
  ls -1t "$BACKUP_DIR"/n8n-backup-*.tar.gz | tail -"$DELETE_COUNT" | xargs rm -f
  log "Deleted $DELETE_COUNT old local archive(s), kept $LOCAL_KEEP"
fi

log "=== Backup complete ==="
