# BestTV — n8n AI чатбот

Вэб чатын AI туслах. DigitalGer-ийн ажиллаж байгаа `web_chat_workflow.json`-той **ижил бүтэц**, гэхдээ system message болон хайлт нь BestTV-ийн хүрээнд.

## Урсгал

```
Хэрэглэгч (besttv.us widget)
   │  POST { sessionId, message, name }
   ▼
n8n webhook /webhook/besttv-chat
   │
   ├─ Prep ─────────► AI Agent (gpt-4o-mini + Postgres Memory)
   │                     │
   │                     ▼
   │                 Extract Keyword  ([SEARCH:xxx] салгана)
   │                     │
   │                     ▼
   │                 Search Titles ──► GET api.besttv.us/api/titles/search
   │                     │
   │                     ▼
   │                 Build JSON
   │                   ├──────────► Respond  → widget-д { reply, titles[] }
   │                   └──────────► Save Ingest → POST /api/chat/ingest
   ▼
Backend DB (ChatConversation + ChatMessage) → админ панелийн /chat
```

**⚠️ Чухал:** AI-ийн **яриа санах ой** нь n8n-ийн Postgres дотор (`n8n_chat_memory`), backend DB-д БИШ. Backend зөвхөн CRM лог хадгална.

---

## Импорт хийх (n8n UI)

1. https://bot.digitalger.mn нээж нэвтэрнэ
2. **Workflows → Import from File**
3. `besttv_web_chat.json` сонгоно
4. Credential 2-ыг шалгана (DigitalGer-ийнхтэй ижил ID-тай тул автоматаар холбогдох ёстой):
   - **OpenAI account** (`qpjrNb8Yo010i6C9`)
   - **N8N PostgreSQL** (`ngOFGxWpH1dywpIn`)
5. **Save** дараа **Activate** (баруун дээд toggle)
6. Webhook URL авах: `Web Webhook` node дээр дарж **Production URL** хуулна
   → `https://bot.digitalger.mn/webhook/besttv-chat`

### ⚠️ n8n 2.x онцлог (санах ойд тэмдэглэсэн)

- Ажиллах хувилбар нь `workflow_history` (activeVersionId) — DB-д шууд засвар оруулбал **үйлчлэхгүй**. Заавал UI-аар засаж Save дарна.
- `Save Ingest` нь **native HTTP Request node** — Code node доторх `httpRequest` нь динамик талбарыг (titles массив) алгасдаг тул ЗӨВ ажиллахгүй. Энэ node-ыг Code node болгож БҮҮ өөрчил.

---

## Frontend тохиргоо

`besttv/frontend/.env.local` (эсвэл production `.env`):

```bash
NEXT_PUBLIC_CHAT_WEBHOOK_URL=https://bot.digitalger.mn/webhook/besttv-chat
```

Тохируулаагүй бол дээрх утга анхны байдлаар хэрэглэгдэнэ.

---

## Backend endpoint (аль хэдийн бэлэн)

| Зам | Хэн дууддаг | Auth |
|---|---|---|
| `POST /api/chat/ingest` | n8n (Save Ingest node) | байхгүй, throttle 240/мин |
| `POST /api/chat/save` | widget (handoff үед) | байхгүй |
| `GET /api/chat/messages` | widget polling (6с) | байхгүй |
| `GET /api/chat/unread` | widget polling (20с) | байхгүй |
| `POST /api/chat/link-session` | widget (нэвтрэхэд) | **JWT** |
| `GET/POST /api/admin/chat/*` | админ панель | **JWT + ADMIN** |

---

## Тест хийх

### 1. Webhook шууд

```bash
curl -X POST https://bot.digitalger.mn/webhook/besttv-chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"web_test1","message":"Солонгос кино байна уу?"}'
```

Хүлээх хариу: `{ "reply": "...", "titles": [...] }`

### 2. Backend ingest (n8n-гүйгээр)

```bash
curl -X POST http://localhost:4100/api/chat/ingest \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"web_t2","userText":"сайн уу","assistantText":"Сайн байна уу!"}'
```

### 3. Админ панелиас

http://localhost:3101/chat — яриа харагдах ёстой.

---

## System message засах

`AI Agent` node → **Options → System Message**. Одоогийн агуулга:
жанрууд, 6 багцын үнэ, төлбөрийн арга, хэтэвч, чухал хуудсууд,
`[SEARCH:]` дүрэм, хязгаарлалт (18+ нарийн ярихгүй, үнэ зохиохгүй).

**Багц/үнэ өөрчлөгдвөл** энэ хэсгийг заавал шинэчилнэ — AI хуучин үнэ хэлэхээс сэргийлнэ.

---

## Гар хариу (handoff)

Админ `/chat` хуудсанд **"AI хариулж байна" → "Би хариулж байна"** товч дарвал:
- `ChatConversation.handedOff = true`
- Widget polling-оор мэдэж, дараагийн мессежийг **n8n рүү явуулахгүй**, зөвхөн `/chat/save` руу бичнэ
- Хэрэглэгчид "Та багийн гишүүнтэй шууд ярьж байна" ногоон баннер гарна

⚠️ Handoff шалгалт нь **widget талд** — n8n workflow дотор gate байхгүй (DigitalGer-тэй ижил).
