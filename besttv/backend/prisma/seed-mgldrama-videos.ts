/**
 * BestTV — mgldrama драмуудын ВИДЕОГ R2 руу байршуулж HLS дараалалд өгнө.
 *
 * ⚠️⚠️ 208 GB — 49 файл, дунджаар 4.2 GB. Байршуулалт ХЭДЭН ЦАГ үргэлжилнэ.
 *   Тиймээс энэ script нь:
 *     • ИДЕМПОТЕНТ — тасалдвал дахин ажиллуулахад үлдсэнээс нь үргэлжилнэ
 *     • MULTIPART — 100 MB хэсгээр, нэг хэсэг унавал ТҮҮНИЙГ л дахин илгээнэ
 *     • НЭГ НЭГЭЭР — зэрэг байршуулбал сүлжээ дүүрч бүгд удаашрана
 *
 * ⚠️ Худалдан авагчийн зардал: R2 нь ГАРАХ урсгалд төлбөргүй ч PUT
 *   үйлдэлд төлбөртэй. Multipart нь хэсэг тус бүрд нэг PUT — 100 MB
 *   сонгосон нь 4.2 GB файлыг 42 PUT болгоно (5 MB бол 840 PUT).
 *
 * Ажиллуулах:
 *   cd backend
 *   DOTENV_CONFIG_PATH=.env.production npx ts-node --transpile-only prisma/seed-mgldrama-videos.ts
 *
 * Сонголтууд:
 *   LIMIT=5     — эхний 5-ыг л (туршилтад)
 *   DRY_RUN=1   — файл шалгаад төлөвлөгөө харуулна, юу ч илгээхгүй
 *   VIDEO_DIR=  — өөр хавтас
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
/**
 * ⚠️ `bull` (v4), `bullmq` БИШ — төсөл `@nestjs/bull`-ыг ашигладаг.
 * Хоёулаа Redis дээр ажилладаг ч түлхүүрийн бүтэц ӨӨР: буруугаар
 * нэмсэн ажлыг worker ХЭЗЭЭ Ч авахгүй (чимээгүй алдаа).
 */
import Bull from 'bull';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === '1';
const LIMIT = Number(process.env.LIMIT) || 0;

const VIDEO_DIR = process.env.VIDEO_DIR || 'D:\\movies\\busad kino';
/** ⚠️ `video-queue.types.ts`-ийн `VIDEO_QUEUE`-тэй ИЖИЛ байх ЁСТОЙ */
const VIDEO_QUEUE_NAME = 'besttv-video-hls';
const DATA_FILE = path.join(__dirname, 'mgldrama-seed-data.json');
const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'besttv';

/**
 * ⚠️ 32 MB — PUT тоо ба дахин илгээх эрсдэлийн тэнцвэр.
 * ⚠️ 100 MB байсныг БАГАСГАВ: 10 файл ЗЭРЭГ явахад тус бүр нэг хэсгийг
 * санах ойд барьдаг тул 10 × 100 MB = 1 GB RAM. 32 MB бол ~320 MB.
 * 7 GB файл = 220 хэсэг, R2-ийн 10,000 хязгаарт хол багтана.
 */
const PART_SIZE = 32 * 1024 * 1024;
/** Нэг хэсэг хэдэн удаа дахин оролдох */
const PART_RETRIES = 4;

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  /** ⚠️ Том файлд удаан — 10 минут (анхдагч 30 сек нь хангалтгүй) */
  requestHandler: { requestTimeout: 600_000 },
});

interface SeedDrama {
  title: string;
  videoFile: string;
  posterFile: string | null;
  isAdult: boolean;
}

