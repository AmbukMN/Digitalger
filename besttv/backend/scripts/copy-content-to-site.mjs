#!/usr/bin/env node
/**
 * НЭГ САЙТЫН КОНТЕНТЫГ НӨГӨӨ РҮҮ ХУУЛНА (баннер · блог).
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: BestFilm нээгдэхэд `HomeBanner` ба
 * `BlogPost` нь 0 мөртэй байсан (site-scope миграц нь БАЙГАА мөрийг
 * `besttv` гэж тэмдэглэдэг, хуулбарладаггүй). Үр дүнд нүүр хуудсанд
 * баннер огт гарахгүй, блог хоосон байв.
 *
 * ⚠️ ЮУ Ч УСТГАХГҮЙ — зөвхөн НЭМНЭ. Байгаа мөрийг ДАВХАРДУУЛАХГҮЙ
 *    (гарчгаар шалгана).
 *
 * ⚠️ R2 зураг нь ХУВААЛЦСАН (`assets.besttv.us`) тул `imageKey`-г
 *    шууд хуулна — файл дахин хуулах шаардлагагүй.
 *
 * ⚠️ Баннерын `ctaHref` нь `/movie/<slug>` руу заадаг. Тэр кино
 *    зорилтот сайтад БАЙГАА эсэхийг шалгана — байхгүй бол баннерыг
 *    алгасна (404 руу заасан баннер тавихаас ИЛҮҮ дээр).
 *
 * Хэрэглэх:
 *   node copy-content-to-site.mjs --from=besttv --to=bestfilm --dry
 *   node copy-content-to-site.mjs --from=besttv --to=bestfilm
 *   node copy-content-to-site.mjs --from=besttv --to=bestfilm --only=blog
 */
import { PrismaClient } from '@prisma/client';

const arg = (k, d) => {
  const v = process.argv.find((a) => a.startsWith(`--${k}=`));
  return v ? v.split('=').slice(1).join('=') : d;
};
const FROM = arg('from', 'besttv');
const TO = arg('to', 'bestfilm');
const ONLY = arg('only', 'all'); // all | banners | blog
const DRY = process.argv.includes('--dry');

if (FROM === TO) {
  console.error('⛔ --from ба --to ижил байна');
  process.exit(1);
}

/**
 * ⚠️⚠️ ЖИНХЭНЭ PrismaClient — `PrismaService` БИШ.
 *
 * `PrismaService` нь site өргөтгөлтэй тул `where: { site: FROM }`
 * гэж бичсэн ч дээр нь `AND site = currentSite()` нэмэгдэж, ХОЁР
 * нөхцөл зөрчилдөж 0 мөр буцаана. Энэ скрипт нь хоёр сайтыг ЗЭРЭГ
 * харах ёстой цөөн хэдэн газрын нэг.
 */
const prisma = new PrismaClient();

const log = (...a) => console.log(...a);
let added = 0;
let skipped = 0;

try {
  /* ─────────────────────────────────────────────────────────
     1. БАННЕР
     ───────────────────────────────────────────────────────── */
  if (ONLY === 'all' || ONLY === 'banners') {
    const src = await prisma.homeBanner.findMany({
      where: { site: FROM },
      orderBy: { position: 'asc' },
    });
    const existing = await prisma.homeBanner.findMany({
      where: { site: TO },
      select: { title: true },
    });
    const have = new Set(existing.map((b) => b.title));

    log(`\n── Баннер (${FROM} → ${TO}) ──`);
    log(`  эх сурвалж ${src.length} · зорилтод аль хэдийн ${have.size}`);

    for (const b of src) {
      if (have.has(b.title)) {
        log(`  ⏭️  «${b.title}» — аль хэдийн байна`);
        skipped++;
        continue;
      }

      /* ⚠️ CTA нь киног заасан бол тэр кино зорилтот сайтад байх ёстой */
      const m = /^\/movie\/([^/?#]+)/.exec(b.ctaHref || '');
      if (m) {
        const t = await prisma.title.findFirst({
          where: { slug: m[1], sites: { has: TO }, isActive: true },
          select: { id: true },
        });
        if (!t) {
          log(`  ⚠️  «${b.title}» — /movie/${m[1]} нь ${TO}-д АЛГА, алгаслаа`);
          skipped++;
          continue;
        }
      }

      if (!DRY) {
        const { id, createdAt, updatedAt, ...data } = b;
        await prisma.homeBanner.create({ data: { ...data, site: TO } });
      }
      log(`  ✅ «${b.title}»  (position ${b.position})`);
      added++;
    }
  }

  /* ─────────────────────────────────────────────────────────
     2. БЛОГ
     ───────────────────────────────────────────────────────── */
  if (ONLY === 'all' || ONLY === 'blog') {
    const src = await prisma.blogPost.findMany({
      where: { site: FROM },
      orderBy: { createdAt: 'asc' },
    });
    const existing = await prisma.blogPost.findMany({
      where: { site: TO },
      select: { slug: true },
    });
    const have = new Set(existing.map((p) => p.slug));

    log(`\n── Блог (${FROM} → ${TO}) ──`);
    log(`  эх сурвалж ${src.length} · зорилтод аль хэдийн ${have.size}`);

    for (const p of src) {
      if (have.has(p.slug)) {
        log(`  ⏭️  «${p.title}» — аль хэдийн байна`);
        skipped++;
        continue;
      }
      if (!DRY) {
        const { id, createdAt, updatedAt, views, ...data } = p;
        await prisma.blogPost.create({
          data: {
            ...data,
            site: TO,
            /* ⚠️ Үзэлтийн тоог 0-ээс — нөгөө сайтын тоог өвлөхгүй */
            views: 0,
          },
        });
      }
      log(`  ✅ «${p.title}»`);
      added++;
    }
  }

  log(`\n${DRY ? '(--dry — бичсэнгүй) ' : ''}нэмсэн ${added} · алгассан ${skipped}`);

  /* ─────────────────────────────────────────────────────────
     3. БАТЛАХ — DB-ээс дахин уншина
     ───────────────────────────────────────────────────────── */
  if (!DRY) {
    log('\n── Батлах ──');
    for (const [name, fn] of [
      ['HomeBanner', () => prisma.homeBanner.count({ where: { site: TO } })],
      ['BlogPost', () => prisma.blogPost.count({ where: { site: TO } })],
    ]) {
      log(`  ${name.padEnd(12)} ${TO}: ${await fn()} мөр`);
    }
    /* ⚠️ Эх сайт ХӨНДӨГДӨӨГҮЙ эсэхийг ЗААВАЛ батлана */
    log('  ── эх сайт хэвээр үү ──');
    for (const [name, fn] of [
      ['HomeBanner', () => prisma.homeBanner.count({ where: { site: FROM } })],
      ['BlogPost', () => prisma.blogPost.count({ where: { site: FROM } })],
    ]) {
      log(`  ${name.padEnd(12)} ${FROM}: ${await fn()} мөр`);
    }
  }
} finally {
  await prisma.$disconnect();
}
