/**
 * BestTV — ЦУВРАЛЫН АНГИУДЫН видеог R2 руу байршуулж HLS дараалалд өгнө.
 *
 * `seed-mgldrama-videos.ts` нь БҮТЭН КИНО (Title.videoRawKey) байршуулдаг.
 * Энэ нь ЦУВРАЛЫН АНГИ (Episode.videoRawKey) — өөр хүснэгт, өөр queue
 * target ('episode'), өөр R2 зам (episodes/…).
 *
 * ⚠️⚠️ ХАМГИЙН ЧУХАЛ ЯЛГАА: `target: 'episode'` — үүнийг 'movie' гэвэл
 * processor нь Title хүснэгтээс targetId хайж ОЛОХГҮЙ, ажил чимээгүй
 * унана (Episode-ийн статус NONE хэвээр үлдэнэ).
 *
 * Ажиллуулах:
 *   cd backend
 *   TITLE_SLUG=agent-kim-reactivated npx ts-node --transpile-only prisma/seed-episode-videos.ts
 *
 * Сонголтууд:
 *   TITLE_SLUG=   — аль цувралын ангиуд (заавал)
 *   VIDEO_DIR=    — файлын хавтас
 *   DRY_RUN=1     — төлөвлөгөө харуулна, юу ч илгээхгүй
 *   ONLY=1,2,3    — зөвхөн эдгээр ангийн дугаар
 *   CONCURRENCY=3 — зэрэг хэдэн файл (анхдагч 3 — хэмжсэн оновчтой утга)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListMultipartUploadsCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
/** ⚠️ `bull` (v4) — `bullmq` БИШ (түлхүүрийн бүтэц өөр, worker авахгүй) */
import Bull from 'bull';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === '1';
const TITLE_SLUG = process.env.TITLE_SLUG || '';
const VIDEO_DIR = process.env.VIDEO_DIR || 'D:\\movies\\busad kino';
const VIDEO_QUEUE_NAME = 'besttv-video-hls';
const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'besttv';

/** ⚠️ 32 MB — 10 файл зэрэг явахад RAM 320 MB (100 MB бол 1 GB) */
const PART_SIZE = 32 * 1024 * 1024;
const PART_RETRIES = 4;

/**
 * ⚠️⚠️ 3 — ХЭМЖСЭН оновчтой утга, таамаг БИШ.
 * Өмнөх байршуулалтад хэмжсэн: 1 зэрэг = 7.8 MB/s, 10 зэрэг = 5.6 MB/s,
 * 3 зэрэг = 12.8 MB/s. Олон урсгал нь дээд өргөнийг ХУВААДАГ тул
 * зөвхөн удаашруулна.
 */
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY) || 3);

const ONLY = (process.env.ONLY || '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  requestHandler: { requestTimeout: 600_000 },
});

const gb = (b: number) => (b / 1024 ** 3).toFixed(2);
const mins = (ms: number) => Math.round(ms / 60000);

/**
 * ⚠️⚠️ ФАЙЛЫН НЭРНЭЭС АНГИЙН ДУГААР ОЛОХ.
 *
 * Бодит нэрс:
 *   "1-Р АНГИ Ким тусгай ажилтан.mp4"           → 1
 *   "ТӨГСГӨЛИЙН 10-Р АНГИ Ким тусгай ажилтан.mp4" → 10
 *
 * ⚠️ Эхний тоог АВАХГҮЙ — "ТӨГСГӨЛИЙН" гэх угтвар байвал эхэнд тоо
 * байхгүй ч, өөр нэрэнд ("14 жилийн тангараг") эхний тоо нь анги БИШ.
 * Тиймээс "<тоо>-Р АНГИ" ХЭВ ШИНЖ шаардана — санамсаргүй таарахгүй.
 */
function episodeNumberOf(fileName: string): number | null {
  const m = fileName.match(/(\d+)\s*-?\s*[РP]\s*АНГИ/iu);
  return m ? Number(m[1]) : null;
}

