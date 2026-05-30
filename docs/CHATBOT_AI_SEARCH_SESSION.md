# DigitalGer — AI Search & Facebook Chatbot хөгжүүлэлтийн тэмдэглэл

> Энэ баримт нь DigitalGer-ийн **AI хайлтын API** болон **Facebook Messenger chatbot**-ийг
> бүрэн enterprise түвшинд хүргэсэн ажлын дэлгэрэнгүй тэмдэглэл. Шинэ хүн уншаад
> бүх архитектур, шийдсэн алдаа, deploy процессыг ойлгох зорилготой.

**Огноо:** 2026-05-30
**Хамрах хүрээ:** `backend/src/modules/ai/`, `n8n/digitalger_fb_chatbot.json`, VPS deploy

---

## 1. Ерөнхий зураглал

```
Facebook Messenger
      │  (webhook POST)
      ▼
  n8n workflow  ──────────►  Backend API  ──────────►  PostgreSQL
  (bot.digitalger.mn)        /api/ai/search             (Product, BundleItem,
  AI Agent + OpenAI                                      Lesson, FAQ ...)
      │
      ├─ AI текст хариу  ──► Send Text (FB)
      └─ carousel card   ──► Send Cards (FB)
```

- **Backend AI search:** `POST https://api.digitalger.mn/api/ai/search` — `{query}` авч
  `{products[], faqs[], searchTerms[]}` буцаана. LLM биш, PostgreSQL relevance хайлт.
- **n8n chatbot:** FB мессеж хүлээж авч, AI Agent (OpenAI gpt-4o-mini)-аар хариулж,
  бүтээгдэхүүн олдвол carousel card илгээнэ.

---

## 2. Backend AI Search — хайлтын логик

**Файл:** `backend/src/modules/ai/ai.service.ts`

Олон давталтаар төгөлдөржсөн **5 механизм**:

### 2.1 Галиг хөрвүүлэлт (Латин↔Кирилл)
`backend/src/common/transliterate.ts` → `expandQuery()`
- `byaruu` → `бяруу`, `бярүү`... (u→у/ү, o→о/ө бүх комбинац)
- Хэрэглэгч латинаар бичсэн ч Кирилл бүтээгдэхүүн олдоно.

### 2.2 tsvector word-boundary (substring БИШ)
```sql
to_tsvector('simple', body) @@ to_tsquery('simple', 'ферм:*')
```
- **Алдаа байсан:** `ILIKE '%сүү%'` нь үг дундаас таардаг → "сүү" нь "**Сүү**лт од"
  (ном) дотроос олддог байв.
- **Шийдэл:** tsvector нь үг хязгаар баримтална. `'simple'` config = stem хийхгүй, яг токен.

### 2.3 STOP_WORDS (туслах үг хасах)
"уу / байна / сайн / вэ / нь / ийн / гэж..." зэрэг асуулт, туслах үгсийг хайлтаас
**бүрэн хасна**. "байна **уу**" доторх "уу" гол үг болж бүх бүтээгдэхүүн таарахаас сэргийлнэ.

### 2.4 mnStem() — Монгол нөхцөл хасагч (stemmer)
- **Алдаа байсан:** хэрэглэгч "**фермийн**" гэж бичихэд DB-д "ферм / фермер" байгаа.
  `фермийн:*` prefix нь "фермийн"-аар эхэлсэн үг хайдаг тул юутай ч таарахгүй.
- **Шийдэл:** `MN_SUFFIXES` (-ийн/-ын/-аас/-тай/-д...) хасч **үндэс** гаргана:
  `фермийн → ферм → ферм:*` → ферм/фермер/фермийн бүгд таарна. word + stem + галиг
  бүгдийг tsquery-д нэмнэ.

### 2.5 COMMON_WORDS + maxKeyHits relevance
- "төсөл / бэлэн / үйлдвэр / аж / ахуй..." бараг бүх бүтээгдэхүүнд байдаг → сул жин.
- **maxKeyHits:** product бүрд хэдэн ГОЛ үг таарсныг тоолж, **хамгийн их үг таарсан
  түвшнийг** буцаана. "сүүний ферм" (2 үг) → 2 үг таарсан жинхэнэ ферм эхэнд,
  1 үг л таарсан (Номын сан-д bundle доторх номын нэрнээс "сүүний") хасагдана.

