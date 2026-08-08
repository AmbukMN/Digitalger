#!/bin/bash
#
# BestTV — өгөгдлийн сангийн нөөцлөлт (локал + R2 гадна хуулбар).
#
# ⚠️⚠️ ЯАГААД ЧУХАЛ ВЭ: DB-д хэрэглэгч, төлбөр, захиалга, эзэмшлийн
# БҮХ бүртгэл байна. Postgres эвдрэх / диск гэмтэхэд R2-д видео
# үлдэнэ ч ХЭН ЮУ ХУДАЛДАЖ АВСНЫГ мэдэх арга байхгүй болно.
#
# ⚠️ ХОЁР ГАЗАР хадгална:
#   локал /opt/backups/db  — 14 хоног (хурдан сэргээлт)
#   R2 backups/db/         — 30 ширхэг (диск гэмтсэн ч үлдэнэ)
#
set -uo pipefail

DIR=/opt/backups/db
KEEP_DAYS=14
STAMP=$(date +%Y%m%d-%H%M)
NAME="besttv-$STAMP.sql.gz"
OUT="$DIR/$NAME"
LOG="$DIR/backup.log"

mkdir -p "$DIR"

# ── 1. Локал dump ────────────────────────────────────────────────
# ⚠️ `--clean --if-exists` — сэргээхэд хуучин объект зөрчилдөхгүй
if docker exec besttv-postgres pg_dump -U besttv -d besttv --clean --if-exists 2>/dev/null | gzip -9 > "$OUT"; then
  SIZE=$(stat -c%s "$OUT" 2>/dev/null || echo 0)
  # ⚠️ 10 KB-ээс бага бол ХООСОН dump — амжилтгүй гэж үзнэ
  if [ "$SIZE" -lt 10240 ]; then
    echo "$(date -Is) FAIL: dump хэт жижиг ($SIZE байт)" >> "$LOG"
    rm -f "$OUT"
    exit 1
  fi
  echo "$(date -Is) OK: $NAME — $((SIZE/1024)) KB" >> "$LOG"
else
  echo "$(date -Is) FAIL: pg_dump унав" >> "$LOG"
  rm -f "$OUT"
  exit 1
fi

# ── 2. R2 руу хуулбар ────────────────────────────────────────────
# ⚠️ Backend container дотроос (AWS SDK тэнд бий). Унасан ч локал
# нөөц үлдсэн тул script амжилтгүй гэж үзэхгүй.
# ⚠️ ЯГ ТЭР нэрээр хуулна — /tmp/<name> болгож огноог хадгална.
if docker cp "$OUT" "besttv-backend:/tmp/$NAME" 2>/dev/null; then
  if docker exec -w /app/backend besttv-backend node r2-backup-upload.js "/tmp/$NAME" >> "$LOG" 2>&1; then
    echo "$(date -Is) R2 OK: $NAME" >> "$LOG"
  else
    echo "$(date -Is) R2 WARN: хуулж чадсангүй (локал нөөц бий)" >> "$LOG"
  fi
  docker exec besttv-backend rm -f "/tmp/$NAME" 2>/dev/null || true
fi

# ── 3. Цэвэрлэгээ ────────────────────────────────────────────────
find "$DIR" -name "besttv-*.sql.gz" -mtime +$KEEP_DAYS -delete 2>/dev/null

# ⚠️ Логийг ч хязгаарлана (жилийн дараа мегабайт болохоос сэргийлнэ)
tail -n 300 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
