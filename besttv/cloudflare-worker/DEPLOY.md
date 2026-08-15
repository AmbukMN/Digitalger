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
 and not starts_with(http.request.uri.path, "/images/")
 and not starts_with(http.request.uri.path, "/avatars/"))
```
Action: **Block**

⚠️⚠️ **ЯАГААД «ЗӨВШӨӨРӨГДСӨНИЙГ Л НЭЭХ» ЗАРЧИМ ВЭ:**

Өмнө нь дүрэм нь `/movies/` ГАНЦЫГ хаадаг байсан. Тэгэхэд
`/episodes/` мартагдаж, **40 ангийн сегмент токенгүйгээр HTTP 200
буцааж байв** (production дээр бодитоор илэрсэн — 601 KB татагдсан).

Одоогийн дүрэм нь эсрэгээрээ: зөвхөн зураг зөвшөөрч, үлдсэн БҮГДИЙГ
хаана. Ирээдүйд шинэ видео prefix (`trailers/`, `previews/`) нэмэхэд
**автоматаар хамгаалагдана** — мартах эрсдэлгүй.

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
