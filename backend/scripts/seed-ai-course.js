// ecommerce-curriculum.html → DigitalGer курс seed (нэг удаа).
// 1 Product (LESSON, adminOnly, түр үнэ) + Course + 14 модул + 69 хичээл + 69 quiz (276 асуулт).
// Видео хоосон — admin-аас Stream upload хийнэ. Дахин ажиллуулахад давхардахгүй (slug шалгана).
//
// Ажиллуулах: HTML-ийг container-д хуулаад
//   docker cp ecommerce-curriculum.html docker-backend-1:/app/curriculum.html
//   docker cp backend/scripts/seed-ai-course.js docker-backend-1:/app/seed-ai-course.js
//   docker exec -w /app docker-backend-1 node seed-ai-course.js
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const HTML_PATH = process.env.CURRICULUM_HTML || '/app/curriculum.html';
const PRODUCT_SLUG = 'ai-ecommerce-curriculum';
const PRODUCT_TITLE = 'AI-аар цахим худалдааны систем бүтээх — Бүрэн курс';

// ── HTML-ээс CURRICULUM + FULL_CONTENT гаргах ────────────────────────────────
function parseHtml() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');

  // CURRICULUM = [...] (JSON)
  const cm = html.match(/const CURRICULUM = (\[[\s\S]*?\]);/);
  if (!cm) throw new Error('CURRICULUM олдсонгүй');
  const curriculum = JSON.parse(cm[1]);

  // FULL_CONTENT = { "Хичээл 1.1": `...HTML...`, ... } (template literal)
  // backtick value-уудыг key-ээр салгаж авна.
  const fcStart = html.indexOf('const FULL_CONTENT');
  const fcSeg = html.slice(fcStart, html.indexOf('const CURRICULUM'));
  const fullContent = {};
  // "<no>": `<html>` хэлбэрийг тааруулна (backtick хүртэл, дотор нь backtick байхгүй гэж үзнэ)
  const re = /"(Хичээл [\d.]+)":\s*`([\s\S]*?)`\s*[,}]/g;
  let m;
  while ((m = re.exec(fcSeg)) !== null) {
    fullContent[m[1]] = m[2];
  }
  return { curriculum, fullContent };
}

