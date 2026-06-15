#!/bin/bash
# DigitalGer — Production Deploy Script
# Usage: ./docker/scripts/deploy.sh [backend|frontend|admin|all]
# Default: all

set -euo pipefail

COMPOSE="docker compose -f /opt/DigitalGer/docker/docker-compose.prod.yml"
SERVICE="${1:-all}"

echo "[$(date)] Deploy started — service: $SERVICE"

cd /opt/DigitalGer

# Pull latest code
git pull origin main

if [ "$SERVICE" = "all" ]; then
  $COMPOSE up -d --build
elif [ "$SERVICE" = "backend" ]; then
  # ⚠️ Backend кодыг (email/queue/processor) зассан тохиолдолд zip-worker
  # ХУУЧИН код дээр үлдвэл bulk email гацдаг тул ЗААВАЛ хамт rebuild хийнэ.
  $COMPOSE up -d --build backend zip-worker
elif [ "$SERVICE" = "frontend" ] || [ "$SERVICE" = "admin" ]; then
  $COMPOSE up -d --build "$SERVICE"
else
  echo "Unknown service: $SERVICE"
  echo "Usage: $0 [backend|frontend|admin|all]"
  exit 1
fi

echo "[$(date)] Waiting for services to be healthy..."
sleep 12

# ⚠️ nginx нь upstream container-ийн IP-г ачаалах үед кэшэлдэг. Аливаа service-ийг
# rebuild хийхэд тэр шинэ IP авдаг тул nginx restart хийхгүй бол 502 гарна.
# Тиймээс deploy бүрийн дараа nginx-ийг ЗААВАЛ restart хийж шинэ IP-г аваачина.
echo "[$(date)] Restarting nginx (upstream IP refresh — 502-аас сэргийлнэ)..."
$COMPOSE restart nginx

# Health check
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "[$(date)] ✅ Backend health: OK"
else
  echo "[$(date)] ❌ Backend health check failed (HTTP $HTTP_CODE)"
  $COMPOSE logs --tail=50 backend
  exit 1
fi

# Сайтын гадаад хүртээмж шалгах (nginx → frontend 502 эсэхийг баталгаажуулна)
SITE_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://digitalger.mn || echo "000")
echo "[$(date)] Site (https://digitalger.mn): HTTP $SITE_CODE"

echo "[$(date)] Deploy complete"
$COMPOSE ps