const norm = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[«»"'`.,!?—–-]/g, '');

const gb = (b: number) => (b / 1024 ** 3).toFixed(2);
const mins = (ms: number) => Math.round(ms / 60_000);

/**
 * Файлыг R2 руу multipart-аар байршуулна.
 *
 * ⚠️ Хэсэг унавал ТҮҮНИЙГ л дахин илгээнэ (бүтэн файлыг биш) — 4 GB
 * файлын сүүлийн хэсэг дээр унавал эхнээс нь эхлэх нь хүлээн зөвшөөрөхгүй.
 * ⚠️ Бүрэн унавал `AbortMultipartUpload` — эс бөгөөс дуусаагүй хэсгүүд
 * R2-д хуримтлагдаж ТӨЛБӨР төлүүлнэ.
 */
async function uploadMultipart(
  filePath: string,
  key: string,
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  const { size } = await fsp.stat(filePath);
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
          /* ⚠️ Өсөн нэмэгдэх хүлээлт — сүлжээ түр тасарвал шууд дахин
             оролдох нь дахин унана */
          const wait = attempt * 5_000;
          console.log(`      ⚠️ part ${partNumber} оролдлого ${attempt}/${PART_RETRIES} унав, ${wait / 1000}с хүлээнэ`);
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
    /* ⚠️ Цуцлахгүй бол дуусаагүй хэсгүүд R2-д үлдэж төлбөр төлүүлнэ */
    await s3
      .send(new AbortMultipartUploadCommand({ Bucket: R2_BUCKET, Key: key, UploadId: uploadId }))
      .catch(() => null);
    throw e;
  }
}

/** ⚠️ Бүтэн файлыг санах ойд УНШИХГҮЙ — 4 GB нь Node-ыг унагаана */
function readChunk(filePath: string, start: number, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    fs.createReadStream(filePath, { start, end: start + length - 1 })
      .on('data', (c) => chunks.push(c as Buffer))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);
  });
}

