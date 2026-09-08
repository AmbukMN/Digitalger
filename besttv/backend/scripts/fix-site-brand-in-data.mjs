#!/usr/bin/env node
/**
 * ӨГӨГДӨЛ ДОТОРХ БУРУУ БРЭНДИЙГ ЗАСНА (BestFilm мөрүүд).
 *
 * ⚠️⚠️ БОДИТ АЛДАА (production аудитаар илэрсэн): bestfilm.net-ийн
 * 178 киноны хуудас БҮГД `<title>` дотор «BestTV дээр онлайнаар үзэх»
 * гэж Google-д индексжиж байв. Мөн хуулийн хуудсын гарчиг
 * «Үйлчилгээний нөхцөл | BestTV», блогийн зохиогч «BestTV».
 *
 * Шалтгаан: BestTV-ийн мөрийг ХУУЛЖ BestFilm үүсгэхэд `content`-ыг
 * нь зассан ч `metaTitle`/`metaDescription`/`author` талбарыг хуулсан
 * хэвээр орхисон. Мөн админы client талын SEO үүсгэгч «BestTV»-г
 * хатуу бичсэн байсан (тэр код зассан).
 *
 * ⚠️ ЗӨВХӨН `site='bestfilm'` (эсвэл `sites`-д bestfilm БАЙГАА ч
 * besttv БАЙХГҮЙ) мөрийг хөндөнө — BestTV-ийн өгөгдөлд ХҮРЭХГҮЙ.
 *
 * ⚠️⚠️ `Title` нь ХОЁР сайтад ХУВААЛЦСАН (нэг мөр). Тиймээс
 * `metaTitle`-ыг «BestFilm» болгож солибол BestTV дээр буруу болно!
 * Шийдэл: брэндийн нэрийг мета талбараас БҮРМӨСӨН хасна — «Нэр (Он)»
 * гэж үлдээнэ. Frontend нь `layout.tsx`-ийн `template`-ээр
 * «| BestFilm» / «| BestTV» гэж сайт бүрд ЗӨВ нэмнэ.
 *
 * Хэрэглэх:
 *   node scripts/fix-site-brand-in-data.mjs --dry
 *   node scripts/fix-site-brand-in-data.mjs
 */
import { PrismaClient } from '@prisma/client';

const DRY = process.argv.includes('--dry');

/**
 * ⚠️ ЖИНХЭНЭ PrismaClient — `PrismaService` БИШ.
 * Хоёр сайтын өгөгдлийг ЗЭРЭГ харах ёстой цөөн газрын нэг.
 */
const prisma = new PrismaClient();

const log = (...a) => console.log(...a);
let changed = 0;

/**
 * Брэндийн сүүлийг мета гарчигаас хасна.
 *
 * «Х (2024) — BestTV дээр онлайнаар үзэх» → «Х (2024)»
 * «Үйлчилгээний нөхцөл | BestTV»          → «Үйлчилгээний нөхцөл»
 *
 * ⚠️ `Title` нь хуваалцсан тул ЯМАР Ч брэнд үлдээж болохгүй —
 * frontend template нь сайт бүрд зөвийг нь нэмнэ.
 */
function stripBrandTitle(s) {
  if (!s) return s;
  return s
    .replace(/\s*[—–-]\s*BestTV\s*дээр\s*онлайнаар\s*үзэх\s*$/i, '')
    .replace(/\s*[—–-]\s*BestFilm\s*дээр\s*онлайнаар\s*үзэх\s*$/i, '')
    .replace(/\s*[—–-]\s*BestTV\s*$/i, '')
    .replace(/\s*[—–-]\s*BestFilm\s*$/i, '')
    .replace(/\s*\|\s*BestTV\s*$/i, '')
    .replace(/\s*\|\s*BestFilm\s*$/i, '')
    .trim();
}

/** Тайлбар доторх брэндийн нэрийг зорилтот сайтынхаар солино */
function swapBrandText(s, to = 'BestFilm') {
  if (!s) return s;
  return s.split('BestTV').join(to);
}

