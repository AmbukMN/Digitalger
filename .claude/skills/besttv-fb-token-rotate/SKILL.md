---
name: besttv-fb-token-rotate
description: BestTV-гийн Facebook/Instagram Page Access Token солих. Токен солих бүрд ЗААВАЛ уншина — токен нь ОЛОН газар давхардсан тул нэгийг нь мартвал чат/нийтлэл/профайл ЧИМЭЭГҮЙ унтарна. Use when the user says «FB токен солих», «токен шинэчлэх», «токен дууссан», «Facebook токен хүчингүй», or when a Graph API call returns code 190 / subcode 492.
---

# BestTV — Facebook/Instagram токен солих

## ⚠️⚠️ ЯАГААД ЭНЭ ФАЙЛ ХЭРЭГТЭЙ ВЭ

Токен нь **2 өөр систем × 2 токен = 4 байршилд** давхардаж бичигдсэн.
Нэг газрыг мартвал систем **ЧИМЭЭГҮЙ** эвдэрнэ — алдаа гарахгүй,
зүгээр л ажиллахаа болино.

**Бодит алдаа (2026-08-28):** `.env.production`-ы токен унасныг
хэн ч анзаараагүй. Чат хэвийн ажиллаж байсан (n8n өөрийн hardcode
токеноор хариулдаг), гэвч **291 FB ярианаас ердөө 1 нь** нэр/аватартай
байв. Профайл татах функц 190-аар унаж, чимээгүй алгасаж байсан.

---

## 1. Токен хаана байдаг вэ (БҮГД)

### A. BestTV backend — `.env.production`

```
/opt/BestTV/backend/.env.production
```

| Хувьсагч | Юунд | Хуудас |
|---|---|---|
| `FB_PAGE_ACCESS_TOKEN` | ⚠️ ҮНДСЭН — чат профайл, crosspost, IG нийтлэл | Best TV |
| `FB_PAGE_ACCESS_TOKEN_2` | Хоёр дахь хуудасны чат | Best Tv 2 (`1709865179261697`) |
| `IG_USER_ID` | IG нийтлэл | `17841442595556819` |
| `FB_PAGE_ID_2` | Аль токен сонгохыг шийднэ | `1709865179261697` |

⚠️ **`FB_PAGE_ID` (үндсэн хуудасны ID) нь .env-д БАЙХГҮЙ** боловч DB-д
`108103720808038` гэсэн хуудсанд **276 яриа** бүртгэгдсэн. Токен
солихдоо энэ ID-г нэмбэл `pageToken()` илүү найдвартай ажиллана.

**Ашигладаг код:**
- `backend/src/modules/chat/chat.service.ts` — профайл татах, админ хариу
- `backend/src/modules/crosspost/meta-graph.service.ts` — FB/IG нийтлэл
- `backend/src/modules/crosspost/crosspost.service.ts`
- `backend/src/modules/social/social-publisher.service.ts`

### B. n8n workflow — **HARDCODE**

```
workflow: BestTV — Facebook/Instagram чатбот
id       : BestTVFBChat01
```

⚠️⚠️ **n8n 2.x**: ажиллаж байгаа хувилбар нь `workflow_history` дотор
(`activeVersionId`-аар холбогдоно). `workflow_entity.nodes` нь ЗӨВХӨН
draft — тэнд засвар хийвэл **огт нөлөөлөхгүй**.

⚠️ Хэрэглэгчийн заавар: *«chi token hardcode hesegt hardcode oor hiigeerei,
tegehgvi bol bolohgvi baisan umnu ni»* — n8n-д env биш, **hardcode** ашиглана.

---

## 2. Токен солих ЖУРАМ

### Алхам 1 — Шинэ токен авах
Meta Business Suite → тухайн хуудас → **never-expire Page Access Token**.

Заавал шалгах: `expires_at: 0` (мөнх) байх ёстой.

### Алхам 2 — Шинэ токеныг БАТЛАХ (бичихээс ӨМНӨ)

```bash
T='<ШИНЭ_ТОКЕН>'
curl -s "https://graph.facebook.com/v21.0/debug_token?input_token=$T&access_token=$T" \
  | python3 -m json.tool
```

Хүлээх үр дүн:
- `is_valid: true`
- `expires_at: 0` (мөнх)
- `type: PAGE`
- `profile_id` = тухайн хуудасны ID

