# BestFilm-ийн FB/IG хуудас нэмэх

⚠️ **Нэг workflow, `pageId → site` зураглал.** Тусдаа workflow үүсгэхгүй —
код давхардвал «99» гэх засварыг хоёр газар хийх шаардлагатай болж,
нэгийг мартах эрсдэл өндөр (санах ойн дүрэм: «чат НЭГ эх сурвалж»).

---

## Одоогийн бүтэц

`BestTVFBChat01` workflow-ийн **8 node** дотор ижил зураглал бий:

```js
const T = {
  '108103720808038':   'EAG…',  // Best TV (FB)
  '1709865179261697':  'EAG…',  // Богино драм (FB)
  '2237164766611647':  'EAG…',  // Шилдэг кинонууд (FB)
  '17841442595556819': 'EAG…',  // Instagram
};
const p = String($('Prep Context').first().json.pageId || '108103720808038');
const k = T[p] || T['108103720808038'];
return 'https://graph.facebook.com/v21.0/me/messages?access_token=' + k;
```

**Node-ууд:** Send Text · Send Cards · Send Cards Fallback ·
Send Comment Reply · Send Private Reply · Send Typing On/Off ·
Get User Profile

⚠️ Токен нь **8 газар давхардсан**. Гараар засвал нэгийг мартана —
`scripts/add-fb-page.mjs` ашиглана (доор).

---

## ⚠️ ХОЁР зүйл хийх ЁСТОЙ

### 1. Токен нэмэх (хариу илгээхэд)

BestFilm-ийн хуудсын `pageId` + `Page Access Token`-ыг зураглалд нэмнэ.

### 2. `site` илгээх (чат зөв сайтад бичигдэхэд)

⚠️ **Үүнгүйгээр BestFilm-ийн чат BestTV-ийн админ панелд гарна.**

`Build Messages` node-ийн `_ingest` объектод `site` талбар нэмнэ:

```js
const _ingest = {
  channel: (platform === 'instagram') ? 'instagram' : 'facebook',
  pageId: String($('Parse').first().json.pageId || ''),
  /* ⚠️⚠️ АЛЬ САЙТЫН ХУУДАС ВЭ — backend үүгээр шүүнэ.
     Байхгүй бол `besttv` (одоогийн зан төлөв ХЭВЭЭР). */
  site: SITE_BY_PAGE[String($('Parse').first().json.pageId || '')] || 'besttv',
  ...
};
```

Мөн `Extract Keyword`-ийн `Search Titles` дуудлагад `X-Site` толгой
нэмэх ёстой — эс бөгөөс BestFilm-ийн чат BestTV-ийн киног хайна.

---

## Хийх алхам

### 1. Meta-гаас мэдээлэл авах

**developers.facebook.com → Apps → BestTV → Tools → Graph API Explorer**

```
GET /me/accounts?fields=id,name,access_token
```

⚠️ **Never-expire токен** авах (санах ойн дүрэм — `expires_at: 0`):
1. User token → Long-lived болгох (60 хоног)
2. Түүгээр `/me/accounts` дуудах → Page token нь never-expire

Батлах:
```
GET /debug_token?input_token=<PAGE_TOKEN>
→ "expires_at": 0  ✅
```

### 2. Webhook subscribe

⚠️ **IG DM ажиллахгүйн ГОЛ шалтгаан** (санах ойд тэмдэглэсэн):
Meta App дээр webhook subscribe хийгээгүй бол зурвас серверт **огт ирэхгүй**.

**App → Webhooks → Page:**
- Callback URL: `https://bot.digitalger.mn/webhook/besttv-facebook-webhook`
- Verify token: `Digitalger_Ambuk_verify_token123`
- Fields: `messages`, `messaging_postbacks`, `feed`

**Instagram:** `messages`, `comments` (тусад нь subscribe!)

### 3. Скрипт ажиллуулах

```bash
node besttv/n8n/scripts/add-fb-page.mjs \
  --page-id=<PAGE_ID> \
  --token=<PAGE_ACCESS_TOKEN> \
  --site=bestfilm \
  --name="BestFilm"
```

Скрипт нь:
1. 8 node-ийн зураглалд токен нэмнэ
2. `Build Messages`-д `site` зураглал нэмнэ
3. `workflow_history` + `workflow_entity` **хоёуланд** бичнэ
4. DB-ээс дахин уншиж батална

### 4. Restart + тест

```bash
docker restart digitalger-n8n-worker
```

Facebook хуудсандаа Messenger-ээр «99» гэж бичиж үзнэ →
«Өнчин охин» карт гарах ёстой.

⚠️ Админ панель → BestFilm сонгоод → Чат → тэр яриа харагдана.

---

## ⚠️ Санах ойд тэмдэглэсэн урхинууд

| Урхи | Тайлбар |
|---|---|
| **Токен 4 газар** | `.env` × 2 + workflow_history + entity. Нэгийг мартвал ЧИМЭЭГҮЙ эвдэрнэ |
| **`workflow_history` vs `entity`** | n8n 2.x нь `activeVersionId`-ийн history-г ажиллуулна. Зөвхөн entity засвал ажиллахгүй |
| **Verify token зөрөх** | Node-д hardcode vs env — «couldn't be validated» |
| **IG capability** | «байхгүй» гэсэн онош БУРУУ байсан — webhook subscribe нь гол |
| **regex escape** | Code node-д escape бичвэл JSON-д дахин encode → SyntaxError |