async function uploadMultipart(
  filePath: string,
  key: string,
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  const { size } = await fsp.stat(filePath);

  /* ⚠️ ЗӨВХӨН энэ key-ийн хуучин multipart-ыг цэвэрлэнэ — бусдыг
     хөндвөл идэвхтэй байршуулалт унаж "NoSuchUpload" гарна */
  try {
    const old = await s3.send(new ListMultipartUploadsCommand({ Bucket: R2_BUCKET, Prefix: key }));
    for (const u of old.Uploads ?? []) {
      if (u.Key !== key || !u.UploadId) continue;
      await s3
        .send(new AbortMultipartUploadCommand({ Bucket: R2_BUCKET, Key: key, UploadId: u.UploadId }))
        .catch(() => null);
    }
  } catch {
    /* цэвэрлэж чадаагүй нь байршуулалтыг зогсоох шалтгаан биш */
  }

  const created = await s3.send(
    new CreateMultipartUploadCommand({ Bucket: R2_BUCKET, Key: key, ContentType: 'video/mp4' }),
  );
  const uploadId = created.UploadId!;
  const parts: { ETag: string; PartNumber: number }[] = [];

  try {
    let offset = 0;
    let partNumber = 1;
    while (offset < size) {
      const end = Math.min(offset + PART_SIZE, size);
      const chunk = await readChunk(filePath, offset, end - offset);

      let lastErr: unknown;
      let ok = false;
      for (let attempt = 1; attempt <= PART_RETRIES; attempt++) {
        try {
          const res = await s3.send(
            new UploadPartCommand({
              Bucket: R2_BUCKET,
              Key: key,
              UploadId: uploadId,
              PartNumber: partNumber,
              Body: chunk,
            }),
          );
          parts.push({ ETag: res.ETag!, PartNumber: partNumber });
          ok = true;
          break;
        } catch (e) {
          lastErr = e;
          const wait = attempt * 5_000;
          console.log(`      ⚠️ part ${partNumber} оролдлого ${attempt}/${PART_RETRIES} унав, ${wait / 1000}с`);
          await new Promise((r) => setTimeout(r, wait));
        }
      }
      if (!ok) throw lastErr;

      offset = end;
      partNumber++;
      onProgress(offset, size);
    }

    await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: R2_BUCKET,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      }),
    );
  } catch (e) {
    await s3
      .send(new AbortMultipartUploadCommand({ Bucket: R2_BUCKET, Key: key, UploadId: uploadId }))
      .catch(() => null);
    throw e;
  }
}

/** ⚠️ Бүтэн файлыг санах ойд УНШИХГҮЙ — 1 GB нь Node-ыг ачаална */
function readChunk(filePath: string, start: number, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    fs.createReadStream(filePath, { start, end: start + length - 1 })
      .on('data', (c) => chunks.push(c as Buffer))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);
  });
}

