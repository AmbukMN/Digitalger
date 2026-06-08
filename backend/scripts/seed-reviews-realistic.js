// БОДИТ, олон янзын review seed — жинхэнэ хэрэглэгч бичсэн мэт.
// Монгол / латин галиг / холимог. Product бүрд ЯНЗ БҮРИЙН тоо (22, 56, 102, 145...).
// Хуучин (нэг хэвийн 20) review-уудыг ЦЭВЭРЛЭЭД дахин бодит болгоно.
//
// ⚠️ ratingCount нь review тооноос ИЛҮҮ байж болно (зарим хүн үнэлсэн ч сэтгэгдэл бичээгүй).
// Тиймээс review = бодит бичигдсэн сэтгэгдэл, ratingCount = нийт үнэлсэн тоо (review + үнэлгээ).
//
// Ажиллуулах:
//   docker cp backend/scripts/seed-reviews-realistic.js docker-backend-1:/app/sr.js
//   docker exec -w /app docker-backend-1 node sr.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── Бодит хэрэглэгчийн нэр (монгол + латин галиг + холимог) ──────────────────
const NAMES = [
  'Болормаа', 'Ganbaatar', 'Оюунаа', 'Temka', 'Энхжаргал', 'Bilguun', 'Сараа',
  'Munkhbat_99', 'Дөлгөөн', 'Anar', 'Цэрэнханд', 'Bayaraa', 'Уранчимэг', 'Tuvshin',
  'Нямдорж', 'Khulan', 'Батбаяр', 'Saruul', 'Гэрэлмаа', 'Otgoo', 'Сувд', 'Bat-Erdene',
  'Золбоо', 'Nomin', 'Мөнхзул', 'Tseegii', 'Алтанцэцэг', 'Enkhjin', 'Дэлгэрмаа',
  'Bilguunbtr', 'Цэцэгмаа', 'Ariunaa', 'Ганболд', 'Soyolmaa', 'Чимэг', 'Tamir',
  'Нандин', 'Erdene', 'Хонгорзул', 'Bayasgalan',
];

// ── Бодит сэтгэгдэл сан — rating-аар, ОЛОН ЯНЗ (монгол/латин/холимог/богино/урт) ──
const C5 = [
  'Үнэхээр гоё бүтээгдэхүүн юм. Чанартай, дэлгэрэнгүй хийгдсэн байна. Баярлалаа!',
  'Saihan baina, tatsanaa shууd ашигласан. Хүлээж байснаас илүү гарсан.',
  'Hямдхан атлаа чанартай. Дараа дахиад авна. Зөвлөж байна.',
  'goy shdee, yagaad odoo bolтол ийм зүйл олоогүй юм бол. Цаг хэмнэлээ.',
  'Бизнестээ шууд ашигласан, маш тустай байна. Ажилдаа хэрэглэж байгаа.',
  'Mash sain. Ene үнээр ийм чанартай зүйл авна гэж бодоогүй. Талархаж байна 🙏',
  'Бүх зүйл бэлэн, цэгцтэй. Шинэхэн дизайнтай. Хурдан татаж авлаа.',
  'Tuyl goy bolson baina. Найзууддаа санал болгосон. Үнэхээр хэрэгтэй байсан.',
  'Зүгээр л супер. Профессионал хийгдсэн, юу ч засах шаардлагагүй. Гялалзлаа.',
  'tung saihan ajillalaa, content ni delgerengui. damжуулсан хэрэгсэл нь зөв байсан.',
  'Маркетингийн ажилдаа ашигласан, үр дүн нь гайхалтай. Сэтгэл хангалуун.',
  'gaihaltai! tatsanaa neeeed shууд ашиглаж эхэлсэн. Ямар ч асуудалгүй.',
  'Үнэ цэнэтэй хөрөнгө оруулалт болсон. Дахин дахин ашиглаж байна.',
  'Setgel hangaluun baina. Бүх зүйл байрандаа. Худалдан авсандаа харамсаагүй.',
  'Шилдэг. Манай багийнхан бүгд ашиглаж байна. Их цаг хэмнэсэн.',
];
const C4 = [
  'Сайн бүтээгдэхүүн. Ерөнхийдөө таалагдсан. Зарим хэсгийг сайжруулж болох байсан.',
  'goy, gehdee jaahan нэмэлт жишээ оруулсан бол гэж бодсон. Гэхдээ зүгээр.',
  'Чанартай. Хүлээж байснаас бараг ижил. Үнэдээ тохирсон.',
  'Bolohuitsig. Ашиглахад тохиромжтой боловч заавар нь арай дутуу санагдсан.',
  'Сайн л байна. 5 од өгөхөөс жаахан болгоомжилсон, гэхдээ дахин авна.',
  'Hereglehed amar. Зарим зураг нь арай тодорхой бус. Ерөнхийдөө OK.',
];
const C3 = [
  'Дунд зэрэг. Зарим нь сайн, зарим нь ердийн. Ерөнхийдөө болохуйц.',
  'Bolj baina. Илүү дэлгэрэнгүй байсан бол сайн байх байсан.',
  'Гайгүй. Хүлээснээс арай бага. Гэхдээ үнэдээ тохирсон байх.',
];

