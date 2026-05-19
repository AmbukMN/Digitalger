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
elif [ "$SERVICE" = "backend" ] || [ "$SERVICE" = "frontend" ] || [ "$SERVICE" = "admin" ]; then
  $COMPOSE up -d --build "$SERVICE"
else
  echo "Unknown service: $SERVICE"
  echo "Usage: $0 [backend|frontend|admin|all]"
  exit 1
fi

echo "[$(date)] Waiting for services to be healthy..."
sleep 10

# Health check
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "[$(date)] ✅ Backend health: OK"
else
  echo "[$(date)] ❌ Backend health check failed (HTTP $HTTP_CODE)"
  $COMPOSE logs --tail=50 backend
fi

echo "[$(date)] Deploy complete"
$COMPOSE ps
