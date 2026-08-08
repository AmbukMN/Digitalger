/**
 * BestTV — mgldrama.com богино драмуудын seed (гарчиг + постер + AI тайлбар).
 * Эх сурвалж: prisma/mgldrama-seed-data.json
 *
 * ⚠️ ЗӨВХӨН метадата + постер. ВИДЕОГ энд оруулахгүй (streamStatus=NONE) —
 *   видео нь 208 GB тул `seed-mgldrama-videos.ts`-ээр тусад нь байршуулна.
 *
 * ⚠️ ИДЕМПОТЕНТ + ВИДЕО ХАМГААЛАЛТ: гарчиг/slug давхцвал ЗӨВХӨН хоосон
 *   талбарыг нөхнө. `videoKey`/`streamStatus`-г ХЭЗЭЭ Ч хөндөхгүй, мөн
 *   гараар бичсэн тайлбар/постерыг ДАРЖ БИЧИХГҮЙ.
 *
 * ⚠️⚠️ TMDB ЭНД АЖИЛЛАХГҮЙ — БОДИТООР ТЕСТЛЭЖ БАТАЛСАН:
 *   Хятадын богино драм (микро-драм) нь Douyin/TikTok эко-системийн
 *   контент бөгөөд TMDB-д бүртгэгддэггүй. 6/6 хайлт ТЭГ үр дүн өгсөн
 *   ("The Legend of Stepmother", "Silent Revenge", "14 Years of Vow"…).
 *   Сохроор таарвал ОГТ ӨӨР кино орно — production дээр аль хэдийн
 *   ийм алдаа гарсан (Love MAP → америк кино, Litsoneras → филиппин).
 *   Тиймээс тайлбарыг AI-аар гарчигаас нь үүсгэнэ.
 *
 * Ажиллуулах (production .env-тэй):
 *   DOTENV_CONFIG_PATH=.env.production npx ts-node --transpile-only prisma/seed-mgldrama.ts
 * Урьдчилан туршихад (R2/DB/AI бичихгүй):
 *   DRY_RUN=1 DOTENV_CONFIG_PATH=.env.production npx ts-node --transpile-only prisma/seed-mgldrama.ts
 * AI тайлбар унтраах:
 *   NO_AI=1 ...
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
const NO_AI = process.env.NO_AI === '1';

// Постерын хавтас (mgldrama.com-оос татсан, монгол нэртэй)
const POSTER_DIR = process.env.POSTER_DIR || 'D:\\movies\\busad kino\\_posters';
const DATA_FILE = path.join(__dirname, 'mgldrama-seed-data.json');

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

interface SeedDrama {
  title: string;
  videoFile: string;
  posterFile: string | null;
  slug: string | null;
  isAdult: boolean;
  genre: 'dram' | 'nasand-huregchdiin';
}

// ─── AI тайлбар ──────────────────────────────────────────────────────────────

/**
 * Гарчигаас МОНГОЛ тайлбар үүсгэнэ (TMDB-д байхгүй тул).
 *
 * ⚠️ Богино драмын гарчиг нь өгүүлэмжээ бүтнээр агуулдаг ("Охиныхоо
 * өшөөг авсан жанжин ээж") тул AI үүнээс утга зохистой тайлбар бичиж
 * чадна — зохиомол баримт (он, жүжигчин) НЭМЭХГҮЙ гэдгийг нь ЗААНА.
 *
 * ⚠️ Унавал `null` — тайлбаргүй үлдэх нь ХУДЛАА тайлбартай байхаас дээр.
 */
