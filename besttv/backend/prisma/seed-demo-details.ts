/**
 * Демо контентын cast/director/ageRating/gallery мэдээлэл нэмэх update script.
 * seed-demo.ts ажилласны ДАРАА ажиллуулна (title-үүд аль хэдийн байх ёстой).
 *
 * Ажиллуулах: npx ts-node --compiler-options {"module":"CommonJS"} prisma/seed-demo-details.ts
 */
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');

async function saveImage(url: string, folder: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Зураг татахад алдаа: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const key = `${folder}/${randomUUID()}.jpg`;
  const dest = path.join(STORAGE_ROOT, key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buf);
  return key;
}

const ACTOR_NAMES = [
  'Батбаяр Дорж', 'Оюунчимэг Сүх', 'Ганбат Мөнх', 'Сарантуяа Бат',
  'Түвшинбаяр Ганбаатар', 'Ундрах Цэрэн', 'Энхбаяр Дугар', 'Наранцэцэг Лхагва',
  'Болдбаатар Жамьян', 'Алтансувд Нямаа',
];

const DIRECTORS = ['Б. Ганзориг', 'Д. Мөнхбат', 'Н. Оюунгэрэл', 'С. Батжаргал', 'Т. Энхтуяа'];
const AGE_RATINGS = ['G', 'PG-13', '16+', '18+'];

async function main() {
  const titles = await prisma.title.findMany();
  console.log(`${titles.length} контентод дэлгэрэнгүй мэдээлэл нэмж байна...`);

  let i = 0;
  for (const title of titles) {
    i++;
    // Санамсаргүй 3-5 жүжигчин, зураггүй (placeholder аватар frontend дээр)
    const castCount = 3 + (i % 3);
    const cast = Array.from({ length: castCount }, (_, idx) => ({
      name: ACTOR_NAMES[(i + idx) % ACTOR_NAMES.length],
      character: `Дүр ${idx + 1}`,
    }));

    const galleryCount = i % 4; // зарим нь gallery-гүй (0-3 зураг)
    const galleryKeys: string[] = [];
    for (let g = 0; g < galleryCount; g++) {
      const key = await saveImage(
        `https://picsum.photos/seed/${title.slug}-gallery-${g}/1280/720`,
        'images/gallery',
      );
      galleryKeys.push(key);
    }

    await prisma.title.update({
      where: { id: title.id },
      data: {
        cast,
        director: DIRECTORS[i % DIRECTORS.length],
        ageRating: AGE_RATINGS[i % AGE_RATINGS.length],
        galleryKeys,
      },
    });
    console.log(`  ✅ ${title.title} — ${castCount} жүжигчин, ${galleryCount} gallery зураг`);
  }

  console.log(`\n🎬 ${titles.length} контент шинэчлэгдлээ.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