### 2.6 body tsvector — бүх эх сурвалж нэгтгэх
`string_agg` subquery-ээр Product талбар + **BundleItem** + Lesson + ProductFile +
ProductFAQ нэгтгэнэ. Жишээ: "бяруу" нь зөвхөн BundleItem.name дотор байдаг
("Бяруу өсвөр үхэр бордох төсөл" нь Мал аж ахуй + Platinum багцын BundleItem).

### Засагдсан техникийн bug-ууд
- **`max is not a function`:** `Math.max(...rows.map(r=>r.key_hits))` нь Postgres
  bigint-тэй ажиллахгүй → `rows.reduce((m,r)=>Math.max(m, Number(r.key_hits)||0), 0)`.
- **TS4053:** `SearchResult` interface export хийх.

### Тестлэгдсэн үр дүн
| Хайлт | Үр дүн |
|-------|--------|
| `бяруу` | Мал аж ахуй + Platinum (2) |
| `оёдол` | Оёдол нэхмэл + Platinum (2) |
| `сүүний ферм` | Мал аж ахуй + Хүнс боловсруулах + Platinum (3, Номын сан БИШ) |
| `сүүний фермийн төсөл байна уу` | ижил 3 (stem + stop word) |

---

## 3. n8n Facebook Chatbot

**Workflow ID:** `CNamkzJ1xMqWKWOr` — "Facebook Chatbot — DigitalGer AI"
**Файл:** `n8n/digitalger_fb_chatbot.json` (14 node)

### 3.1 Node бүтэц (ursgal)
```
GET verify:  FB Verify (GET) → Respond Challenge (hub.challenge)
POST мессеж: FB Message (POST) → Parse → Get User Profile → Search DigitalGer
   → Prep Context → AI Agent → Build Messages → Send Text → Has Cards? → Send Cards
   AI Agent ← OpenAI Chat Model (gpt-4o-mini) + Postgres Memory
```

### 3.2 AI-driven gating (хамгийн чухал архитектур)
**Зарчим:** бүх мессежид search хийдэг ч **carousel зөвхөн AI шийдсэн үед** гарна.

- **AI Agent system message** дотор: БҮХ 47 FAQ + contact + DigitalGer танилцуулга +
  чиглүүлэх дүрэм суулгасан.
- **Мэндчилгээ / ерөнхий / FAQ / холбоо** → AI system мэдлэгээсээ **шууд** хариулна
  (хайлт түлхэхгүй, marker тавихгүй → card гарахгүй).
- **Бүтээгдэхүүн / чиглэл хайвал** → AI хариултынхаа эхэнд далд `[SHOW_PRODUCTS]`
  marker тавина → Build Messages таниж арилгаад carousel харуулна.
- **Build Messages:** `marker байгаа БА search products>0` үед л card. Үгүй бол зөвхөн текст.

### 3.3 Carousel card UI
- FB Generic Template, `image_aspect_ratio: horizontal` (full-width).
  *Product зураг 4:3 (1200×896) — FB зөвхөн horizontal/square дэмждэг.*
- title (≤80), subtitle = `💰 хямдарсан · хуучин үндсэн` + товч тайлбар (≤80),
  "Дэлгэрэнгүй үзэх" button → web. 1 → card, олон → carousel (max 10).
- `stripMd()` — AI-ийн `[текст](url)` markdown → бүтэн URL (FB markdown рендерлэдэггүй).

### 3.4 Welcome / Onboarding (Messenger Profile API)
`n8n/setup_messenger_profile.sh` (нэг удаа ажиллуулна):
- **Get Started** товч (GET_STARTED payload)
- **Persistent menu:** 🛍 Бүтээгдэхүүн үзэх / 📰 Нийтлэл унших / 🌐 Вэбэд зочлох (→ web)
- **Ice Breakers:** Бэлэн төсөл харах / Ном хайх / Үнэ төлбөр / Татах заавар
- *Тэмдэглэл: FB v21-д `greeting` параметр устсан.*

### 3.5 Хэрэглэгчийн нэр
`Get User Profile` → FB Graph `GET /{psid}?fields=first_name` → "Сайн уу, Ambuk! 👋"
(Зөвхөн page-тэй өмнө харьцсан хүнд ажиллана — FB privacy.)

---

## 4. Шийдсэн томоохон алдаанууд (debug сургамж)

