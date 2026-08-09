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
