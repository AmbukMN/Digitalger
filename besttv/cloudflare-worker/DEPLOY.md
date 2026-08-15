# Видео CDN Worker — deploy заавар

## 1) Дараах 3 командыг ажиллуулна

```bash
cd C:/Users/ALIENWARE/Desktop/DigitalGer/besttv/cloudflare-worker

# (1) Cloudflare-д нэвтрэх — браузер нээгдэнэ, Allow дарна
npx wrangler login

# (2) Гарын үсгийн нууц түлхүүр — доорх утгыг ЯГ ХУУЛЖ буулгана
npx wrangler secret put VIDEO_SIGN_SECRET
# → асуухад буулгах утга:
# <SECRET — repo-д БҮҮ бич, wrangler secret put-аар оруул>

# (3) Deploy
npx wrangler deploy
```

## 2) Дууссаны дараа надад хэлнэ үү

Би VPS дээр `.env.production`-д дараахыг нэмж, backend-ийг дахин
асаагаад бүх зүйлийг тестлэнэ:

```
VIDEO_CDN_URL=https://cdn.besttv.us
VIDEO_SIGN_SECRET=<SECRET — repo-д БҮҮ бич, wrangler secret put-аар оруул>
```

---

## Юу болох вэ

| Өмнө | Дараа |
|---|---|
| `cdn.besttv.us/movies/...` → **200 нээлттэй** ⚠️ | → **404** (гарын үсэггүй) ✅ |
| Segment кэшгүй (`DYNAMIC`) | 330+ хотод кэштэй (`HIT`) ✅ |
| Хол улсаас удаан | 2-5 дахин хурдан ✅ |

⚠️ Backend-д `VIDEO_CDN_URL` нэмэх хүртэл сайт **хуучнаараа** ажиллана —
Worker deploy хийсэн ч юу ч эвдрэхгүй.

---

## ⚠️⚠️ ХОЁР ДОМЭЙН — ЯЛГААГ ОЙЛГОХ

Нэг л R2 bucket (`buckets`) руу **хоёр домэйн** заадаг. Агуулга нь
өөр шаардлагатай тул дүрэм нь ч өөр:

| | `assets.besttv.us` | `cdn.besttv.us` |
|---|---|---|
| Юу | Зураг: постер, backdrop, аватар | Видео: HLS сегмент |
| Эрх | Шаардахгүй (нүүрэнд бүгдэд харагдана) | Шаардана (багц/түрээс) |
| Урд нь | Шууд R2 + **WAF дүрэм** | **Worker** (HMAC гарын үсэг) |
| Кэш | Cloudflare урт кэш | Worker дамжуулж кэшилнэ |

**Яагаад зургийг presign хийдэггүй вэ:** нүүр хуудсанд 50+ постер
зэрэг ачаалагдана. Presign хийвэл URL бүр өөр болж Cloudflare
кэшлэж чадахгүй → хуудас удаан. Зураг задарсан ч алдагдалгүй.

### WAF дүрэм (`assets.besttv.us` дээр ЗААВАЛ)

Cloudflare → besttv.us → Security → WAF → Custom rules:

```
(http.host eq "assets.besttv.us"
 and (starts_with(http.request.uri.path, "/movies/")
   or starts_with(http.request.uri.path, "/episodes/")
   or starts_with(http.request.uri.path, "/raw/")
   or starts_with(http.request.uri.path, "/backups/")))
```
Action: **Block**

⚠️⚠️ **R2-ийн БҮХ folder-ыг ЖАГСААЖ шалгана** — DB-ийн key-ээс
таамаглаж БОЛОХГҮЙ. Бодит алдаа 2 УДАА гарсан:

1. Эхэндээ зөвхөн `/movies/` хаасан → `/episodes/` мартагдаж
   **40 ангийн сегмент токенгүйгээр татагдаж байв** (601 KB бодитоор).

2. Дараа нь «зөвшөөрөгдсөнийг л нээх» болгосон
   (`not /images/ and not /avatars/`) → `/brand/logo.png` хаагдаж
   **САЙТЫН ЛОГО ЭВДЭРСЭН**. Шалтгаан: `brand/` нь DB-ийн key
   баганад биш, `Settings` хүснэгтийн JSON дотор байсан тул
   prefix шалгалтад харагдаагүй.

**Дүгнэлт:** R2 Dashboard → buckets → folder жагсаалтыг НҮДЭЭР хараад
видео/эмзэг folder-ыг НЭРЛЭН хаах нь хамгийн найдвартай.

⚠️ Шинэ folder нэмэхэд энэ дүрмийг ШИНЭЧИЛ.

### R2 folder-ууд (2026-08-15)

| Folder | Юу | Дүрэм |
|---|---|---|
| `movies/` | кино HLS | 🔒 хаах |
| `episodes/` | цуврал HLS | 🔒 хаах |
| `raw/` | түүхий видео (хөрвүүлэхийн өмнөх) | 🔒 хаах |
| `backups/` | нөөц файл | 🔒 хаах |
| `images/` | постер, backdrop, blog cover | ✅ нээх |
| `avatars/` | профайл зураг | ✅ нээх |
| `brand/` | **сайтын лого**, favicon | ✅ нээх |
### DB дэх prefix (2026-08-15)

```
images    200   → public ✅
movies    142   → хаах  🔒
episodes   40   → хаах  🔒
avatars     3   → public ✅
```

Трейлер бүгд YouTube (`trailerYoutubeKey`) — R2-д HLS трейлер 0 тул
дүрэм трейлерийг эвдэхгүй.

### Шалгах (deploy бүрийн дараа)

```bash
# Хаагдсан байх ёстой
curl -o /dev/null -w '%{http_code}\n' https://assets.besttv.us/episodes/<uuid>/v0_seg_000.ts   # 403
curl -o /dev/null -w '%{http_code}\n' https://assets.besttv.us/movies/<uuid>/v0_seg_000.ts     # 403
curl -o /dev/null -w '%{http_code}\n' https://cdn.besttv.us/episodes/<uuid>/v0_seg_000.ts      # 404

# Нээлттэй байх ёстой
curl -o /dev/null -w '%{http_code}\n' https://assets.besttv.us/images/<...>.webp               # 200
```

### Хурд (бодит хэмжилт, Монголоос 2026-08-15)

```
R2 шууд :  601 KB / 234ms = 2.5 MB/s
Worker  : 4135 KB / 400ms = 10 MB/s  (cf-cache HIT)
```
Worker нэмснээр УДААШРААГҮЙ — Cloudflare edge кэшийн ачаар хурдассан.
