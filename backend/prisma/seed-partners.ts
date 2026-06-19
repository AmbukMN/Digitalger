/**
 * Partners seed — 20 танигдсан Монгол компанийн логог 1234.mn-ээс татаж R2-д хуулаад
 * Partner үүсгэнэ. Дахин ажиллуулахад давхардуулахгүй (нэрээр шалгана).
 *
 * Ажиллуулах (VPS backend container дотор):
 *   docker exec docker-backend-1 npx ts-node prisma/seed-partners.ts
 *   (эсвэл compiled: node dist/prisma/seed-partners.js)
 */
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();

// R2 тохиргоо (.env-ээс — backend StorageService-тэй ижил нэр)
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || 'digitalger';
const R2_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET = process.env.R2_SECRET_ACCESS_KEY;
const R2_PUBLIC = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_KEY!, secretAccessKey: R2_SECRET! },
});

// Сонгосон 20 хамтрагч (нэр + 1234.mn лого зам)
const PARTNERS: { name: string; logoPath: string }[] = [
  { name: 'APU Company', logoPath: '/logos/apu.png' },
  { name: 'Gobi', logoPath: '/logos/gobi.png' },
  { name: 'Худалдаа Хөгжлийн Банк (TDB)', logoPath: '/logos/tdb.png' },
  { name: 'Төрийн банк', logoPath: '/logos/turiin-bank.png' },
  { name: 'Голомт банк', logoPath: '/logos/golomt.png' },
  { name: 'Skytel', logoPath: '/logos/skytel.png' },
  { name: 'Таван Богд Финанс ББСБ', logoPath: '/logos/tavanbogd-finance.png' },
  { name: 'ХААН Даатгал', logoPath: '/logos/khaan-daatgal.png' },
  { name: 'Мандал Даатгал', logoPath: '/logos/mandal-daatgal.png' },
  { name: 'Монос косметик', logoPath: '/logos/Monos-cosmetic.png' },
  { name: 'MCS Property', logoPath: '/logos/mcs-property.png' },
  { name: 'ICT Group', logoPath: '/logos/ict-grouip.png' },
  { name: 'ITZone', logoPath: '/logos/itzone.png' },
  { name: 'CallPro', logoPath: '/logos/callpro.png' },
  { name: 'Gerege Systems', logoPath: '/logos/new/gerege.png' },
  { name: 'Interactive', logoPath: '/logos/new/interactive.jpg' },
  { name: 'Монгол Улсын Их Сургууль (МУИС)', logoPath: '/logos/muis2.png' },
  { name: 'ШУТИС', logoPath: '/logos/must.png' },
  { name: 'БЭРС Финанс', logoPath: '/logos/bersfinance.png' },
  { name: 'Эрдэнэт Үйлдвэр', logoPath: '/logos/erdenet-uildver.png' },
];

async function downloadLogo(path: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(`https://1234.mn${path}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://1234.mn' },
    });
    if (!res.ok) {
      console.warn(`  ⚠️ ${path} татагдсангүй (${res.status})`);
      return null;
    }
    const ab = await res.arrayBuffer();
    const ext = path.split('.').pop()?.toLowerCase();
    const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    return { buffer: Buffer.from(ab), contentType };
  } catch (e) {
    console.warn(`  ⚠️ ${path} алдаа:`, (e as Error).message);
    return null;
  }
}

async function main() {
  console.log('Partners seed эхэлж байна...');
  if (!R2_ENDPOINT || !R2_BUCKET || !R2_PUBLIC) {
    console.error('❌ R2 тохиргоо дутуу (R2_ENDPOINT/R2_BUCKET/R2_PUBLIC_URL). .env шалга.');
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;
  for (let i = 0; i < PARTNERS.length; i++) {
    const p = PARTNERS[i];
    // Давхардал шалгах (нэрээр)
    const exists = await prisma.partner.findFirst({ where: { name: p.name } });
    if (exists) {
      console.log(`  ⏭️  ${p.name} — аль хэдийн бий`);
      skipped++;
      continue;
    }

    const dl = await downloadLogo(p.logoPath);
    let logoKey: string | null = null;
    if (dl) {
      const ext = p.logoPath.split('.').pop()?.toLowerCase() || 'png';
      const key = `partners/${p.name.replace(/[^\w]/g, '').slice(0, 20)}-${Date.now()}-${i}.${ext}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: dl.buffer,
          ContentType: dl.contentType,
          CacheControl: 'public,max-age=31536000,immutable',
        }),
      );
      logoKey = `${R2_PUBLIC}/${key}`;
    }

    await prisma.partner.create({
      data: {
        name: p.name,
        logo: logoKey,
        featured: true,
        active: true,
        sortOrder: i,
      },
    });
    console.log(`  ✅ ${p.name}${logoKey ? '' : ' (логогүй)'}`);
    created++;
  }

  console.log(`\nДуусгав: ${created} нэмэгдсэн, ${skipped} алгассан.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