async function aiDescription(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const key = process.env.OPENAI_API_KEY;
  if (NO_AI || !key || !titles.length) return out;

  /**
   * ⚠️ БАГЦААР илгээнэ (8-аар) — 49 тусдаа дуудалт нь удаан бөгөөд
   * үнэтэй. Багц хэт том бол LLM сүүлийн хэдийг чанаргүй бичдэг.
   */
  const BATCH = 8;
  for (let i = 0; i < titles.length; i += BATCH) {
    const chunk = titles.slice(i, i + BATCH);
    const prompt = [
      'Чи бол монгол кино сайтын контент редактор.',
      'Доорх нь ХЯТАДЫН богино драмуудын МОНГОЛ гарчиг.',
      'Гарчиг бүрд 2-3 өгүүлбэрийн татахуйц тайлбар бич.',
      '',
      'ДҮРЭМ:',
      '1. ⚠️ ЗОХИОМОЛ БАРИМТ БҮҮ НЭМ — он, жүжигчний нэр, ангийн тоо,',
      '   шагнал зэргийг МЭДЭХГҮЙ тул бичихгүй. Зөвхөн гарчигт агуулагдсан',
      '   өгүүлэмжийг дэлгэрүүлж бич.',
      /**
       * ⚠️ Тест дээр "энэхүү богино драм нь…" гэж эхэлж, "драм" гэсэн
       * гадаад үг үлдсэн. Мөн бүх тайлбар ижил хэвээр эхэлдэг тул
       * жагсаалт нэг хэвийн уншигдана.
       */
      '2. ⚠️ ГАДААД ҮГ БҮҮ ХЭРЭГЛЭ: "драм", "интриг", "сюжет", "финал"',
      '   → "кино", "нууц сүлжээ", "өгүүлэмж", "төгсгөл".',
      '3. ⚠️ "Энэхүү кино нь…", "Энэ бол…" гэж БҮҮ эхэл — шууд',
      '   өгүүлэмжээс эхэл. Тайлбар бүр ӨӨР өгүүлбэрийн бүтэцтэй байг.',
      '4. Сүүлийг "..." гэж таслахгүй, бүтэн өгүүлбэрээр төгс.',
      '5. Хэт сурталчилгаа биш — агуулгыг хэлж, сонирхол төрүүл.',
      '',
      'ГАРЧГУУД:',
      ...chunk.map((t, n) => `${n + 1}. ${t}`),
      '',
      'ЗӨВХӨН JSON массив буцаа, дараалал ИЖИЛ:',
      '[{"title":"...","description":"..."}]',
    ].join('\n');

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 2000,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        console.log(`    ⚠️  AI ${res.status} — энэ багцыг алгаслаа`);
        continue;
      }
      const d = await res.json();
      const raw = d.choices?.[0]?.message?.content ?? '';
      /* ⚠️ ```json ... ``` дотор боож буцаах нь энгийн */
      const s = raw.indexOf('[');
      const e = raw.lastIndexOf(']');
      if (s === -1 || e <= s) continue;
      const arr = JSON.parse(raw.slice(s, e + 1)) as { title?: string; description?: string }[];
      for (const item of arr) {
        const t = String(item.title ?? '').trim();
        const desc = String(item.description ?? '').trim();
        /* ⚠️ Гарчиг нь ирсэн жагсаалтад БАЙГАА эсэхийг шалгана — LLM
           гарчгийг өөрчилвөл буруу кинонд тайлбар онооно */
        if (t && desc && chunk.includes(t)) out.set(t, desc);
      }
      console.log(`    ✍️  AI тайлбар: ${out.size}/${Math.min(i + BATCH, titles.length)}`);
    } catch (err) {
      console.log(`    ⚠️  AI алдаа: ${String(err)} — алгаслаа`);
    }
  }
  return out;
}

/** SEO — `TmdbService.autoSeo`-той ИЖИЛ загвар (нэгийг засвал нөгөөг ч) */
function autoSeo(title: string, description: string) {
  const full = `${title} — BestTV дээр онлайнаар үзэх`;
  const metaTitle = full.length <= 60 ? full : `${title} — BestTV`.slice(0, 60);

  const clean = description.replace(/\s+/g, ' ').trim();
  let metaDescription: string;
  if (clean.length >= 80) {
    metaDescription = clean.length <= 160 ? clean : `${clean.slice(0, 157).trimEnd()}...`;
  } else {
    const filled = `${clean ? `${clean} ` : ''}${title} киног BestTV дээр өндөр чанартай, зар сурталчилгаагүй үзээрэй.`;
    metaDescription = filled.length <= 160 ? filled : `${filled.slice(0, 157).trimEnd()}...`;
  }
  return { metaTitle, metaDescription };
}

// ─── R2 / жанр ───────────────────────────────────────────────────────────────

