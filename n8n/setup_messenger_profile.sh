#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# DigitalGer FB Messenger Profile тохиргоо (Welcome + Persistent Menu + Ice Breakers)
# Нэг удаа ажиллуулна. FB_PAGE_ACCESS_TOKEN-ийг /opt/DigitalGer/n8n/.env-ээс авна.
# Ажиллуулах: bash setup_messenger_profile.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e
source /opt/DigitalGer/n8n/.env
TOKEN="$FB_PAGE_ACCESS_TOKEN"
API="https://graph.facebook.com/v21.0/me/messenger_profile?access_token=$TOKEN"
SITE="https://digitalger.mn"

echo "=== 1. Get Started товч (анх орж ирэхэд) ==="
curl -s -X POST "$API" -H "Content-Type: application/json" -d '{
  "get_started": { "payload": "GET_STARTED" }
}' | head -c 200; echo

echo "=== 2. Greeting (Welcome дэлгэцэд, анх удаа) ==="
curl -s -X POST "$API" -H "Content-Type: application/json" -d '{
  "greeting": [{
    "locale": "default",
    "text": "Сайн байна уу! 👋 DigitalGer.mn — Монголын дижитал бүтээгдэхүүний онлайн дэлгүүрт тавтай морилно уу. Бэлэн төсөл, ном, албан баримтын загвар хайж байна уу? Доорх товчоор эхэлээрэй 👇"
  }]
}' | head -c 200; echo

echo "=== 3. Persistent Menu (чатын доод байнгын цэс) ==="
curl -s -X POST "$API" -H "Content-Type: application/json" -d "{
  \"persistent_menu\": [{
    \"locale\": \"default\",
    \"composer_input_disabled\": false,
    \"call_to_actions\": [
      { \"type\": \"web_url\", \"title\": \"🛍 Бүтээгдэхүүн үзэх\", \"url\": \"$SITE/products\", \"webview_height_ratio\": \"full\" },
      { \"type\": \"web_url\", \"title\": \"📰 Нийтлэл унших\", \"url\": \"$SITE/blog\", \"webview_height_ratio\": \"full\" },
      { \"type\": \"web_url\", \"title\": \"🌐 Вэбэд зочлох\", \"url\": \"$SITE\", \"webview_height_ratio\": \"full\" }
    ]
  }]
}" | head -c 200; echo

echo "=== 4. Ice Breakers (анх орж ирэхэд бэлэн асуултууд) ==="
curl -s -X POST "$API" -H "Content-Type: application/json" -d '{
  "ice_breakers": [{
    "locale": "default",
    "call_to_actions": [
      { "question": "Бэлэн төсөл харах", "payload": "IB_PROJECTS" },
      { "question": "Ном хайх", "payload": "IB_BOOKS" },
      { "question": "Үнэ, төлбөрийн мэдээлэл", "payload": "IB_PRICING" },
      { "question": "Татаж авах заавар", "payload": "IB_DOWNLOAD" }
    ]
  }]
}' | head -c 200; echo

echo ""
echo "=== Тохиргоо дууслаа. Шалгах: ==="
curl -s "https://graph.facebook.com/v21.0/me/messenger_profile?fields=get_started,greeting,persistent_menu,ice_breakers&access_token=$TOKEN" | head -c 600
echo