try {
  /* ─────────────────────────────────────────────────────────
     1. Title — ХУВААЛЦСАН тул брэндийг БҮРМӨСӨН хасна
     ───────────────────────────────────────────────────────── */
  const titles = await prisma.title.findMany({
    where: {
      OR: [
        { metaTitle: { contains: 'BestTV' } },
        { metaDescription: { contains: 'BestTV' } },
      ],
    },
    select: { id: true, title: true, sites: true, metaTitle: true, metaDescription: true },
  });

  log(`\n── Title (${titles.length} мөр) ──`);
  log('  ⚠️ Кино нь ХУВААЛЦСАН тул брэндийг мета талбараас БҮРМӨСӨН хасна.');
  log('     Frontend-ийн `template` сайт бүрд зөв нэрийг нэмнэ.\n');

  let tFixed = 0;
  for (const t of titles) {
    const mt = stripBrandTitle(t.metaTitle);
    /**
     * ⚠️ Тайлбарт «BestTV дээр өндөр чанартай…» гэсэн ӨГҮҮЛБЭР бий.
     * Түүнийг хасвал өгүүлбэр эвдэрнэ тул «манай сайт» болгоно —
     * хоёр сайтад ч зөв уншигдана.
     */
    const md = t.metaDescription?.split('BestTV').join('манай сайт') ?? t.metaDescription;

    if (mt === t.metaTitle && md === t.metaDescription) continue;
    if (!DRY) {
      await prisma.title.update({
        where: { id: t.id },
        data: { metaTitle: mt, metaDescription: md },
      });
    }
    tFixed++;
    if (tFixed <= 3) {
      log(`  · «${t.title}»`);
      log(`      ${JSON.stringify(t.metaTitle)} → ${JSON.stringify(mt)}`);
    }
  }
  if (tFixed > 3) log(`  … ба бусад ${tFixed - 3}`);
  log(`  ${DRY ? '(dry) ' : ''}зассан: ${tFixed}`);
  changed += tFixed;

  /* ─────────────────────────────────────────────────────────
     2. Page — SCOPED (сайт бүрд өөрийн мөр) → BestFilm болгоно
     ───────────────────────────────────────────────────────── */
  const pages = await prisma.page.findMany({
    where: {
      site: 'bestfilm',
      OR: [
        { metaTitle: { contains: 'BestTV' } },
        { metaDescription: { contains: 'BestTV' } },
        { content: { contains: 'BestTV' } },
      ],
    },
    select: { id: true, slug: true, metaTitle: true, metaDescription: true, content: true },
  });

  log(`\n── Page / bestfilm (${pages.length} мөр) ──`);
  for (const p of pages) {
    const data = {
      metaTitle: swapBrandText(p.metaTitle),
      metaDescription: swapBrandText(p.metaDescription),
      content: swapBrandText(p.content),
    };
    if (!DRY) await prisma.page.update({ where: { id: p.id }, data });
    log(`  · /p/${p.slug}  ${JSON.stringify(p.metaTitle)} → ${JSON.stringify(data.metaTitle)}`);
    changed++;
  }

  /* ─────────────────────────────────────────────────────────
     3. BlogPost — SCOPED → BestFilm болгоно
     ───────────────────────────────────────────────────────── */
  const posts = await prisma.blogPost.findMany({
    where: {
      site: 'bestfilm',
      OR: [
        { author: { contains: 'BestTV' } },
        { content: { contains: 'BestTV' } },
        { title: { contains: 'BestTV' } },
        { excerpt: { contains: 'BestTV' } },
        { metaTitle: { contains: 'BestTV' } },
        { metaDescription: { contains: 'BestTV' } },
      ],
    },
    select: {
      id: true, slug: true, title: true, excerpt: true, content: true,
      author: true, metaTitle: true, metaDescription: true,
    },
  });

  log(`\n── BlogPost / bestfilm (${posts.length} мөр) ──`);
  for (const b of posts) {
    const data = {
      title: swapBrandText(b.title),
      excerpt: swapBrandText(b.excerpt),
      content: swapBrandText(b.content),
      author: swapBrandText(b.author),
      metaTitle: swapBrandText(b.metaTitle),
      metaDescription: swapBrandText(b.metaDescription),
    };
    if (!DRY) await prisma.blogPost.update({ where: { id: b.id }, data });
    log(`  · «${b.title}»  author: ${JSON.stringify(b.author)} → ${JSON.stringify(data.author)}`);
    changed++;
  }

  /* ─────────────────────────────────────────────────────────
     4. БАТЛАХ
     ───────────────────────────────────────────────────────── */
  log(`\n${DRY ? '(--dry — бичсэнгүй) ' : ''}нийт ${changed} мөр\n`);

  if (!DRY) {
    log('── Батлах (DB-ээс дахин уншив) ──');
    const left = {
      'Title metaTitle': await prisma.title.count({ where: { metaTitle: { contains: 'BestTV' } } }),
      'Title metaDesc': await prisma.title.count({ where: { metaDescription: { contains: 'BestTV' } } }),
      'Page bestfilm': await prisma.page.count({
        where: { site: 'bestfilm', OR: [{ metaTitle: { contains: 'BestTV' } }, { content: { contains: 'BestTV' } }] },
      }),
      'Blog bestfilm': await prisma.blogPost.count({
        where: { site: 'bestfilm', OR: [{ author: { contains: 'BestTV' } }, { content: { contains: 'BestTV' } }] },
      }),
    };
    for (const [k, v] of Object.entries(left)) {
      log(`  ${v === 0 ? '✅' : '⚠️'} ${k.padEnd(18)} үлдсэн: ${v}`);
    }

    /* ⚠️ BestTV-ийн өгөгдөл ХӨНДӨГДӨӨГҮЙ эсэхийг ЗААВАЛ */
    log('\n  ── BestTV хэвээр үү ──');
    const tvPages = await prisma.page.count({ where: { site: 'besttv' } });
    const tvBlogs = await prisma.blogPost.count({ where: { site: 'besttv' } });
    const tvBrand = await prisma.blogPost.count({
      where: { site: 'besttv', content: { contains: 'BestTV' } },
    });
    log(`  Page besttv: ${tvPages} · BlogPost besttv: ${tvBlogs} (BestTV дурдсан: ${tvBrand})`);
  }
} finally {
  await prisma.$disconnect();
}
