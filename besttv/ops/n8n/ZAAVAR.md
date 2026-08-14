# BestTV — Facebook/Instagram чатбот

DigitalGer-ийн `CNamkzJ1xMqWKWOr` workflow-г BestTV орчинд бүтнээр хөрвүүлсэн.
**30 node**, 3 урсгал: Messenger AI чат · Comment auto-reply · Webhook verify.

---

## ✅ АЛЬ ХЭДИЙН ХИЙГДСЭН (2026-08-14)

| Алхам | Төлөв |
|---|---|
| Workflow import + идэвхжүүлсэн (`BestTVFBChat01`) | ✅ |
| OpenAI + Postgres credential холбосон | ✅ |
| Page token 9 node-д суусан | ✅ |
| `FB_PAGE_ACCESS_TOKEN` → `.env.production` | ✅ |
| Webhook verify тест (`OK999` буцаав) | ✅ |
| Мессежийн урсгал бүтэн тест | ✅ |

**Үлдсэн ганц зүйл: Meta дээр Callback URL бүртгэх + webhook талбар сонгох** (доорх 1-р хэсэг).

⚠️ Одоогийн token-д зөвхөн `pages_messaging` эрх байна. Messenger чат
ажиллана, харин **сэтгэгдлийн auto-reply болон Instagram ажиллахгүй** —
доорх «Permission» хэсгийг үзнэ үү.

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

### Permission — ⚠️ ОДООГИЙН БАЙДАЛ

Одоо суусан token-д **зөвхөн `pages_messaging`** эрх байна
(`debug_token`-оор баталсан). Үүний үр дүн:

| Функц | Төлөв |
|---|---|
| Messenger чат (FB) | ✅ Ажиллана |
| Сэтгэгдэлд авто хариу | ❌ `pages_read_engagement` хэрэгтэй |
| Private DM (сэтгэгдлээс) | ❌ дээрхтэй хамт |
| Instagram DM / сэтгэгдэл | ❌ IG эрх огт алга |

**Нэмж авах эрх** (App Review → Request permission):
```
pages_read_engagement        постын текст унших (comment reply)
pages_manage_metadata        webhook бүртгэх
pages_show_list
instagram_basic              ─┐
instagram_manage_messages     ├ Instagram-д
instagram_manage_comments    ─┘
```

> ⚠️ Эрх нэмсний дараа **token-ыг ДАХИН үүсгэнэ** — хуучин token-д
> шинэ эрх автоматаар нэмэгддэггүй. Дараа нь 2 газар солино:
> workflow (9 node) + `.env.production`.

### Access token — ✅ ХИЙГДСЭН

Одоогийн token нь **PAGE** төрлийн, `108103720808038`-д харьяалагдах,
**хэзээ ч дуусахгүй** (`expires_at: 0`) — 60 хоногийн солилт хэрэггүй.

Дахин үүсгэх шаардлагатай бол (эрх нэмсний дараа):
1. **Best TV** page-ыг холбоно
2. «Generate» дарж token авна
3. Хэрэв богино хугацаатай гарвал сунгана:

```bash
curl -s "https://graph.facebook.com/v21.0/oauth/access_token\
?grant_type=fb_exchange_token\
&client_id=<APP_ID>\
&client_secret=<APP_SECRET>\
&fb_exchange_token=<богино_token>"
```

---

## 2️⃣ Token-ыг workflow-д суулгах

> ## ⛔⛔ DEPLOY ХИЙХЭЭС ӨМНӨ ЗААВАЛ УНШ
>
> **`build.js`-ийн гаралтыг n8n-д бичих нь тухайн workflow-г БҮХЭЛД нь
> дарж бичдэг.** Хэрэв бүтээгдсэн JSON-д ямар нэг зүйл дутуу байвал
> production дээр ажиллаж байсан тэр зүйл **АЛГА БОЛНО**.
>
> **Бодит осол (2026-08-14):** env өгөлгүй build хийж deploy хийсэн →
> токен, bot secret, OpenAI/Postgres credential бүгд устсан → чатбот
> бүрэн унтарсан. Оношлоход хэцүү: n8n-ий лог дээр node бүр
> «finished successfully» гэж харагдана (Meta API-ийн 190 алдааг
> `neverError` залгидаг).
>
> **Тиймээс ЗААВАЛ:**
> 1. Deploy хийхийн өмнө **backup ав** (доор)
> 2. `BESTTV_FB_TOKEN` ба `BESTTV_BOT_SECRET` **хоёуланг** өг —
>    эс бөгөөс build өөрөө зогсоно (`exit 1`)
> 3. Deploy хийсэн хойно **шалгалтын жагсаалтыг** гүйцээ (доор)

### Backup (заавал, deploy бүрийн өмнө)

```bash
ssh root@62.238.47.2 "docker exec digitalger-n8n-postgres pg_dump -U n8n -d n8n \
  -t workflow_history -t workflow_entity --data-only \
  > /root/n8n-backup-\$(date +%Y%m%d-%H%M).sql"
```

### Build

```bash
cd besttv/ops/n8n
BESTTV_FB_TOKEN='EAG...' BESTTV_BOT_SECRET='4G6...' node build.js
```

