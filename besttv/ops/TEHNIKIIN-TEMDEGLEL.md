# Техникийн тэмдэглэл — дахин алдахаас сэргийлэх

Олон удаа алдсаны эцэст олсон, кодоос харагдахгүй мэдлэг.

---

## ⚠️ `loading.tsx` нь `notFound()`-ыг эвдэнэ

**Илэрсэн:** 2026-08-09 · **4 оролдлогын эцэст**

### Шинж тэмдэг

`notFound()` дуудагдаж `not-found.tsx` рендерлэгддэг **мөртлөө**
HTTP статус **200** үлддэг. Google эвдэрсэн холбоосыг индексжүүлнэ
(soft 404).

### Шалтгаан

Route-д `loading.tsx` байх нь Next-д **streaming** идэвхжүүлдэг —
хариуны толгойг ЭРТ илгээх тул `notFound()` дараа нь статусыг
өөрчилж чадахгүй.

### Бүтээгүй оролдлогууд

| # | Юу хийсэн | Үр дүн |
| --- | --- | --- |
| 1 | Page-д `notFound()` нэмсэн | ❌ 200 |
| 2 | `generateMetadata`-д ч нэмсэн | ❌ 200 |
| 3 | Route-ийн дэргэд `not-found.tsx` | ❌ 200 |
| 4 | **`loading.tsx` хассан** | ✅ **404** |

### Зөв шийдэл

`loading.tsx`-ыг устгахгүй — **нэр солиод `Suspense`-д ашиглана**:

```tsx
// loading.tsx → detail-skeleton.tsx (нэр солино)
export default function DetailSkeleton() { /* … */ }

// page.tsx
import DetailSkeleton from './detail-skeleton';

export default async function Page() {
  if (missing) notFound();           // ← статус ЭНД тогтоно
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <DetailClient />                {/* streaming ЭНДЭЭС эхэлнэ */}
    </Suspense>
  );
}
```

Skeleton хэвээр харагдана, статус ч зөв.

### Нэмэлт: `notFound()`-ыг ХОЁР ГАЗАРТ

`generateMetadata` **ба** page component хоёуланд дуудна. Блог дээр
зөвхөн метадатад байхад 200 хэвээр байсныг хэмжсэн — Next аль шатанд
статусыг бэхлэхийг баталгаагүй.

### `notFound()` нь EXCEPTION шиддэг

`try` блок дотор дуудвал `catch` барьж аваад **хэзээ ч ажиллахгүй**:

```tsx
// ❌ БУРУУ
try {
  const res = await fetch(url);
  if (res.status === 404) notFound();   // catch залгина!
} catch { /* … */ }

// ✅ ЗӨВ — fetch дотор, шийдвэр гадна
let missing = false;
try {
  const res = await fetch(url);
  missing = res.status === 404;
} catch { /* сүлжээний алдаа — 404 БИШ */ }
if (missing) notFound();
```

### «Олдсонгүй» ба «сүлжээ унасан»-ыг ЯЛГА

Хоёулаа 404 болговол backend түр унахад **байгаа** кино Google-ийн
индексээс хасагдана (сэргэхэд буцаж орох нь удаан). Зөвхөн
`status === 404` үед л `notFound()`.

---

## ⚠️ `sitemap.ts` — build үед хоосон үүсдэг

**Илэрсэн:** 2026-08-09 · **3 оролдлогын эцэст**

`.next/server/app/sitemap.xml.body` нь **build үед** үүсээд
`max-age=0, must-revalidate` толгойтой тул Next түүнийг тогтмол
барина. Build үед backend хүрдэггүй (container хараахан асаагүй)
→ файл ҮРГЭЛЖ хоосон, container дахин үүсэх бүрд ижил.

| # | Юу хийсэн | Үр дүн |
| --- | --- | --- |
| 1 | Тохиргоогүй | ❌ 5 URL |
| 2 | `force-dynamic` + `revalidate` хамт | ❌ зөрчилдөнө |
| 3 | `revalidate` ганцаараа | ❌ 5 URL |
| 4 | **`force-dynamic` ганцаараа** | ✅ **142 URL** |

`export const revalidate` ТАВЬЖ БОЛОХГҮЙ — `force-dynamic`-тай
зөрчилдөнө. Кэшлэлт нь `fetch(..., { next: { revalidate } })` дээр.

---

## ⚠️ Каталогийн `limit` нь sitemap-д тохирохгүй

`titles.list()` нь `Math.min(60, limit)` — `?limit=1000` гэсэн ч 60
буцаана. Тэр хязгаар нь **хэрэглэгчийн каталогийг хамгаалдаг** тул
өсгөж БОЛОХГҮЙ.