/**
 * Сүлжээний түр саатлыг тэсвэрлэх дахин оролдлого.
 *
 * ⚠️⚠️ БОДИТ ШАЛТГААН: 4 GB видео 10+ минут байршдаг. Тэр хугацаанд
 * SSH tunnel/DB холболт САЛЖ, файл R2-д ОРСОН атлаа DB бичигдэхгүй
 * үлдсэн (production дээр тохиолдсон). Дараагийн ажиллалт тэр 4 GB-ыг
 * ДАХИН илгээнэ — 10 минут + урсгал дэмий.
 */
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === attempts) break;
      const wait = i * 10_000;
      console.log(`    ⚠️ ${label} оролдлого ${i}/${attempts} унав — ${wait / 1000}с хүлээнэ`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

/** R2-д объект аль хэдийн байгаа эсэх (дахин илгээхээс сэргийлнэ) */
async function existsInR2(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log(DRY_RUN ? '🧪 DRY_RUN — файл шалгана, илгээхгүй\n' : '🚀 Видео байршуулалт\n');

  const dramas: SeedDrama[] = JSON.parse(await fsp.readFile(DATA_FILE, 'utf-8'));
  const titles = await prisma.title.findMany({
    select: { id: true, title: true, slug: true, videoKey: true, videoRawKey: true, streamStatus: true },
  });
  const byTitle = new Map(titles.map((t) => [norm(t.title), t]));

  /* ─── Төлөвлөгөө: юу үлдсэн, хэдэн GB вэ ─── */
  const todo: { drama: SeedDrama; title: (typeof titles)[0]; file: string; size: number }[] = [];
  const skipped: string[] = [];

  for (const d of dramas) {
    const t = byTitle.get(norm(d.title));
    if (!t) {
      skipped.push(`${d.title} — DB-д алга (эхлээд seed-mgldrama.ts ажиллуул)`);
      continue;
    }
    /**
     * ⚠️ ИДЕМПОТЕНТ: аль хэдийн видеотой эсвэл хөрвүүлж байгааг АЛГАСНА.
     * Дахин илгээвэл (а) 4 GB дэмий урсгал, (б) хуучин HLS-ийг дарж
     * хэрэглэгчийн үзэлт тасарна.
     */
    if (t.videoKey || t.streamStatus === 'PROCESSING' || t.streamStatus === 'READY') {
      skipped.push(`${d.title} — аль хэдийн ${t.streamStatus}`);
      continue;
    }
    const file = path.join(VIDEO_DIR, d.videoFile);
    try {
      const st = await fsp.stat(file);
      todo.push({ drama: d, title: t, file, size: st.size });
    } catch {
      skipped.push(`${d.title} — видео файл алга (${d.videoFile})`);
    }
  }

  const list = LIMIT ? todo.slice(0, LIMIT) : todo;
  const totalBytes = list.reduce((s, x) => s + x.size, 0);

  console.log('╔═══ ТӨЛӨВЛӨГӨӨ ═══');
  console.log(`║ Байршуулах  : ${list.length} видео`);
  console.log(`║ Нийт хэмжээ : ${gb(totalBytes)} GB`);
  console.log(`║ Алгасах     : ${skipped.length}`);
  console.log('╚══════════════════\n');
  if (skipped.length) {
    for (const s of skipped.slice(0, 10)) console.log(`  ⏭️  ${s}`);
    if (skipped.length > 10) console.log(`  … бас ${skipped.length - 10}`);
    console.log('');
  }
  if (DRY_RUN || !list.length) {
    if (!list.length) console.log('✅ Байршуулах видео алга — бүгд бэлэн.');
    await prisma.$disconnect();
    return;
  }

  /**
   * ─── Queue холболт ───
   * ⚠️⚠️ `prefix` болон нэр нь `app.module.ts` / `worker.module.ts`-тэй
   * ЯГ ТААРАХ ёстой (`besttv` + `besttv-video-hls`). Зөрвөл ажил өөр
   * Redis түлхүүрт орж, worker ХЭЗЭЭ Ч авахгүй — чимээгүй алдаа болно.
   */
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const queue = new Bull(VIDEO_QUEUE_NAME, redisUrl, { prefix: 'besttv' });

  const startedAll = Date.now();
  let doneCount = 0;
  let sentBytes = 0;

  /**
   * ⚠️⚠️ ЗЭРЭГЦЭЭ БАЙРШУУЛАЛТ (`UPLOAD_CONCURRENCY`, анхдагч 10).
   *
   * Нэг файл дараалан явуулахад сүлжээний БҮРЭН хүчийг ашиглаж
   * чадахгүй: хэсэг бүрийн хооронд latency (хүлээлт) байдаг тул
   * 7.8 MB/s хүрдэг ч холболт сул зогсох хугацаа их. Олон файл
   * зэрэг явуулбал тэр завсрууд дүүрч, нийт хурд өснө.
   *
   * ⚠️ Хязгаартай — 47-г БҮГДИЙГ зэрэг явуулбал: (1) RAM 47×100MB
   * буфер, (2) R2 rate limit, (3) аль нь ч дуусахгүй удаан
   * (бүгд 1/47 хурдтай).
   *
   * ⚠️ Сервер тал АСУУДАЛГҮЙ: HLS хөрвүүлэлт queue-тэй тул хэдэн ч
   * ажил хүлээж болно, worker дарааллаар (4 зэрэг) боловсруулна.
   */
  const CONCURRENCY = Math.max(1, Number(process.env.UPLOAD_CONCURRENCY) || 10);
  console.log(`⚡ ${CONCURRENCY} файл зэрэг байршуулна\n`);

  const queueItems = [...list];

  const worker = async () => {
    for (;;) {
      const item = queueItems.shift();
      if (!item) return;
      await uploadOne(item);
    }
  };

  async function uploadOne(item: (typeof list)[0]) {
    const n = ++doneCount;
    const label = `[${n}/${list.length}] ${item.drama.title}`;
    console.log(`${label}  (${gb(item.size)} GB)`);

    /**
     * ⚠️⚠️ ТОГТМОЛ KEY (санамсаргүй UUID БИШ) — `titleId` дээр суурилна.
     *
     * ЯАГААД: өмнө нь `randomUUID()` байсан тул ажиллалт бүрд ШИНЭ key
     * үүсэж, R2-д аль хэдийн байгаа файлыг ОЛОХ АРГАГҮЙ байв. DB бичих
     * үед холболт тасарвал (бодитоор тохиолдсон) 4 GB дахин илгээгдэнэ.
     * Одоо key нь урьдчилан таамаглах боломжтой тул `existsInR2` ажиллана.
     */
    const key = `videos/raw/${item.title.id}${path.extname(item.file)}`;
    const started = Date.now();

    try {
      /* ⚠️ Өмнөх ажиллалтад дуусаад DB бичихээс өмнө тасарсан байж болно */
      if (await existsInR2(key)) {
        console.log('    ↩️  R2-д аль хэдийн байна — дахин илгээхгүй');
      } else {
        let lastPct = -1;
        await uploadMultipart(item.file, key, (done, total) => {
          const pct = Math.floor((done / total) * 100);
          /**
           * ⚠️ 25% тутамд л хэвлэнэ (10% байсан) — 10 файл ЗЭРЭГ
           * ажиллахад лог 10 урсгалаас холилдож уншигдахгүй болно.
           * ⚠️ Киноны нэрийг мөр бүрд бичнэ — эс бөгөөс аль файлын
           * явц болохыг ялгах аргагүй.
           */
          if (pct >= lastPct + 25) {
            lastPct = pct;
            const spent = (Date.now() - started) / 1000;
            const mbps = done / 1024 / 1024 / spent;
            process.stdout.write(
              `    ${pct.toString().padStart(3)}% ${mbps.toFixed(1)} MB/s · ${item.drama.title}\n`,
            );
          }
        });
      }

      /**
       * ⚠️ DB + queue-г байршуулалт ДУУССАНЫ ДАРАА — өмнө нь тавьвал
       * worker байхгүй файл руу хандаж FAILED болно.
       *
       * ⚠️⚠️ ДАХИН ОРОЛДЛОГОТОЙ: 4 GB видео 10+ минут байршдаг бөгөөд
       * тэр хугацаанд SSH tunnel эсвэл DB холболт САЛЖ болно (бодитоор
       * тохиолдсон — "Can't reach database server"). Файл R2-д ОРСОН
       * атлаа DB бичигдэхгүй бол дараагийн ажиллалт ДАХИН 4 GB илгээнэ.
       */
      await withRetry(
        () =>
          prisma.title.update({
            where: { id: item.title.id },
            data: { videoRawKey: key, streamStatus: 'PROCESSING' },
          }),
        'DB бичилт',
      );
      await withRetry(
        () =>
          queue.add(
            'convert',
            { target: 'movie', targetId: item.title.id, rawKey: key },
            { attempts: 2, backoff: { type: 'fixed', delay: 30_000 }, removeOnComplete: 50 },
          ),
        'Queue нэмэлт',
      );

      sentBytes += item.size;
      const spentMin = mins(Date.now() - started);
      const leftGb = gb(totalBytes - sentBytes);
      console.log(`    ✅ ${spentMin} мин · HLS дараалалд орлоо · үлдсэн ${leftGb} GB\n`);
    } catch (e) {
      /**
       * ⚠️ Нэг файл унасан нь БҮХ УРСГАЛЫГ зогсоох ёсгүй — 40 файлын
       * 12 дахь нь унавал үлдсэн 28-ыг үргэлжлүүлнэ. Дахин ажиллуулахад
       * зөвхөн унасан нь л дахин орно (идемпотент).
       */
      console.error(`    ❌ АЛДАА: ${String(e)}\n`);
    }
  }

  /* ⚠️ `Promise.all` — worker бүр дараалалаас нэг нэгээр авч ажиллана.
     Нэг worker унасан ч бусад нь үргэлжилнэ (`uploadOne` дотор catch). */
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, list.length) }, () => worker()),
  );

  console.log(`\n📊 ${doneCount} видео боловсруулав · ${gb(sentBytes)} GB · ${mins(Date.now() - startedAll)} мин`);
  console.log('⏳ HLS хөрвүүлэлт дэвсгэрт үргэлжилнэ (админ панелиас явцыг хараарай).');

  await queue.close();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
