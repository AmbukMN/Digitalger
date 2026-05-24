/**
 * Хуучин зургуудыг WebP variant болгон боловсруулж R2-д хуулах script.
 *
 * Ажиллуулах (VPS дотор docker exec):
 *   docker exec docker-backend-1 sh -c \
 *     "npx ts-node --transpile-only --compiler-options '{\"module\":\"CommonJS\"}' scripts/migrate-images.ts"
 *
 * Эсвэл local-д:
 *   cd backend && npx ts-node --transpile-only --compiler-options '{"module":"CommonJS"}' scripts/migrate-images.ts
 */

import { PrismaClient } from '@prisma/client';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

const prisma = new PrismaClient();

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = (process.env.R2_BUCKET_NAME ?? process.env.R2_BUCKET)!;
const PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');

const VARIANTS: { size: string; maxWidth: number; quality: number }[] = [
  { size: 'thumbnail', maxWidth: 320,  quality: 82 },
  { size: 'medium',    maxWidth: 800,  quality: 85 },
  { size: 'large',     maxWidth: 1400, quality: 87 },
  { size: 'original',  maxWidth: 9999, quality: 90 },
];

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function downloadFromR2(key: string): Promise<Buffer | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    if (!res.Body) return null;
    return streamToBuffer(res.Body as Readable);
  } catch {
    return null;
  }
}

async function uploadToR2(key: string, buf: Buffer): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buf,
    ContentType: 'image/webp',
    CacheControl: 'public,max-age=31536000,immutable',
  }));
}

function isSvgKey(key: string): boolean {
  return key.toLowerCase().endsWith('.svg');
}

function isVideoKey(key: string): boolean {
  return /\.(mp4|webm|mov|avi)$/i.test(key);
}

async function processImage(productImage: { id: string; fileKey: string }) {
  const { id, fileKey } = productImage;

  if (!fileKey || fileKey === '' || isSvgKey(fileKey) || isVideoKey(fileKey)) {
    console.log(`  SKIP ${id}: fileKey="${fileKey}" (svg/video/empty)`);
    return;
  }

  // Аль хэдийн variant байвал skip
  const existing = await prisma.imageVariant.count({ where: { productImageId: id } });
  if (existing > 0) {
    console.log(`  SKIP ${id}: variants байна (${existing})`);
    return;
  }

  console.log(`  PROCESS ${id}: ${fileKey}`);

  const buf = await downloadFromR2(fileKey);
  if (!buf) {
    console.log(`  ERROR: R2-с татаж чадсангүй: ${fileKey}`);
    return;
  }

  // animated GIF шалгах
  const isGif = fileKey.toLowerCase().endsWith('.gif');
  const animated = isGif && buf.includes(Buffer.from('NETSCAPE2.0'));

  const created: { size: string; fileKey: string; width: number; height: number; bytes: number }[] = [];

  for (const v of VARIANTS) {
    try {
      let pipeline = sharp(buf, { animated });
      const meta = await sharp(buf, { animated }).metadata();
      const origW = meta.width ?? 9999;

      if (origW > v.maxWidth && v.maxWidth < 9999) {
        pipeline = pipeline.resize({ width: v.maxWidth, withoutEnlargement: true });
      }

      const webpBuf = await pipeline
        .webp({ quality: v.quality, effort: 4, smartSubsample: true })
        .toBuffer();

      const outMeta = await sharp(webpBuf, { animated }).metadata();
      const newKey = `uploads/${randomUUID()}_${v.size}.webp`;

      await uploadToR2(newKey, webpBuf);

      created.push({
        size: v.size,
        fileKey: newKey,
        width: outMeta.width ?? 0,
        height: outMeta.height ?? 0,
        bytes: webpBuf.length,
      });

      console.log(`    ✓ ${v.size}: ${Math.round(webpBuf.length / 1024)}KB → ${newKey}`);
    } catch (err) {
      console.log(`    ✗ ${v.size}: ${err}`);
    }
  }

  if (created.length > 0) {
    await prisma.imageVariant.createMany({
      data: created.map((c) => ({
        productImageId: id,
        size: c.size,
        fileKey: c.fileKey,
        width: c.width,
        height: c.height,
        bytes: c.bytes,
        mimeType: 'image/webp',
      })),
    });
    console.log(`    DB-д ${created.length} variant хадгалагдлаа`);
  }
}

async function main() {
  console.log('=== Image variant migration ===\n');

  const total = await prisma.productImage.count({
    where: { fileKey: { not: '' }, videoUrl: null },
  });
  console.log(`Нийт боловсруулах зураг: ${total}\n`);

  // Batch-ээр боловсруулна (memory хэмнэх)
  const BATCH = 10;
  let skip = 0;

  while (true) {
    const images = await prisma.productImage.findMany({
      where: { fileKey: { not: '' }, videoUrl: null },
      select: { id: true, fileKey: true },
      skip,
      take: BATCH,
      orderBy: { id: 'asc' },
    });

    if (images.length === 0) break;

    console.log(`\nBatch ${Math.floor(skip / BATCH) + 1} (${skip + 1}–${skip + images.length} / ${total}):`);
    for (const img of images) {
      await processImage(img);
    }

    skip += BATCH;
  }

  console.log('\n=== Дууслаа ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