Sitemap-д тусдаа хөнгөн endpoint: `/titles/sitemap` (зөвхөн
`slug` + `updatedAt`, `CARD_SELECT`-ээс 20 дахин бага).

---

## ⚠️ 18+ контент — ГУРВАН давхар хамгаалалт

`/adult` жагсаалтын хуудсыг `noindex` болгох нь ХАНГАЛТГҮЙ —
киноны дэлгэрэнгүй (`/movie/<slug>`) нь **тусдаа зам**.

1. Sitemap-аас хасах (`allSlugs`-д `NOT_ADULT`)
2. Хуудас өөрөө `robots: { index: false }` (гадны холбоосоор олдвол)
3. `robots.txt`-д `/adult`

---

## ⚠️ Prisma нь олон-олон холбоосын талбараар эрэмбэлж ЧАДДАГГҮЙ

`title.findMany({ orderBy: { genres: { order } } })` — **боломжгүй**.

Жанр доторх киног `TitleGenre.order`-оор эрэмбэлэхийн тулд
холбоосын хүснэгт талаас query хийнэ:

```ts
prisma.titleGenre.findMany({
  where: { genre: { slug } },
  orderBy: [{ order: 'asc' }, { title: { createdAt: 'desc' } }],
  select: { title: { select: CARD_SELECT } },
});
```

---

## ⚠️ Цувралын видео нь `Title` дээр БИШ, `Episode` дээр

`Title.streamStatus` нь SERIES-д **хэзээ ч `READY` болдоггүй**.
Бэлэн эсэхийг шалгахдаа:

```ts
MOVIE  → Title.streamStatus === 'READY'
SERIES → seasons.some(s => s.episodes.some(e => e.streamStatus === 'READY'))
```

Үүнийг мартвал 10 анги нь бүрэн бэлэн цуврал ч «тоглох боломжгүй»
гэж тоологдоно.

---

## ⚠️ Видеоны код өөрчилбөл `worker`-ийг ЗААВАЛ rebuild

**Илэрсэн:** 2026-08-09 (дахин)

`backend` rebuild хийхэд `worker` **шинэчлэгддэггүй** — тэдгээр нь
ТУСДАА container. HLS processor нь зөвхөн worker-д ажилладаг.

### Шинж тэмдэг

Кодыг зассан ч хуучин зан төлөв үргэлжилнэ. Бодит жишээ: ffmpeg
таймаутыг 180 мин → 8 цаг болгосон ч кино дахин *«180 минут
хэтэрлээ»* гэж унасан — worker 23 цагийн өмнөх код ажиллуулж байв.

### Шалгах

```bash
ssh root@62.238.47.2 'docker exec besttv-worker   grep -c "STALL_TIMEOUT_MS" /app/backend/dist/src/storage/video-hls.service.js'
# 0 гарвал → ХУУЧИН код
```

### Rebuild

```bash
ssh root@62.238.47.2 'cd /opt/BestTV/docker &&   docker compose -f docker-compose.prod.yml -p besttv build worker &&   docker compose -f docker-compose.prod.yml -p besttv up -d --force-recreate --no-deps worker'
```

⚠️ Явж буй ажлууд ТАСАЛДАНА — гэхдээ `attempts: 2` тул дараалалд
буцаж орно. Хөрвүүлэлт эхнээсээ дахин эхэлнэ (30+ мин алдагдал),
тиймээс боломжтой бол ажил цөөн үед хийнэ.

### Аль код worker-т нөлөөлдөг вэ

- `src/storage/video-hls.service.ts` (ffmpeg, таймаут)
- `src/modules/videos/video.processor.ts` (дараалал, диск шалгалт)
- `src/modules/videos/video-recovery.service.ts`
- Email/queue/BullMQ холбоотой бүх код

---

## 6. JWT нь НЭГ СЕКУНДЭД ИЖИЛ ТОКЕН үүсгэдэг (`jti` заавал)

**Шинж:** Хоёр төхөөрөмжөөс зэрэг нэвтэрхэд нэг л session бүртгэгдэнэ.
Лог: `Unique constraint failed on the fields: (tokenHash)`.

**Шалтгаан:** JWT-ийн `iat`/`exp` нь **секундын** нарийвчлалтай. Нэг
хэрэглэгч нэг секундэд хоёр удаа нэвтэрвэл payload (`{sub}`) ижил,
`iat` ижил → гарын үсэг ижил → **ЯГ ИЖИЛ ТОКЕН**.