// Хичээлийн бүрэн content (rich HTML) — FULL_CONTENT + outline/project/outcome нэгтгэх
function buildLessonContent(lesson, fcHtml) {
  const parts = [];
  if (fcHtml && fcHtml.trim()) {
    parts.push(fcHtml.trim());
  }
  if (lesson.outline?.length) {
    parts.push(
      '<h3>📋 Хичээлийн агуулга</h3><ul>' +
        lesson.outline.map((o) => `<li>${escapeHtml(o)}</li>`).join('') +
        '</ul>',
    );
  }
  if (lesson.project) {
    parts.push(`<h3>🛠️ Дадлага төсөл</h3><p>${escapeHtml(lesson.project)}</p>`);
  }
  if (lesson.outcome?.length) {
    parts.push(
      '<h3>🎯 Сурах үр дүн</h3><ul>' +
        lesson.outcome.map((o) => `<li>${escapeHtml(o)}</li>`).join('') +
        '</ul>',
    );
  }
  if (lesson.tools) {
    parts.push(`<p><strong>🔧 Хэрэгсэл:</strong> ${escapeHtml(lesson.tools)}</p>`);
  }
  return parts.join('\n');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function main() {
  const { curriculum, fullContent } = parseHtml();
  const totalLessons = curriculum.reduce((n, m) => n + m.lessons.length, 0);
  const totalQuiz = curriculum.reduce(
    (n, m) => n + m.lessons.reduce((q, l) => q + (l.quiz?.length || 0), 0),
    0,
  );
  console.log(
    `PARSED: ${curriculum.length} модул, ${totalLessons} хичээл, ${totalQuiz} quiz асуулт, FULL_CONTENT ${Object.keys(fullContent).length}`,
  );

  // Давхардал шалгах — байвал алгасах (дахин ажиллуулахад аюулгүй)
  const existing = await prisma.product.findUnique({ where: { slug: PRODUCT_SLUG } });
  if (existing) {
    console.log(`⚠️ Product '${PRODUCT_SLUG}' аль хэдийн байна (id=${existing.id}). Алгасав.`);
    console.log('   Дахин seed хийхийг хүсвэл эхлээд тухайн product-ийг устга.');
    await prisma.$disconnect();
    return;
  }

  // Нийт хугацаа (минут → секунд)
  const totalSec = curriculum.reduce(
    (n, m) => n + m.lessons.reduce((s, l) => s + (Number(l.min) || 0) * 60, 0),
    0,
  );

  // ── 1. Product (LESSON, adminOnly=true, түр үнэ) ──────────────────────────
  const product = await prisma.product.create({
    data: {
      title: PRODUCT_TITLE,
      slug: PRODUCT_SLUG,
      description:
        '<p>AI хэрэгсэл (Claude Code, Cursor)-ээр бодит цахим худалдааны системийг эхнээс нь бүтээж сурах бүрэн курс. ' +
        `${curriculum.length} модул, ${totalLessons} хичээл, дадлага төсөл, quiz, сертификаттай.</p>`,
      price: 199000, // түр үнэ — admin-аас засна
      type: 'LESSON',
      published: false,
      adminOnly: true, // зөвхөн admin харна (туршаад нийтэлнэ)
      accessType: 'LIFETIME',
      featured: false,
      whatsIncluded:
        `<ul><li>${curriculum.length} модул, ${totalLessons} видео хичээл</li>` +
        `<li>${totalQuiz} quiz асуулт (хичээл бүрд)</li>` +
        '<li>Дадлага төсөл, сурах үр дүн</li>' +
        '<li>Курс дуусахад сертификат</li>' +
        '<li>Насан туршийн хандалт</li></ul>',
    },
  });
  console.log(`✓ Product үүсгэв: ${product.id}`);

  // ── 2. Course ────────────────────────────────────────────────────────────
  const course = await prisma.course.create({ data: { productId: product.id } });

  // ── 3. Модул + хичээл + quiz ──────────────────────────────────────────────
  let lessonCount = 0;
  let quizCount = 0;
  let questionCount = 0;

  for (let mi = 0; mi < curriculum.length; mi++) {
    const mod = curriculum[mi];
    const module = await prisma.courseModule.create({
      data: {
        courseId: course.id,
        title: `${mod.mod_mn} (${mod.mod_en})`,
        sortOrder: mi,
      },
    });

    for (let li = 0; li < mod.lessons.length; li++) {
      const l = mod.lessons[li];
      const content = buildLessonContent(l, fullContent[l.no]);
      const lesson = await prisma.lesson.create({
        data: {
          courseId: course.id,
          moduleId: module.id,
          title: l.mn || l.en || l.no,
          description: l.en || null, // богино тайлбар (англи нэр)
          content, // дэлгэрэнгүй rich HTML
          durationSec: (Number(l.min) || 0) * 60,
          sortOrder: li,
          isFreePreview: mi === 0 && li === 0, // эхний хичээл preview
          // видео хоосон — admin Stream upload хийнэ
        },
      });
      lessonCount++;

      // ── Quiz (хичээл бүрд) ──────────────────────────────────────────────
      if (l.quiz?.length) {
        await prisma.quiz.create({
          data: {
            lessonId: lesson.id,
            title: `${l.mn} — Шалгалт`,
            passScore: 60,
            questions: {
              create: l.quiz.map((q, qi) => ({
                question: q.q,
                options: q.opts,
                correctIndex: Number(q.ans),
                sortOrder: qi,
              })),
            },
          },
        });
        quizCount++;
        questionCount += l.quiz.length;
      }
    }
    console.log(`  ✓ M${mod.mod_no}: ${mod.lessons.length} хичээл`);
  }

  console.log(
    `\n✅ DONE: 1 product, 1 course, ${curriculum.length} модул, ${lessonCount} хичээл, ${quizCount} quiz, ${questionCount} асуулт`,
  );
  console.log(`   Product slug: ${PRODUCT_SLUG} (adminOnly=true, published=false)`);
  console.log('   ⚠️ Admin-аас: видео upload, үнэ/зураг тохируулах, дараа adminOnly авах + нийтлэх');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('SEED ERROR:', e.message);
  process.exit(1);
});