async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === attempts) break;
      const wait = i * 10_000;
      console.log(`    ⚠️ ${label} оролдлого ${i}/${attempts} унав — ${wait / 1000}с`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function existsInR2(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

interface Job {
  episodeId: string;
  number: number;
  file: string;
  size: number;
}

async function main() {
  if (!TITLE_SLUG) {
    console.error('❌ TITLE_SLUG заавал — ж: TITLE_SLUG=agent-kim-reactivated');
    process.exit(1);
  }

  const title = await prisma.title.findUnique({
    where: { slug: TITLE_SLUG },
    include: { seasons: { include: { episodes: { orderBy: { number: 'asc' } } } } },
  });
  if (!title) {
    console.error(`❌ "${TITLE_SLUG}" олдсонгүй`);
    process.exit(1);
  }
  if (!title.seasons.length) {
    console.error(`❌ "${title.title}"-д улирал байхгүй — админаас улирал/анги үүсгэнэ үү`);
    process.exit(1);
  }

  console.log(`\n📺 ${title.title}  (${title.type})`);
  console.log(`   улирал ${title.seasons.length} · анги ${title.seasons.reduce((s, x) => s + x.episodes.length, 0)}\n`);

  /* ─── Файлуудыг ангийн дугаараар зурагжуулна ─────────────────────── */
  const files = await fsp.readdir(VIDEO_DIR);
  const byNumber = new Map<number, { file: string; size: number }>();
  for (const f of files) {
    if (!/\.(mp4|mkv|avi|mov)$/i.test(f)) continue;
    const n = episodeNumberOf(f);
    if (n === null) continue;
    const st = await fsp.stat(path.join(VIDEO_DIR, f));
    /* ⚠️ Ижил дугаар давхардвал ТОМ файлыг сонгоно (бүрэн хувилбар) */
    const prev = byNumber.get(n);
    if (!prev || st.size > prev.size) byNumber.set(n, { file: f, size: st.size });
  }

  console.log(`📁 ${VIDEO_DIR}`);
  console.log(`   ангийн дугаартай файл: ${byNumber.size}\n`);

  /* ─── Ажлын жагсаалт ─────────────────────────────────────────────── */
  const jobs: Job[] = [];
  const skipped: string[] = [];
  const missing: number[] = [];

  for (const season of title.seasons) {
    for (const ep of season.episodes) {
      if (ONLY.length && !ONLY.includes(ep.number)) continue;

      const hit = byNumber.get(ep.number);
      if (!hit) {
        missing.push(ep.number);
        continue;
      }
      /* ⚠️ ИДЕМПОТЕНТ — аль хэдийн бэлэн/явж буй ангийг дахин илгээхгүй */
      if (ep.streamStatus === 'READY') {
        skipped.push(`${ep.number} (бэлэн)`);
        continue;
      }
      if (ep.streamStatus === 'PROCESSING') {
        skipped.push(`${ep.number} (хөрвүүлэлтэд)`);
        continue;
      }
      jobs.push({ episodeId: ep.id, number: ep.number, file: hit.file, size: hit.size });
    }
  }

  if (missing.length) console.log(`⚠️  Файл олдоогүй анги: ${missing.join(', ')}`);
  if (skipped.length) console.log(`⏭️  Алгасав: ${skipped.join(', ')}`);

  const totalBytes = jobs.reduce((s, j) => s + j.size, 0);
  console.log(`\n📋 Байршуулах: ${jobs.length} анги · ${gb(totalBytes)} GB`);
  jobs.forEach((j) => console.log(`   ${String(j.number).padStart(2)}. ${j.file}  (${gb(j.size)} GB)`));

  if (DRY_RUN) {
    console.log('\n🔍 DRY_RUN — юу ч илгээсэнгүй');
    await prisma.$disconnect();
    return;
  }
  if (!jobs.length) {
    console.log('\n✅ Байршуулах зүйл алга');
    await prisma.$disconnect();
    return;
  }

  /**
   * ⚠️⚠️ Redis холболт ТАСРАХАД script унахгүй байх тохиргоо.
   * Өмнөх байршуулалтад `MaxRetriesPerRequestError` нь 8 файл орсны
   * дараа script-ийг АЛСАН (үлдсэн 38 огт эхлээгүй).
   */
  const queue = new Bull(VIDEO_QUEUE_NAME, process.env.REDIS_URL!, {
    prefix: 'besttv',
    redis: {
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      retryStrategy: (times: number) => Math.min(times * 1000, 30_000),
    },
  });
  queue.on('error', (e) => console.log(`    ⚠️ Redis: ${e.message}`));

  const started = Date.now();
  let done = 0;
  let sentBytes = 0;
  const failed: string[] = [];

  /** Нэг ангийг боловсруулна */
  const runOne = async (job: Job) => {
    const label = `${job.number}-р анги`;
    try {
      /**
       * ⚠️⚠️ ТОГТМОЛ KEY (randomUUID БИШ) — script дахин ажиллахад
       * ижил зам үүсэж, R2-д аль хэдийн орсон файлыг ДАХИН
       * илгээхгүй (1 GB × 10 = дэмий урсгал).
       */
      const key = `videos/raw/ep-${job.episodeId}${path.extname(job.file)}`;
      const full = path.join(VIDEO_DIR, job.file);

      if (await existsInR2(key)) {
        console.log(`  ⏭️  ${label} — R2-д аль хэдийн байна, байршуулалт алгаслаа`);
      } else {
        console.log(`  ⬆️  ${label} · ${gb(job.size)} GB · ${job.file}`);
        let lastPct = -10;
        await uploadMultipart(full, key, (d, t) => {
          const pct = Math.floor((d / t) * 100);
          if (pct >= lastPct + 20) {
            lastPct = pct;
            console.log(`      ${label}: ${pct}%`);
          }
        });
      }

      /**
       * ⚠️⚠️ DB-г ЭХЛЭЭД бичнэ (queue-гээс ӨМНӨ).
       * Эс бөгөөс админ панел "видео ороогүй" гэж харуулж, ажил
       * явж байгааг мэдэхгүй. Мөн queue унасан ч recovery cron нь
       * `UPLOADED` статусаар олж аварна.
       */
      await withRetry(
        () =>
          prisma.episode.update({
            where: { id: job.episodeId },
            data: { videoRawKey: key, streamStatus: 'UPLOADED', streamError: null, streamProgress: 0 },
          }),
        `${label} DB`,
      );

      /* ⚠️ `target: 'episode'` — 'movie' гэвэл processor Title-аас
         хайж олохгүй, ажил чимээгүй унана */
      try {
        await withRetry(
          () =>
            queue.add(
              'convert',
              { target: 'episode', targetId: job.episodeId, rawKey: key },
              { attempts: 2, backoff: { type: 'fixed', delay: 30_000 }, removeOnComplete: 50 },
            ),
          `${label} queue`,
          3,
        );
      } catch {
        console.log(`    ⚠️ ${label} queue-д орсонгүй — recovery cron ~45 мин дотор аварна`);
      }

      sentBytes += job.size;
      done++;
      console.log(
        `  ✅ ${label} · HLS дараалалд · ${done}/${jobs.length} · ${mins(Date.now() - started)} мин · үлдсэн ${gb(totalBytes - sentBytes)} GB`,
      );
    } catch (e) {
      /* ⚠️ Нэг анги унасан нь бусдыг зогсоох ёсгүй */
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  ❌ ${label} — ${msg}`);
      failed.push(`${label}: ${msg.slice(0, 80)}`);
    }
  };

  /* ─── CONCURRENCY зэрэг ажиллуулах (энгийн worker pool) ──────────── */
  console.log(`\n🚀 ${CONCURRENCY} зэрэг байршуулж эхэллээ…\n`);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      await runOne(job);
    }
  });
  await Promise.all(workers);

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📊 ${done}/${jobs.length} анги · ${gb(sentBytes)} GB · ${mins(Date.now() - started)} мин`);
  if (failed.length) {
    console.log(`\n❌ Амжилтгүй ${failed.length}:`);
    failed.forEach((f) => console.log(`   ${f}`));
    console.log('   → script-ийг дахин ажиллуулахад эдгээрийг л оролдоно');
  }

  await queue.close();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