**Үр дагавар (төхөөрөмжийн хязгаарт):**
- 2 дахь session бүртгэгдэхгүй → хязгаар огт ажиллахгүй
- Хоёр төхөөрөмж нэг мөр хуваалцана → нэгийг гаргахад нөгөө нь ч гарна

**Засвар:** refresh token-д `jti: randomUUID()` нэмнэ
(`auth.service.ts` → `signTokens`).

⚠️ Access token-д хэрэггүй (түүнийг DB-д хадгалдаггүй).

---

## 7. `/api/auth/sessions` нь NextAuth руу орж 400 өгдөг байв

**Шинж:** `This action with HTTP GET is not supported by NextAuth.js`

**Шалтгаан:** `next.config.ts` rewrite-ийн regex
`(?!signin|signout|callback|session|csrf|providers|error|bridge)` нь
**угтвараар** тааруулдаг тул `sessions` нь `session`-д таарч,
backend руу rewrite хийгдэхгүй NextAuth catch-all руу орно.

**Засвар:** үгийн төгсгөл шалгана —
`(?!(?:signin|…|bridge)(?:$|/))`

⚠️ Ирээдүйд `/auth/callbacks`, `/auth/providers-list` гэх мэт нэр
нэмбэл ижил алдаанд орно. Шинэ `/api/auth/*` зам нэмэх бүрд
`node -e` тестээр regex-ыг шалгах.

---

## 8. Cloudflare-ийн ард бодит IP авах

`req.ip` → `172.69.x.x` (Cloudflare-ийн сервер). Хэрэглэгчийн бодит IP
нь **`CF-Connecting-IP`** header-т байна.

Дараалал: `CF-Connecting-IP` → `X-Forwarded-For`-ын эхний утга → `req.ip`.

⚠️ Эрх шалгахад IP хэрэглэхгүй (гаднаас хуурамчаар илгээж болно) —
зөвхөн хэрэглэгчид ХАРУУЛАХ зорилготой.

---

## 9. Төхөөрөмжийн хязгаар (`MAX_DEVICES = 2`)

**Хаана:** `backend/src/modules/auth/session.service.ts`

| Зан төлөв | Тайлбар |
|---|---|
| Хязгаар | 2 (нэвтэрсэн төхөөрөмжөөр, зэрэг үзэж буй урсгалаар БИШ) |
| Хэтэрвэл | Хамгийн **удаан ашиглаагүй** нь автоматаар гарна |
| ADMIN | Хязгааргүй (админ панел + сайт хоёулангаас ордог) |
| DB алдаа | **Fail-open** — нэвтрэлт зогсоохгүй |
| Токен | SHA-256 хэшээр хадгална (цэвэр утгаар БИШ) |
| Rotation | `refresh` бүрт хуучин мөр устаж шинэ бичигдэнэ |

**Endpoint:** `GET /auth/sessions?rt=<refresh>`,
`DELETE /auth/sessions/:id`, `POST /auth/sessions/revoke-others`,
`POST /auth/logout`

⚠️ **`/auth/logout` заавал дуудагдана** — эс бөгөөс session мөр
30 хоног үлдэж хязгаарын байрыг дэмий эзэлнэ (хэрэглэгч 2 удаа
гараад орвол «дүүрсэн» болно).

⚠️ Багцын нөхцөлд «Олон төхөөрөмж» гэж бичиж БОЛОХГҮЙ — DB-ийн
`Plan.features` дээр «2 төхөөрөмж хүртэл» гэж засагдсан.

---

## 10. Цувралын `streamStatus` нь эцэг `Title` дээр ХЭЗЭЭ Ч READY болдоггүй

**Шинж:** 10/10 анги бүрэн хөрвүүлсэн атлаа карт дээр «Бэлтгэж байна».

**Шалтгаан:** SERIES-ийн видео нь `Episode` дээр. `Title.streamStatus`
нь `NONE` хэвээр үлддэг.

**Засвар:** `CARD_SELECT`-д `seasons.episodes.streamStatus` нэмээд
`TitleMediaHelper.decorate()` дотор тооцно (**бүх карт тэр функцээр
дамждаг** тул нэг газар засахад 14 дуудлага бүгд зөв болно).

Дүрэм: **нэг ч анги READY бол READY** (цуврал ангиараа гардаг тул
«бүгд бэлэн болтол хүлээ» гэж харуулах нь буруу).

⚠️ Админ талд (`titles-admin.service.ts`) ижил логик тусад нь бий —
нэгийг өөрчилвөл нөгөөг нь ч шалгах.
