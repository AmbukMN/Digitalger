#!/usr/bin/env bash
# BestTV deploy — local → VPS
#
# ⚠️⚠️ ЯАГААД ЭНЭ СКРИПТ ХЭРЭГТЭЙ ВЭ:
# `docker compose up -d --build` нь Docker layer кэш ашигладаг. COPY хийсэн
# файлын агуулга өөрчлөгдсөн ч зарим тохиолдолд кэшлэгдсэн layer-ыг дахин
# ашиглаж, ЗАСВАР BUILD-Д ОРОХГҮЙ үлддэг. Production дээр яг ийм зүйл
# болсон: эх кодод засвар байсан ч (`grep` баталсан) bundle-д ороогүй тул
# хэрэглэгч хуучин алдаагаа хараад, "засагдахгүй байна" гэж гомдож байв.
#
# Тиймээс BUILD_ID-г ЗААВАЛ шалгана — өөрчлөгдөөгүй бол засвар ороогүй.
#
# Хэрэглээ:
#   ./deploy.sh frontend            # нэг үйлчилгээ
#   ./deploy.sh frontend admin      # хэд хэдэн
#   ./deploy.sh --nocache frontend  # кэш огт ашиглахгүй (баталгаатай)

set -euo pipefail

VPS="root@62.238.47.2"
KEY="$HOME/.ssh/id_ed25519"
REMOTE="/opt/BestTV"
COMPOSE="docker compose -f docker-compose.prod.yml -p besttv"

NOCACHE=""
if [[ "${1:-}" == "--nocache" ]]; then
  NOCACHE="--no-cache"
  shift
fi

SERVICES=("$@")
if [[ ${#SERVICES[@]} -eq 0 ]]; then
  echo "Хэрэглээ: ./deploy.sh [--nocache] <service> [service...]"
  echo "  жишээ: ./deploy.sh frontend admin backend"
  exit 1
fi

cd "$(dirname "$0")"

# ── 1) Өөрчлөгдсөн файлуудыг rsync-ээр илгээх ──
# ⚠️ `.env.local` ХЭЗЭЭ Ч илгээхгүй (production .env-ийг дарж бичнэ)
echo "═══ 1) Файл илгээх ═══"
for svc in "${SERVICES[@]}"; do
  [[ -d "$svc/src" ]] || continue
  rsync -az --delete \
    -e "ssh -i $KEY" \
    --exclude 'node_modules' --exclude '.next' --exclude '.env.local' \
    "$svc/src/" "$VPS:$REMOTE/$svc/src/"
  echo "  ✅ $svc/src"
done
# shared багц өөрчлөгдсөн бол бүх апп-д нөлөөлнө
if [[ -d shared/src ]]; then
  rsync -az --delete -e "ssh -i $KEY" --exclude node_modules \
    shared/src/ "$VPS:$REMOTE/shared/src/"
  echo "  ✅ shared/src"
fi

# ── 2) BUILD_ID-г ӨМНӨ нь тэмдэглэх (засвар орсныг батлахад) ──
declare -A BEFORE
for svc in "${SERVICES[@]}"; do
  if [[ "$svc" == "frontend" || "$svc" == "admin" ]]; then
    BEFORE[$svc]=$(ssh -i "$KEY" "$VPS" \
      "docker exec besttv-$svc cat /app/$svc/.next/BUILD_ID 2>/dev/null || echo none")
  fi
done

# ── 3) Build + restart ──
echo "═══ 2) Build ${NOCACHE:+(кэшгүй)} ═══"
ssh -i "$KEY" "$VPS" "cd $REMOTE/docker && \
  $COMPOSE build $NOCACHE ${SERVICES[*]} 2>&1 | tail -3 && \
  $COMPOSE up -d --force-recreate ${SERVICES[*]} 2>&1 | tail -3"

# ── 4) ⚠️ BUILD_ID ӨӨРЧЛӨГДСӨН эсэхийг ЗААВАЛ шалгах ──
echo "═══ 3) Батлах ═══"
FAILED=0
for svc in "${SERVICES[@]}"; do
  [[ "$svc" == "frontend" || "$svc" == "admin" ]] || continue

  # Container дахин боссныг хүлээнэ
  for _ in $(seq 1 40); do
    ssh -i "$KEY" "$VPS" "docker exec besttv-$svc test -f /app/$svc/.next/BUILD_ID" 2>/dev/null && break
    sleep 3
  done

  AFTER=$(ssh -i "$KEY" "$VPS" \
    "docker exec besttv-$svc cat /app/$svc/.next/BUILD_ID 2>/dev/null || echo none")

  if [[ "${BEFORE[$svc]}" == "$AFTER" ]]; then
    echo "  ⚠️  $svc: BUILD_ID ӨӨРЧЛӨГДӨӨГҮЙ ($AFTER)"
    echo "      → Docker кэшээс болж засвар ОРООГҮЙ байж болзошгүй."
    echo "      → './deploy.sh --nocache $svc' ажиллуулна уу."
    FAILED=1
  else
    echo "  ✅ $svc: ${BEFORE[$svc]} → $AFTER"
  fi
done

exit $FAILED
