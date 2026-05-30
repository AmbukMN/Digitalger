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

# ТЭМДЭГЛЭЛ: FB Messenger Platform v21-д "greeting" параметрийг устгасан.
# Welcome дэлгэцийн текстийг одоо ice_breakers + get_started хослолоор харуулна.

echo "=== 2. Persistent Menu (зүүн доод ☰ цэс — вэб линк ЭНД л болно) ==="
# ТЭМДЭГЛЭЛ: Persistent Menu нь web_url дэмждэг. Ice Breaker дэмждэггүй.
curl -s -X POST "$API" -H "Content-Type: application/json" -d "{
  \"persistent_menu\": [{
    \"locale\": \"default\",
    \"composer_input_disabled\": false,
    \"call_to_actions\": [
      { \"type\": \"web_url\", \"title\": \"🛍 Бүх бүтээгдэхүүн\", \"url\": \"$SITE/products\", \"webview_height_ratio\": \"full\" },
      { \"type\": \"web_url\", \"title\": \"📰 Нийтлэл унших\", \"url\": \"$SITE/blog\", \"webview_height_ratio\": \"full\" },
      { \"type\": \"web_url\", \"title\": \"🌐 Вэбэд зочлох\", \"url\": \"$SITE\", \"webview_height_ratio\": \"full\" }
    ]
  }]
}" | head -c 200; echo

echo "=== 3. Ice Breakers (анх чат нээхэд гарах 4 товч — зөвхөн payload, web_url БОЛОХГҮЙ) ==="
# ТЭМДЭГЛЭЛ: Ice Breaker нь зөвхөн payload дэмждэг (FB дүрэм). Товч дарахад
# quick_reply эвент ирнэ → Parse node таниж AI-д текст болгон дамжуулна → AI хариулна.
curl -s -X POST "$API" -H "Content-Type: application/json" -d '{
  "ice_breakers": [{
    "locale": "default",
    "call_to_actions": [
      { "question": "Бүх бүтээгдэхүүн үзэх", "payload": "IB_ALL_PRODUCTS" },
      { "question": "Бэлэн бичсэн төслүүд", "payload": "IB_PROJECTS" },
      { "question": "Баримтын иж бүрдэл", "payload": "IB_DOCUMENTS" },
      { "question": "Татаж авах заавар", "payload": "IB_DOWNLOAD" }
    ]
  }]
}' | head -c 200; echo

echo ""
echo "=== Тохиргоо дууслаа. Шалгах: ==="
curl -s "https://graph.facebook.com/v21.0/me/messenger_profile?fields=get_started,greeting,persistent_menu,ice_breakers&access_token=$TOKEN" | head -c 800
echo