| Алдаа | Шалтгаан | Шийдэл |
|-------|----------|--------|
| 502 Bad Gateway | nginx upstream DNS cache хуучин IP | `docker restart docker-nginx-1` |
| execution "running" гацсан мэт | `EXECUTIONS_DATA_SAVE_ON_SUCCESS=none` (success data хадгалдаггүй) | debug-д түр `=all`, дараа `=none` |
| "No item to return" 500 | 2 webhook ижил webhookId / responseMode lastNode + IF хоосон салаа | өөр webhookId + `responseMode: onReceived` |
| "Invalid or unexpected token" | Code node JSON-д `.join('\n\n')` literal newline болсон | `NL=String.fromCharCode(10)`, `\u` escape |
| toLocaleString хоосон | n8n runtime-д ICU locale дутуу | regex/manual thousands separator |
| AI хачин хариу + marker тавихгүй | хуучин Postgres Memory төөрөгдүүлж байсан | `DELETE FROM n8n_chat_memory WHERE session_id=...` |
| build хуучин код | Docker build cache | `build --no-cache backend` + dist-д grep шалгах |

---

## 5. Deploy процесс

### Backend (код өөрчлөгдсөн)
```bash
# Local
git add ... && git commit && git push origin main
# VPS
ssh ... "cd /opt/DigitalGer && git pull origin main && \
  docker compose -f docker/docker-compose.prod.yml build --no-cache backend && \
  docker compose -f docker/docker-compose.prod.yml up -d backend && \
  docker restart docker-nginx-1"
# Баталгаа: docker exec docker-backend-1 grep -c mnStem /app/dist/src/modules/ai/ai.service.js
```
> dist зам: `/app/dist/src/...` (НЕ `/app/dist/...`)

### n8n workflow
```bash
docker cp wf.json digitalger-n8n:/tmp/wf.json
docker exec digitalger-n8n n8n import:workflow --input=/tmp/wf.json
docker exec digitalger-n8n n8n update:workflow --id=CNamkzJ1xMqWKWOr --active=true
docker restart digitalger-n8n   # ЗААВАЛ — webhook дахин бүртгэнэ
```

### SSH (ЧУХАЛ)
```bash
# id_ed25519 АЖИЛЛАХГҮЙ. id_ed25519.bak (passphrase: 1234) ашиглана:
cp /c/Users/ALIENWARE/.ssh/id_ed25519.bak /c/Users/ALIENWARE/.ssh/id_deploy_tmp
chmod 600 /c/Users/ALIENWARE/.ssh/id_deploy_tmp
ssh-keygen -p -P "1234" -N "" -f /c/Users/ALIENWARE/.ssh/id_deploy_tmp
ssh -i /c/Users/ALIENWARE/.ssh/id_deploy_tmp root@62.238.47.2 ...
```

### Тест (Кирилл UTF-8)
- Windows curl/python Кирилл encode асуудалтай → backend container дотроос шууд
  `docker exec -w /app docker-backend-1 node /app/_t.js` (require `/app/dist/...` +
  `/app/node_modules/@prisma/client`). Порт 4000 localhost-д хаалттай.
- chatbot тест: цэвэр шинэ PSID + `SAVE_ON_SUCCESS=all` түр.

---

## 6. Эцсийн төлөв (баталгаажсан)

| Тест | Үр дүн |
|------|--------|
| "сайн уу" | AI шууд мэндчилнэ, card гарахгүй ✓ |
| "татаж авах яаж" | FAQ-аас шууд хариу, card-гүй ✓ |
| "холбоо барих" | info@digitalger.mn, card-гүй ✓ |
| "сүүний фермийн төсөл байна уу" | [SHOW_PRODUCTS] → 3 product carousel ✓ |

- backend & n8n: healthy
- git: бүх commit push хийгдсэн (`6e2e1b3`)
- FB-д мессеж + carousel хүрч байна

---

## 7. Цаашид сайжруулах боломж

- "мал" гэх ганц нийтлэг үг хайхад Номын сан bundle доторх номын нэрнээс таарч магадгүй
  (maxKeyHits=1). Шаардвал Номын сан/Курс "контейнер" bundle-ийг хайлтаас хасах.
- `FB_APP_SECRET=PLACEHOLDER` — webhook signature шалгахгүй (security).
- Typing indicator (sender_action: typing_on), quick replies, human handoff.
- Chatbot харилцааны analytics дашборд.
