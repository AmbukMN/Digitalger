/**
 * BestTV — БОДИТ монгол киноны seed (постер + backdrop + метадата).
 * Эх сурвалж: prisma/besttv-seed-data.json (mglkino.site-аас тулгасан гарчиг/жанр
 * + интернетээс баяжуулсан тайлбар/он/найруулагч).
 *
 * ⚠️ ИДЕМПОТЕНТ + ВИДЕО ХАМГААЛАЛТ:
 *   - Гарчиг эсвэл slug аль хэдийн байвал → ЗӨВХӨН метадата (тайлбар, он, постер,
 *     backdrop, жанр...) update хийнэ. videoKey/streamStatus/videoRawKey-г
 *     ХЭЗЭЭ Ч ХӨНДӨХГҮЙ (гараар орсон бэлэн видео эвдрэхгүй).
 *   - Байхгүй бол → шинээр үүсгэнэ (type=MOVIE, streamStatus=NONE, видеогүй).
 *
 * Постер/backdrop-г sharp-аар WebP болгож (poster 600px, backdrop 1920px —
 * админы uploads.controller-тэй ЯГ ижил) R2 private bucket руу upload хийнэ.
 *
 * Ажиллуулах (production .env-тэй):
 *   npx ts-node --compiler-options {"module":"CommonJS"} prisma/seed-besttv-movies.ts
 * Урьдчилан туршихад (R2/DB бичихгүй, зөвхөн лог):
 *   DRY_RUN=1 npx ts-node ... prisma/seed-besttv-movies.ts
 */
import 'dotenv/config';
import { PrismaClient, TitleType, StreamStatus } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { slugify, uniqueSlug } from '../src/common/slugify';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === '1';

// Постер/backdrop файлын хавтас (нэр солисон локал зургууд)
const POSTER_DIR = process.env.POSTER_DIR || 'D:\\movies\\busad kino\\besttv';
const BACKDROP_DIR = path.join(POSTER_DIR, '_backdrops');
const DATA_FILE = path.join(__dirname, 'besttv-seed-data.json');

// ── R2 client (storage.service.ts-тэй ижил тохиргоо) ────────────────────────
const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'besttv';
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

interface SeedMovie {
  mglId: number;
  title: string;
  genre: 'mongol-kino' | 'nasand-huregchdiin';
  isAdult: boolean;
  posterFile: string; // POSTER_DIR доторх файлын нэр
  backdropFile: string | null; // BACKDROP_DIR доторх файлын нэр
  year?: number | null;
  director?: string | null;
  cast?: string[];
  ageRating?: string | null;
  description?: string;
}

async function uploadImage(localPath: string, kind: 'poster' | 'backdrop'): Promise<string> {
  const width = kind === 'backdrop' ? 1920 : 600;
  const raw = await fs.readFile(localPath);
  const buf = await sharp(raw).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const key = `images/${kind}/${randomUUID()}.webp`;
  if (DRY_RUN) {
    console.log(`    [dry] upload ${kind}: ${localPath} → ${key} (${Math.round(buf.length / 1024)}KB)`);
    return key;
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buf,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=604800',
    }),
  );
  return key;
}

/** Жанр байгаа эсэхийг батална (seed.ts-д үүссэн байх ёстой) */
async function ensureGenre(slug: string, name: string, isAdult: boolean): Promise<string> {
  if (DRY_RUN) {
    const g = await prisma.genre.findUnique({ where: { slug } });
    return g?.id ?? `dry:${slug}`;
  }
  const g = await prisma.genre.upsert({
    where: { slug },
    update: {},
    create: { slug, name, isAdult, order: isAdult ? 20 : 10 },
  });
  return g.id;
}

async function main() {
  console.log(DRY_RUN ? '🧪 DRY_RUN — R2/DB бичихгүй, зөвхөн лог\n' : '🚀 Production seed эхэллээ\n');

  const movies: SeedMovie[] = JSON.parse(await fs.readFile(DATA_FILE, 'utf-8'));
  console.log(`${movies.length} кино seed-д байна.\n`);

  const genreIds = {
    'mongol-kino': await ensureGenre('mongol-kino', 'Монгол кино', false),
    'nasand-huregchdiin': await ensureGenre('nasand-huregchdiin', 'Насанд хүрэгчдийн', true),
  };

  // Давхардахгүй slug — одоо байгаа бүх slug-ийг цуглуулна
  const existing = await prisma.title.findMany({ select: { id: true, slug: true, title: true } });
  const takenSlugs = new Set(existing.map((t) => t.slug));
  const byTitle = new Map(existing.map((t) => [t.title.trim().toLowerCase(), t]));
  const bySlug = new Map(existing.map((t) => [t.slug, t]));

  let created = 0,
    updated = 0,
    skipped = 0;

  for (const m of movies) {
    const posterPath = path.join(POSTER_DIR, m.posterFile);
    try {
      await fs.access(posterPath);
    } catch {
      console.log(`  ⚠️  ${m.title} — постер файл алга (${m.posterFile}), алгаслаа`);
      skipped++;
      continue;
    }

    const baseSlug = slugify(m.title);
    // Байгаа эсэх — гарчиг ЭСВЭЛ slug-аар
    const found =
      byTitle.get(m.title.trim().toLowerCase()) ?? bySlug.get(baseSlug) ?? null;

    // Зураг upload (R2)
    const posterKey = await uploadImage(posterPath, 'poster');
    let backdropKey: string | null = null;
    if (m.backdropFile) {
      const bp = path.join(BACKDROP_DIR, m.backdropFile);
      try {
        await fs.access(bp);
        backdropKey = await uploadImage(bp, 'backdrop');
      } catch {
        /* backdrop алга — алгасна */
      }
    }

    // Метадата (видеонд ХАМААРАХГҮЙ талбарууд)
    const meta = {
      title: m.title,
      description: m.description ?? '',
      year: m.year ?? null,
      director: m.director ?? null,
      actors: Array.isArray(m.cast) ? m.cast : [],
      ageRating: m.ageRating ?? (m.isAdult ? '18+' : null),
      isPremium: true,
      posterKey,
      ...(backdropKey ? { backdropKey } : {}),
    };

    if (found) {
      // ⚠️ ЗӨВХӨН метадата update — видео талбар БҮҮ хөндө
      if (!DRY_RUN) {
        await prisma.title.update({ where: { id: found.id }, data: meta });
        await prisma.titleGenre.upsert({
          where: { titleId_genreId: { titleId: found.id, genreId: genreIds[m.genre] } },
          update: {},
          create: { titleId: found.id, genreId: genreIds[m.genre], order: 0 },
        });
      }
      console.log(`  ♻️  UPDATE  ${m.title}  (slug: ${found.slug}) — видео хөндөөгүй`);
      updated++;
    } else {
      const slug = uniqueSlug(baseSlug, takenSlugs);
      takenSlugs.add(slug);
      if (!DRY_RUN) {
        await prisma.title.create({
          data: {
            type: TitleType.MOVIE,
            slug,
            streamStatus: StreamStatus.NONE,
            ...meta,
            genres: { create: [{ genreId: genreIds[m.genre], order: 0 }] },
          },
        });
      }
      console.log(`  ✅ CREATE  ${m.title}  (slug: ${slug})  [${m.genre}]`);
      created++;
    }
  }

  const total = await prisma.title.count();
  console.log(`\n📊 Үүсгэсэн: ${created}  |  Шинэчилсэн: ${updated}  |  Алгассан: ${skipped}`);
  console.log(`🎬 DB-д нийт ${total} Title байна.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
