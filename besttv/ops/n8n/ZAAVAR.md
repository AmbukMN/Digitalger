# BestTV — Facebook/Instagram чатбот суулгах заавар

DigitalGer-ийн `CNamkzJ1xMqWKWOr` workflow-г BestTV орчинд бүтнээр хөрвүүлсэн.
**29 node**, 3 урсгал: Messenger AI чат · Comment auto-reply · Webhook verify.

---

## 📋 BestTV-ийн ID-ууд (кодод hardcode хийгдсэн)

| Зүйл | Утга |
|---|---|
| Facebook Page ID | `108103720808038` |
| Instagram ID | `17841442595556819` (@besttv.mn) |
| Business portfolio | `1889139568724149` |
| Webhook зам | `/webhook/besttv-facebook-webhook` |
| Verify token | `BestTV2026Verify` |

> ⚠️ **ID-г ЗОРИУД hardcode хийсэн.** n8n Code node дотор `$env` найдваргүй
> (DigitalGer дээр батлагдсан) — env-ээр дамжуулбал `undefined` болж, өөрийн
> Page-ийн сэтгэгдэлд хариулж хязгааргүй давталтад орно.

---

## 1️⃣ Meta тохиргоо (developers.facebook.com)

### Use case
**Messenger from Meta** сонгосон — зөв.

### Webhook (1. Configure webhooks)
```
Callback URL:  https://bot.digitalger.mn/webhook/besttv-facebook-webhook
Verify token:  BestTV2026Verify
```

> ⚠️ n8n workflow **АСААЛТТАЙ** байж байж verify амжилттай болно.
> Эхлээд workflow-г import + activate хийнэ, дараа нь «Verify and save».

### Webhook талбарууд
**Messenger (`page`):**
- `messages` — чат мессеж
- `messaging_postbacks` — Get Started, Ice Breaker
- `feed` — **comment auto-reply-д ЗААВАЛ**

**Instagram settings табаас (`instagram`):**
- `messages` — IG DM
- `comments` — IG сэтгэгдэл

### Permission
```
pages_messaging              Messenger хариулах
pages_manage_metadata        webhook бүртгэх
pages_read_engagement        постын текст унших (comment reply)
pages_show_list
instagram_basic
instagram_manage_messages
instagram_manage_comments
```

### Access token (2. Generate access tokens)
1. **Best TV** page-ыг холбоно
2. Token үүсгэнэ (short-lived, 1 цаг)
3. 60 хоногийн болгож солино:

```bash
curl -s "https://graph.facebook.com/v21.0/oauth/access_token\
?grant_type=fb_exchange_token\
&client_id=<APP_ID>\
&client_secret=<APP_SECRET>\
&fb_exchange_token=<богино_token>"
```

---

## 2️⃣ Token-ыг workflow-д суулгах

`besttv-fb-chatbot.json` дотор **9 газар** `__BESTTV_PAGE_TOKEN__` гэсэн
орлуулагч байна. Бүгдийг солино:

```bash
cd besttv/ops/n8n
BESTTV_FB_TOKEN='<60_хоногийн_token>' node build.js
```

Эсвэл гараар:
```bash
sed -i "s/__BESTTV_PAGE_TOKEN__/<token>/g" besttv-fb-chatbot.json
```

---

## 3️⃣ Backend орчны хувьсагч

Админ FB/IG чатад хариулахад Messenger руу илгээх token хэрэгтэй.

**`/opt/BestTV/backend/.env.production`-д нэмнэ:**
```
FB_PAGE_ACCESS_TOKEN=<ижил 60 хоногийн token>
```

> ⚠️⚠️ **`.env` БИШ, `.env.production`** — compose нь зөвхөн түүнийг уншина.
> Буруу файлд бичвэл админы хариу FB рүү явахгүй, чимээгүй унтарна.

```bash
docker compose -f docker-compose.prod.yml -p besttv up -d --force-recreate backend
docker exec besttv-backend printenv FB_PAGE_ACCESS_TOKEN   # заавал батал
```

---

## 4️⃣ n8n-д import хийх

> ⚠️⚠️ **`n8n import:workflow` нь workflow-г ШИНЭЭР үүсгэдэг** (шинэчилдэггүй).
> Дахин import хийвэл хуулбар үүснэ — эхлээд хуучныг устгана.