### Алхам 3 — `.env.production` шинэчлэх

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.47.2
cd /opt/BestTV/backend
cp .env.production .env.production.bak-$(date +%s)   # ⚠️ нөөц ЗААВАЛ
# FB_PAGE_ACCESS_TOKEN болон/эсвэл FB_PAGE_ACCESS_TOKEN_2 солих
```

### Алхам 4 — n8n workflow_history шинэчлэх

⚠️ `workflow_entity` БИШ — `workflow_history` дотор.

```sql
UPDATE workflow_history
SET nodes = replace(nodes::text, '<ХУУЧИН>', '<ШИНЭ>')::jsonb
WHERE "workflowId" = 'BestTVFBChat01';
```

⚠️ **Хоёр токен хоёулаа** энэ workflow-д байдаг — аль алийг нь шалга.

### Алхам 5 — Container ДАХИН ҮҮСГЭХ

⚠️⚠️ `restart` ХАНГАЛТГҮЙ — env шинээр уншигдахгүй.

```bash
cd /opt/BestTV/docker
docker compose -f docker-compose.prod.yml -p besttv up -d --force-recreate backend worker
docker restart digitalger-n8n
```

⚠️ Мөн `worker` — email/queue кодод токен хэрэглэгддэг бол rebuild хэрэгтэй.

---

## 3. ЗААВАЛ БАТАЛГААЖУУЛАХ (алхам бүрийн дараа)

```bash
# 1) Container дотор шинэ токен орсон эсэх
ssh ... 'docker exec besttv-backend printenv FB_PAGE_ACCESS_TOKEN | cut -c1-24'

# 2) Токен АЖИЛЛАЖ байгаа эсэх
ssh ... 'T=$(docker exec besttv-backend printenv FB_PAGE_ACCESS_TOKEN); \
  curl -s "https://graph.facebook.com/v21.0/me?access_token=$T"'
```

⚠️ `code 190 / subcode 492` = токен унасан хэвээр.

```bash
# 3) Чат профайл бодитоор татагдаж байгаа эсэх
ssh ... 'docker exec besttv-postgres psql -U besttv -d besttv -t -A -c \
  "SELECT channel, count(*) FILTER (WHERE \"userImage\" IS NOT NULL) FROM \"ChatConversation\" GROUP BY channel;"'

# 4) Backend лог — шалтгааныг бичдэг (chat.service.ts)
ssh ... 'docker logs besttv-backend --since 10m 2>&1 | grep "Чат профайл"'
```

---

## 4. Алдааны код → ЯГ ЮУ хийх вэ

| Код | Утга | Үйлдэл |
|---|---|---|
| `190` / `492` | Токен хүчингүй | Шинэ токен үүсгэх (энэ файлын журам) |
| `3` | App-д **Feature** байхгүй | App Review → **Business Asset User Profile Access** (Advanced) |
| `230` | IG хэрэглэгч зөвшөөрөл өгөөгүй | ⚠️ **ХЭВИЙН** — коммент бичсэн, DM илгээгээгүй. Засах зүйл БИШ |
| `100` + `pages_read_engagement` | Permission дутуу | Токеныг тэр эрхтэйгээр дахин үүсгэх |
| `(#100) No matching user found` | Буруу хуудасны токен | `pageToken()` сонголт — `FB_PAGE_ID_2` шалга |

---

## 5. ⚠️ FB нэр/аватар — токен ГАНЦААРАА ХҮРЭЛЦЭХГҮЙ

Messenger User Profile API (`GET /{PSID}?fields=name,first_name,profile_pic`)
нь permission БИШ, **Feature** шаарддаг:

> **Business Asset User Profile Access** — Advanced Access

⚠️ Токен хүчинтэй байсан ч энэ Feature-гүй бол `code 3` буцаана
(бодитоор туршиж баталсан).

**Instagram-д нэмж:** `instagram_basic`, `instagram_manage_messages`,
`pages_manage_metadata`, `pages_read_engagement`, `pages_show_list`.

---

## 6. Товч шалгах жагсаалт

- [ ] Шинэ токен `debug_token`-оор баталсан (`is_valid`, `expires_at: 0`)
- [ ] `.env.production` — `FB_PAGE_ACCESS_TOKEN`
- [ ] `.env.production` — `FB_PAGE_ACCESS_TOKEN_2` (хэрэв тэр хуудас солигдсон бол)
- [ ] n8n `workflow_history` (⚠️ `workflow_entity` БИШ), `BestTVFBChat01`
- [ ] `docker compose ... up -d --force-recreate backend worker`
- [ ] `docker restart digitalger-n8n`
- [ ] `printenv`-ээр container дотор орсныг БАТАЛСАН
- [ ] `/me` дуудлага 190 буцаахгүй болсныг БАТАЛСАН
- [ ] Чат хариу бодитоор очиж байгааг туршсан
- [ ] Профайл (нэр/аватар) татагдаж эхэлсэн эсэхийг шалгасан

⚠️ **Токен чатад ил гарсан бол** — тэр токеныг НЭН ДАРУЙ хүчингүй
болгож дахин үүсгэ (git history-д ч үлддэг).