function pickPool(r) {
  return r === 5 ? C5 : r === 4 ? C4 : C3;
}

// Product бүрд ЯНЗ БҮРИЙН review тоо (нэг хэвийн биш) — slug hash-аас тогтвортой
function reviewTargetFor(idx) {
  // 22, 56, 102, 145, 38, 74, 19, 91, 63, 127... олон янз
  const variants = [22, 56, 102, 145, 38, 74, 19, 91, 63, 127, 45, 88, 31, 156, 27, 69, 113, 42, 80, 51];
  return variants[idx % variants.length];
}

async function recalc(productId, ratingCount) {
  // rating нь review-ийн дундаж; ratingCount нь "нийт үнэлсэн" (review-ээс их байж болно)
  const agg = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      rating: agg._avg.rating ? Math.round(agg._avg.rating * 100) / 100 : 0,
      ratingCount: ratingCount ?? agg._count,
    },
  });
}

async function seedProduct(product, users, target) {
  // Хуучин review-уудыг цэвэрлэх (нэг хэвийн seed арилгах)
  await prisma.review.deleteMany({ where: { productId: product.id } });

  // target тооны review — ГЭХДЭЭ user тоогоор хязгаарлагдана (нэг user нэг product)
  const realTarget = Math.min(target, users.length);
  // rating тархалт: ~72% 5★, ~20% 4★, ~8% 3★ (бодит хэлбэр)
  const shuffled = [...users].sort((a, b) => (a.id > b.id ? 1 : -1)); // тогтвортой
  let added = 0;
  // createdAt-ийг сүүлийн 90 хоногт тарааж бодит болгох
  const now = Date.now();
  for (let i = 0; i < realTarget; i++) {
    const rnd = (i * 37) % 100;
    const rating = rnd < 72 ? 5 : rnd < 92 ? 4 : 3;
    const pool = pickPool(rating);
    const comment = pool[(i * 7) % pool.length];
    const authorName = NAMES[(i * 3) % NAMES.length];
    const daysAgo = (i * 1.3) % 90;
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    try {
      await prisma.review.create({
        data: { productId: product.id, userId: shuffled[i].id, rating, comment, authorName, createdAt, updatedAt: createdAt },
      });
      added++;
    } catch {
      /* unique давхардал — алгасах */
    }
  }
  // ratingCount нь target (харагдах нийт үнэлгээ) — review-ээс их байж болно (зарим зөвхөн үнэлсэн)
  await recalc(product.id, target);
  return added;
}

async function main() {
  const users = await prisma.user.findMany({ where: { role: 'USER' }, select: { id: true }, take: 200 });
  if (users.length < 5) {
    console.error(`❌ USER хүрэлцэхгүй (${users.length}).`);
    process.exit(1);
  }
  console.log(`Бодит USER: ${users.length}`);

  const products = await prisma.product.findMany({ select: { id: true, slug: true, title: true } });
  let totalReviews = 0;
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    // AI курст 15 (тусгай), бусдад янз бүр
    const target = p.slug === 'ai-ecommerce-curriculum' ? 15 : reviewTargetFor(i);
    const added = await seedProduct(p, users, target);
    totalReviews += added;
    console.log(`  ✓ ${p.slug.slice(0, 30)}: ${added} review (target ratingCount ${target})`);
  }
  console.log(`\n✅ DONE: ${products.length} бүтээгдэхүүн, нийт ${totalReviews} бодит review. ratingCount янз бүр.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('SEED ERROR:', e.message);
  process.exit(1);
});
