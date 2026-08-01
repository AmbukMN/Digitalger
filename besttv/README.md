yt-dlp
# BestTV — Кино/цуврал стриминг платформ

**Бүрэн бие даасан сайт** — DigitalGer-тэй код, DB, Redis, R2 огт хуваалцахгүй
(зөвхөн батлагдсан код-загварыг хуулж авсан). Ганцхан QPay merchant-ийг л
DigitalGer-тэй хамтран ашиглана (тусдаа мерчант авах хүртэл).

## Бүтэц

```
besttv/
├── backend/    NestJS 11 + Prisma 6      → :4100
├── frontend/   Next.js 15 (үзэгчид)      → :3100
├── admin/      Next.js 15 (контент удирдлага) → :3101
├── shared/     @besttv/shared UI + types
└── docker/     Тусдаа Postgres+Redis (5434 / 6380)
```

## Архитектур

- **R2 private bucket** — public URL байхгүй, бүх зураг/видео presigned URL-ээр
- **HLS стриминг** — видео upload → worker ffmpeg-ээр m3u8+ts болгож хөрвүүлнэ
  (`-c copy`, чанар 100% хадгалагдана) → R2. Тоглуулахдаа backend
  `/stream/movie/:id/playlist.m3u8` эрх шалгаад segment-үүдийг presigned URL
  болгож буцаана — segment өөрсдөө R2-оос шууд татагдана (bandwidth
  backend-ээр дамжихгүй)
- **QPay subscription** — Plan (сар/улирал/жил) худалдаж авахад Subscription
  үүсч/сунгагдана. Token expiry, 401 retry, idempotent confirm — DigitalGer
  дээр батлагдсан QPay клиент дахин ашигласан (код бие даасан хуулбар)

## Эхлүүлэх

```powershell
# 1. Тусдаа Postgres + Redis container (DigitalGer-ийнхээс ӨӨР порт: 5434/6380)
docker compose -f docker/docker-compose.yml up -d

# 2. .env үүсгэх
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
cp admin/.env.example admin/.env.local
# → backend/.env дотор R2_* (шинэ тусдаа R2 account),
#   QPAY_* (DigitalGer-ийн QPay merchant утгыг хуулна) бөглөнө

# 3. Суулгах
npm install

# 4. DB migration + seed
cd backend
npx prisma migrate dev
npx prisma db seed   # admin@besttv.mn / Admin@12345 + жанр/багц

# 5. Ажиллуулах (тус тусдаа terminal)
npm run dev:backend    # :4100
npm run dev:worker      # HLS хөрвүүлэлтийн consumer
npm run dev:frontend    # :3100
npm run dev:admin       # :3101
```

## Контент нэмэх урсгал (admin)

1. `/titles/new` → гарчиг, тайлбар, poster/backdrop upload, жанр сонгох (эсвэл
   "TMDB-ээс импорт" товчоор хайж автоматаар бөглөх) → Хадгалах
2. Кино бол шууд видео upload (browser → R2 шууд, presigned PUT) → worker
   автоматаар HLS болгож хөрвүүлнэ (~1-3 мин, файлын хэмжээнээс хамаарна)
3. Цуврал бол Улирал нэмээд, улирал тус бүрт Анги нэмж, анги бүрт видео
   upload хийнэ
4. `streamStatus: READY` болмогц frontend дээр тоглуулах боломжтой

## TMDB импорт

`TMDB_API_KEY` тохируулбал admin дээр контент нэмэхэд "TMDB-ээс импорт" товч
идэвхжиж, хайсан кино/цувралын poster/backdrop/тайлбар/жанрыг автоматаар R2-д
татаж, формыг бөглөнө (themoviedb.org дээрээс үнэгүй API key авна).

## Watch UX

- Цуврал үзэхэд episode sidebar (улирлаар бүлэглэсэн) харагдана
- Анги дуусахад дараагийн анги автоматаар үргэлжилнэ (`onEnded` → auto-advance)
- "Үргэлжлүүлэн үзэх" — сүүлд үзсэн байрлалаас үргэлжилнэ (`WatchProgress`)