```bash
# 1. VPS руу хуулах
scp besttv/ops/n8n/besttv-fb-chatbot.json root@62.238.47.2:/tmp/

# 2. Container руу
ssh root@62.238.47.2
docker cp /tmp/besttv-fb-chatbot.json digitalger-n8n:/tmp/

# 3. Import
docker exec digitalger-n8n n8n import:workflow --input=/tmp/besttv-fb-chatbot.json

# 4. ID-г олох
docker exec digitalger-n8n n8n list:workflow 2>&1 | grep BestTV

# 5. Идэвхжүүлэх
docker exec digitalger-n8n n8n update:workflow --id=<ID> --active=true
docker restart digitalger-n8n
```

### Credential холбох (n8n UI дээр)
Import хийсний дараа **2 node-д credential гараар холбоно**:
- `OpenAI Chat Model` → DigitalGer-ийн OpenAI credential
- `Postgres Memory` → DigitalGer-ийн Postgres credential

> ⚠️ Credential нь JSON-д ордоггүй (аюулгүй байдлын үүднээс) — UI-аас
> заавал сонгоно. Эс бөгөөс `Node does not have any credentials set` алдаа.

---

## 5️⃣ Тест

```bash
# Webhook verify
curl -s "https://bot.digitalger.mn/webhook/besttv-facebook-webhook\
?hub.mode=subscribe&hub.verify_token=BestTV2026Verify&hub.challenge=TEST123"
# → TEST123 гарах ёстой

# Буруу token
curl -s "https://bot.digitalger.mn/webhook/besttv-facebook-webhook\
?hub.mode=subscribe&hub.verify_token=buruu&hub.challenge=TEST123"
# → хоосон
```

Дараа нь Messenger-ээс бодит мессеж бичиж шалгана:
1. «сайн байна уу» → дулаан мэндчилгээ
2. «agent kim» → киноны карт гарах
3. «багц хэд вэ» → бодит үнэ (AI зохиохгүй)
4. Пост дээр сэтгэгдэл → автомат хариу + DM

---

## 🔍 Юу хөрвүүлсэн бэ (DigitalGer → BestTV)

| DigitalGer | BestTV |
|---|---|
| `POST /api/ai/search` `{query}` → `{products:[]}` | `GET /api/titles/search?q=` → массив |
| `digitalger.mn/products/<slug>` | `besttv.us/movie/<slug>` |
| Бүтээгдэхүүний үнэ картад | Он, ⭐ үнэлгээ, 🎬/📺 төрөл, 🔒 багц |
| `image_aspect_ratio: horizontal` | `square` (кино постер босоо) |
| Ice Breaker: төсөл/ном/татах | кино/цуврал/багц/яаж үзэх |
| FAQ stop-list: татах, купон… | үзэх, багц, төхөөрөмж… |
| Page `1052275041465153` | `108103720808038` |
| IG `17841433844785813` | `17841442595556819` |

## ✨ DigitalGer-т БАЙХГҮЙ, BestTV-д НЭМСЭН

| Юу | Яагаад |
|---|---|
| **`Check Handoff` node** | Админ «өөрөө хариулна» гэхэд AI зогсоно. DigitalGer дээр энэ шалгалт БАЙХГҮЙ — админ авсан ч AI давхар хариулсаар байдаг |
| **Багцын бодит үнэ** | `/plans`-аас татаж AI-д өгнө. Эс бөгөөс AI үнэ зохионо |
| **`delivered` flag** | Админы хариу Messenger рүү хүрээгүй бол анхааруулна |
| **Сувгийн шүүлт + тэмдэг** | Админ панелд FB/IG/вэб ялгаж харна |
| **Өөрийн PSID алгасах** | `Parse` дотор Page/IG ID шалгаж давталтаас сэргийлнэ |

---

## ⚠️ Анхаарах

**Token 60 хоногт нэг удаа солино.** Дуусахад чатбот чимээгүй зогсоно.
Солих үед **2 газар** солино: workflow (9 node) + backend `.env.production`.

**24 цагийн дүрэм:** Хэрэглэгч сүүлд бичсэнээс хойш 24 цаг өнгөрвөл
Meta энгийн мессеж илгээхийг хориглоно. Админы хариу `delivered: false`
болж, панелд шар анхааруулга гарна.