async function uploadPoster(localPath: string): Promise<string> {
  const raw = await fs.readFile(localPath);
  const buf = await sharp(raw)
    .resize({ width: 600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const key = `images/poster/${randomUUID()}.webp`;
  if (DRY_RUN) {
    console.log(`    [dry] poster: ${path.basename(localPath)} → ${Math.round(buf.length / 1024)}KB`);
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

async function ensureGenre(slug: string, name: string, isAdult: boolean): Promise<string> {
  if (DRY_RUN) {
    const g = await prisma.genre.findUnique({ where: { slug } });
    return g?.id ?? `dry:${slug}`;
  }
  const g = await prisma.genre.upsert({
    where: { slug },
    update: {},
    create: { slug, name, isAdult, order: isAdult ? 20 : 1 },
  });
  return g.id;
}

/** Гарчиг харьцуулах нормчлол — зай/тэмдэг/том жижиг үсэг ялгаагүй */
const norm = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[«»"'`.,!?—–-]/g, '');

// ─── Үндсэн урсгал ───────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? '🧪 DRY_RUN — R2/DB бичихгүй\n' : '🚀 mgldrama seed эхэллээ\n');
  const dramas: SeedDrama[] = JSON.parse(await fs.readFile(DATA_FILE, 'utf-8'));
  console.log(`${dramas.length} драма seed-д байна.\n`);

  // ⚠️ Бүх драмыг НЭГ шинэ жанрт: "Хятад болон Ай кино"
  const GENRE_ID = await ensureGenre('hyatad-ai-kino', 'Хятад болон Ай кино', false);
  /* ⚠️ 18+ драм нь НЭМЭЛТЭЭР насанд хүрэгчдийн жанрт ч орно — эс бөгөөс
     ерөнхий каталогт шүүлтгүй гарна */
  const ADULT_GENRE_ID = await ensureGenre('nasand-huregchdiin', 'Насанд хүрэгчдийн', true);

  const existing = await prisma.title.findMany({
    select: { id: true, slug: true, title: true, description: true, posterKey: true },
  });
  const takenSlugs = new Set(existing.map((t) => t.slug));
  const byTitle = new Map(existing.map((t) => [norm(t.title), t]));
  const bySlug = new Map(existing.map((t) => [t.slug, t]));

  /* ⚠️ AI тайлбарыг УРЬДЧИЛЖ багцаар авна — драм бүрд нэг дуудалт хийвэл
     49 удаа сүлжээнд очиж удаан болно */
  console.log('✍️  AI тайлбар үүсгэж байна…');
  const descs = await aiDescription(dramas.map((d) => d.title));
  console.log(`   ${descs.size}/${dramas.length} тайлбар бэлэн\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const d of dramas) {
    if (!d.posterFile) {
      console.log(`  ⚠️  ${d.title} — постергүй, алгаслаа`);
      skipped++;
      continue;
    }
    const posterPath = path.join(POSTER_DIR, d.posterFile);
    try {
      await fs.access(posterPath);
    } catch {
      console.log(`  ⚠️  ${d.title} — постер файл алга (${d.posterFile})`);
      skipped++;
      continue;
    }

    const baseSlug = slugify(d.title);
    const found = byTitle.get(norm(d.title)) ?? bySlug.get(baseSlug) ?? null;
    const description = descs.get(d.title) ?? '';
    const seo = autoSeo(d.title, description);

    if (found) {
      /**
       * ⚠️⚠️ ЗӨВХӨН ХООСОН талбарыг нөхнө. Админ гараар бичсэн тайлбар/
       * постерыг ДАРЖ БИЧВЭЛ ажил үрэгдэнэ. `videoKey`/`streamStatus`-г
       * ОГТ дурдахгүй — тэдгээр нь энэ script-ийн хамрах хүрээнд БАЙХГҮЙ.
       */
      const data: Record<string, unknown> = {};
      if (!found.description?.trim() && description) {
        data.description = description;
        data.metaTitle = seo.metaTitle;
        data.metaDescription = seo.metaDescription;
      }
      if (!found.posterKey) data.posterKey = await uploadPoster(posterPath);

      if (!Object.keys(data).length) {
        console.log(`  ⏭️  ${d.title} — бүх талбар дүүрэн, хөндөөгүй`);
        skipped++;
        continue;
      }
      if (!DRY_RUN) {
        await prisma.title.update({ where: { id: found.id }, data });
        await prisma.titleGenre.upsert({
          where: { titleId_genreId: { titleId: found.id, genreId: GENRE_ID } },
          update: {},
          create: { titleId: found.id, genreId: GENRE_ID, order: 0 },
        });
      }
      console.log(`  ♻️  UPDATE  ${d.title}  (${Object.keys(data).join(', ')})`);
      updated++;
      continue;
    }

    const posterKey = await uploadPoster(posterPath);
    const slug = uniqueSlug(baseSlug, takenSlugs);
    takenSlugs.add(slug);

    if (!DRY_RUN) {
      await prisma.title.create({
        data: {
          type: TitleType.MOVIE,
          slug,
          title: d.title,
          description,
          metaTitle: seo.metaTitle,
          metaDescription: seo.metaDescription,
          /* ⚠️ Видеогүй тул NONE — админ панельд "Видеогүй" гэж шүүгдэнэ */
          streamStatus: StreamStatus.NONE,
          isPremium: true,
          posterKey,
          ...(d.isAdult ? { ageRating: '18+' } : {}),
          genres: {
            create: [
              { genreId: GENRE_ID, order: 0 },
              ...(d.isAdult ? [{ genreId: ADULT_GENRE_ID, order: 1 }] : []),
            ],
          },
        },
      });
    }
    console.log(`  ✅ CREATE  ${d.title}  (${slug})${d.isAdult ? ' 18+' : ''}${description ? ' 📝' : ''}`);
    created++;
  }

  const total = await prisma.title.count();
  console.log(`\n📊 Үүсгэсэн: ${created}  |  Шинэчилсэн: ${updated}  |  Алгассан: ${skipped}`);
  console.log(`🎬 DB-д нийт ${total} Title.`);
  if (!DRY_RUN && created) {
    console.log('\n⚠️  Видео ОРООГҮЙ (streamStatus=NONE). Дараагийн алхам:');
    console.log('   npx ts-node --transpile-only prisma/seed-mgldrama-videos.ts');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
