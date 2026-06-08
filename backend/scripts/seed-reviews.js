// Бодит review seed — AI курст 15 review + бусад product-ийн ratingCount-той тааруулж
// бодит, алдаагүй comment нэмэх. product.rating/ratingCount RECALC.
// Давхардуулахгүй: @@unique([userId,productId]) — нэг user нэг product (catch алгасах).
//
// Ажиллуулах:
//   docker cp backend/scripts/seed-reviews.js docker-backend-1:/app/seed-reviews.js
//   docker exec -w /app docker-backend-1 node seed-reviews.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── Бодит, алдаагүй Монгол comment сан (rating-аар) ──────────────────────────
const NAMES = [
  'Б. Болормаа', 'Т. Ганбаатар', 'С. Оюунчимэг', 'Д. Энхтуяа', 'Г. Мөнхбат',
  'Н. Сарангэрэл', 'Б. Тэмүүлэн', 'Ж. Алтанцэцэг', 'Х. Батбаяр', 'Л. நарангэрэл',
  'О. Золбоо', 'Э. Цэрэнханд', 'П. Мөнхзул', 'Р. Анхбаяр', 'Ц. Уранчимэг',
  'М. Дөлгөөн', 'А. Бат-Эрдэнэ', 'Я. Сувд', 'В. Гэрэлмаа', 'Ш. Нямдорж',
];

const COMMENTS_5 = [
  'Маш сайн бүтээгдэхүүн. Чанартай, дэлгэрэнгүй. Худалдан авсандаа баяртай байна.',
  'Үнэхээр үнэ цэнэтэй. Хүлээж байснаас илүү гарсан. Заавал санал болгож байна.',
  'Гайхалтай чанартай. Бүх зүйл бэлэн, шууд ашиглахад тохиромжтой байсан.',
  'Хямд үнэтэй атлаа маш чанартай. Дараагийн бүтээгдэхүүнийг нь хүлээж байна.',
  'Татаж аваад шууд ашигласан. Бүх зүйл цэгцтэй, ойлгомжтой. Баярлалаа!',
  'Профессионал хийгдсэн байна. Цаг хэмнэсэн, ажлаа хурдан гүйцэтгэлээ.',
  'Эрэлттэй зүйл байсан. Чанар нь үнэдээ тохирсон. Сэтгэл хангалуун байна.',
  'Маш тустай. Бизнестээ шууд ашигласан, үр дүн нь сайн байна.',
];
const COMMENTS_4 = [
  'Сайн бүтээгдэхүүн. Ерөнхийдөө сэтгэл хангалуун. Зарим хэсгийг сайжруулж болох байсан.',
  'Чанартай боловч жаахан илүү жишээ оруулсан бол гэж бодсон. Гэхдээ зөвлөж байна.',
  'Хэрэгцээтэй зүйл байсан. Хүлээж байснаас бараг ижил гарсан. Зүгээр.',
  'Үнэдээ тохирсон. Ашиглахад тохиромжтой, гэхдээ бага зэрэг нэмэлт тайлбар хэрэгтэй.',
];
const COMMENTS_3 = [
  'Дунд зэрэг. Зарим хэсэг нь сайн, зарим нь ердийн. Ерөнхийдөө болохуйц.',
  'Хэрэглэж болохуйц. Гэхдээ илүү дэлгэрэнгүй байсан бол сайн байх байсан.',
];

function pickComment(rating) {
  if (rating === 5) return COMMENTS_5;
  if (rating === 4) return COMMENTS_4;
  return COMMENTS_3;
}

async function recalc(productId) {
  const agg = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      rating: agg._avg.rating ? Math.round(agg._avg.rating * 100) / 100 : 0,
      ratingCount: agg._count,
    },
  });
}

async function seedForProduct(product, users, targetCount) {
  let added = 0;
  // rating тархалт: ихэнх 5, зарим 4, цөөн 3 (бодит хэлбэр)
  const dist = [];
  for (let i = 0; i < targetCount; i++) {
    const r = i % 7 === 0 ? 4 : i % 11 === 0 ? 3 : 5; // ~70% 5★, ~15% 4★, ~цөөн 3★
    dist.push(r);
  }
  const shuffledUsers = [...users].sort(() => 0.5 - Math.random ? 0 : 0); // тогтвортой
  for (let i = 0; i < targetCount && i < users.length; i++) {
    const rating = dist[i];
    const pool = pickComment(rating);
    const comment = pool[i % pool.length];
    const authorName = NAMES[i % NAMES.length];
    try {
      await prisma.review.create({
        data: {
          productId: product.id,
          userId: users[i].id,
          rating,
          comment,
          authorName,
        },
      });
      added++;
    } catch {
      // @@unique([userId,productId]) — давхардвал алгасах
    }
  }
  if (added > 0) await recalc(product.id);
  return added;
}

async function main() {
  // Review үлдээх бодит User-ууд (USER role)
  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    select: { id: true },
    take: 50,
  });
  if (users.length < 3) {
    console.error(`❌ USER хэрэглэгч хүрэлцэхгүй (${users.length}). Review нэмэхэд бодит user хэрэгтэй.`);
    process.exit(1);
  }
  console.log(`Бодит USER: ${users.length}`);

  // ── 1. AI курс — 15 review ────────────────────────────────────────────────
  const course = await prisma.product.findUnique({ where: { slug: 'ai-ecommerce-curriculum' } });
  if (course) {
    const existing = await prisma.review.count({ where: { productId: course.id } });
    const target = Math.max(0, 15 - existing);
    const added = await seedForProduct(course, users, 15);
    console.log(`✓ AI курс: ${added} review (нийт target 15, өмнө ${existing})`);
    await recalc(course.id);
  }

  // ── 2. Бусад product — ratingCount-той тааруулж бодит review ───────────────
  // ratingCount > 0 атал бодит review цөөн product-уудад review нэмж тааруулна.
  const products = await prisma.product.findMany({
    where: { slug: { not: 'ai-ecommerce-curriculum' } },
    select: { id: true, slug: true, ratingCount: true },
  });
  let totalAdded = 0;
  let touched = 0;
  for (const p of products) {
    const realReviews = await prisma.review.count({ where: { productId: p.id } });
    // Хэрэв "харагдах" ratingCount байгаа ч бодит review цөөн бол бодит болгох.
    // Target: ratingCount байвал min(ratingCount, 20) хүртэл (хэт олон бол 20-оор хязгаар).
    // ratingCount=0 бол 5-12 random бодит review нэмж амьд харагдуулна.
    const target = p.ratingCount > 0 ? Math.min(p.ratingCount, 20) : 5 + (parseInt(p.id.slice(-1), 36) % 8);
    if (realReviews >= target) continue;
    const added = await seedForProduct(p, users, target);
    if (added > 0) {
      totalAdded += added;
      touched++;
    }
  }
  console.log(`✓ Бусад product: ${touched} бүтээгдэхүүнд нийт ${totalAdded} review нэмэв`);

  console.log('\n✅ DONE: бодит review seed дууслаа (rating/ratingCount RECALC хийгдсэн)');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('SEED ERROR:', e.message);
  process.exit(1);
});