Зөвхөн файлыг **уншиж шалгах** бол (n8n-д deploy хийж БОЛОХГҮЙ):
```bash
ALLOW_PLACEHOLDER=1 node build.js
```

### ⚠️ n8n 2.x — аль хүснэгтэд бичих вэ

Ажиллаж байгаа хувилбар нь **`workflow_history`** (`activeVersionId`-аар
холбогдсон мөр). `workflow_entity` нь зөвхөн ноорог — тэнд бичвэл
**өөрчлөлт нөлөөлөхгүй**. Хоёуланд нь бичих ёстой:

```sql
UPDATE workflow_history SET nodes = ..., connections = ...
 WHERE "versionId" = '<activeVersionId>';
UPDATE workflow_entity SET nodes = ..., connections = ..., "updatedAt" = now()
 WHERE id = 'BestTVFBChat01';
```

`activeVersionId`-г олох:
```sql
SELECT "activeVersionId" FROM workflow_entity WHERE id='BestTVFBChat01';
```

### ✅ Deploy хийсний дараах ШАЛГАЛТ (бүгд ✅ байх ёстой)

```bash
ssh root@62.238.47.2 "docker exec digitalger-n8n-postgres psql -U n8n -d n8n -t -A -F'
  ' -c \"
SELECT
 CASE WHEN h.nodes::text LIKE '%EAG%' THEN '✅ токен' ELSE '❌ токен' END,
 CASE WHEN h.nodes::text LIKE '%BESTTV_PAGE_TOKEN%' THEN '❌ placeholder' ELSE '✅ placeholder алга' END,
 CASE WHEN h.nodes::text LIKE '%qpjrNb8Yo010i6C9%' THEN '✅ OpenAI cred' ELSE '❌ OpenAI cred' END,
 CASE WHEN h.nodes::text LIKE '%ngOFGxWpH1dywpIn%' THEN '✅ Postgres cred' ELSE '❌ Postgres cred' END,
 CASE WHEN e.active THEN '✅ идэвхтэй' ELSE '⛔ унтарсан' END
FROM workflow_history h, workflow_entity e
WHERE h.\\\"versionId\\\"=e.\\\"activeVersionId\\\" AND e.id='BestTVFBChat01';\""
```

Дараа нь **бодит тест**: FB пост дээр сэтгэгдэл бичээд хариу ирж
байгааг, чатад мессеж бичээд AI хариулж байгааг ХОЁУЛАНГ шалга.

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

---

## 🔗 ГУРВАН СУВАГ — ЯГ ИЖИЛ ХАРИУЛНА

FB, Instagram, вэб чат гурав **нэг л system prompt**, **нэг л
deterministic логик** ашиглана. Аль нэгийг өөрчилвөл **бусдыг ч**
шинэчил — эс бөгөөс нэг платформ хоёр өөр хариу өгнө.

| Юу | FB/IG workflow | Вэб workflow |
|---|---|---|
| Файл | `besttv-fb-chatbot.json` | `besttv-web-chat.json` |
| n8n ID | `BestTVFBChat01` | `BestTVWebChat01` |
| Prompt эх сурвалж | `system-prompt.txt` | ← **ижил** |
| Deterministic node | `Prep Context` | `Prep` |
| Хайлт задлах | `Extract Keyword` | ← **ижил код** |

### Deterministic хариу (AI-д ЗОХИОЛГОХГҮЙ)

Дараах асуултад AI биш, **DB-ийн бодит дата** хариулна:

| Асуулт | Эх сурвалж | Яагаад |
|---|---|---|
| Холбоо барих | `/settings/socials` | AI утас/имэйл зохиовол хэрэглэгч төөрнө |
| Багцын үнэ | `/plans` | Буруу үнэ = гомдол |
| Данс, шилжүүлэг | `/bank/accounts` | ⚠️ Буруу данс = **мөнгө өөр хүн рүү** |

⚠️ API унасан ч **хоосон буцаахгүй** — хамгийн багадаа
`support@besttv.us` ба сайтын заавар өгнө. Өмнө нь `directReply=''`
болоод AI мэдээллийг зохиодог байв.

### ⚠️⚠️ АЛДААНЫ 3 ТҮГЭЭМЭЛ ЭХ ҮҮСВЭР

**1. `.first()` vs `.all()`** — `/titles/search` нь цэвэр массив
буцаадаг. n8n HTTP node массивыг **олон item болгон задалдаг** тул
`.first().json` нь массив БИШ, эхний кино. `Array.isArray` false
болж **карт огт гардаггүй**. ЗААВАЛ `.all()`.

**2. AI `[SEARCH:]` мартах** — prompt-д дүрэм, жишээ байсан ч AI
тавихгүй байх нь бий. Тэгэхэд карт гарахгүй, бүр AI **байхгүй кино
зохионо** («Crash Landing on You» — манайд байхгүй, бодитоор гарсан).
`Extract Keyword`-д **нөөц логик** бий: түлхүүр үг олдоогүй бол
хэрэглэгчийн мессежээс өөрөө гаргана. FAQ/мэндчилгээг шүүнэ.

**3. Комментод backtick** — 5 удаа давтагдсан. Build-ээс өмнө ЗААВАЛ:
```bash
node check-backticks.js && BESTTV_FB_TOKEN=... node build.js
```
