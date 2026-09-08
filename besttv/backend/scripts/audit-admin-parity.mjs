#!/usr/bin/env node
/**
 * АДМИН ПАНЕЛИЙН ДАВХАРДСАН ФОРМУУДЫН ТЭНЦВЭР.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ:
 *
 * БОДИТ АЛДАА (2026-09-08): `Title.sites` («аль сайтад харагдах»)
 * талбарыг `/movies/[id]` бүтэн хуудсанд нэмээд, ЖАГСААЛТААС нээгддэг
 * МОДАЛД (`title-edit-dialog.tsx`) мартсан. Админ голдуу модалаар
 * заддаг тул шинэ функц НЬ БАЙХГҮЙ мэт харагдсан.
 *
 * Энэ бол давтагдаж болох хэв шинж: нэг өгөгдлийг ХОЁР өөр UI засдаг
 * бол шинэ талбар нэмэхэд аль нэгийг нь мартах эрсдэлтэй. Тэр үед
 * админ талбарыг «алга» гэж бодох, эсвэл нэг замаар хадгалахад нөгөө
 * нь утгыг ЧИМЭЭГҮЙ дарж бичих аюултай.
 *
 * Энэ скрипт нь ижил өгөгдөл засдаг форм хосуудыг харьцуулж, аль
 * нэгэнд нь БАЙХГҮЙ талбарыг илрүүлнэ.
 *
 * Хэрэглэх: node scripts/audit-admin-parity.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ADMIN = path.resolve(HERE, '../../admin/src');

/**
 * Ижил өгөгдөл засдаг форм ХОСУУД.
 *
 * ⚠️ Шинэ давхардсан форм нэмэгдвэл ЭНД бүртгэнэ — эс бөгөөс аудит
 * түүнийг мэдэхгүй.
 */
const PAIRS = [
  {
    name: 'Кино засвар',
    a: { file: 'app/movies/[id]/page.tsx', label: 'бүтэн хуудас' },
    b: { file: 'components/title-edit-dialog.tsx', label: 'модал' },
    /**
     * Хоёуланд нь БАЙХ ЁСТОЙ талбарууд.
     * ⚠️ Зөвхөн бүтэн хуудсанд байх нь ЗӨВ талбаруудыг `onlyA`-д.
     */
    fields: [
      'sites', 'isActive', 'isPremium', 'isBanner', 'comingSoon',
      'watermark', 'rentEnabled', 'rentPrice', 'rentHours',
      'metaTitle', 'metaDescription', 'genreIds', 'year', 'rating',
      'ageRating', 'language', 'director', 'country',
      'trailerYoutubeKey', 'descriptionEn',
    ],
    /* ⚠️ Модалд ЗОРИУД байхгүй — тэдгээр нь тусдаа таб/дэлгэц шаардана */
    onlyA: ['cast', 'gallery'],
  },
];

let issues = 0;

for (const pair of PAIRS) {
  console.log(`\n═══ ${pair.name} ═══`);
  const src = {};
  for (const side of ['a', 'b']) {
    const f = path.join(ADMIN, pair[side].file);
    if (!fs.existsSync(f)) {
      console.error(`  ⛔ олдсонгүй: ${pair[side].file}`);
      issues++;
      src[side] = '';
      continue;
    }
    src[side] = fs.readFileSync(f, 'utf8');
  }
  if (!src.a || !src.b) continue;

  console.log(`  A: ${pair.a.file}  (${pair.a.label})`);
  console.log(`  B: ${pair.b.file}  (${pair.b.label})\n`);

  for (const field of pair.fields) {
    /**
     * Талбар нь ГУРВАН газар байх ёстой:
     *   1. форм state    → `field:` эсвэл `field,`
     *   2. ачаалалт      → `field: e.field` / `e.field`
     *   3. хадгалалт     → `field: form.field` / `form.field`
     *
     * ⚠️ Зөвхөн state-д байгаад payload-д ороогүй бол админ өөрчлөөд
     * хадгалахад ЧИМЭЭГҮЙ алдагдана — хамгийн аюултай тохиолдол.
     */
    const has = (s) => ({
      state: new RegExp(`\\b${field}\\s*:`).test(s),
      load: new RegExp(`e\\.${field}\\b`).test(s),
      save: new RegExp(`form\\.${field}\\b`).test(s),
    });
    const A = has(src.a);
    const B = has(src.b);

    const okA = A.state && A.save;
    const okB = B.state && B.save;

    if (okA && okB) continue;
    if (pair.onlyA?.includes(field) && okA && !okB) continue;

    issues++;
    const fmt = (x) =>
      `state:${x.state ? '✓' : '✗'} load:${x.load ? '✓' : '✗'} save:${x.save ? '✓' : '✗'}`;
    console.log(`  ⚠️  ${field.padEnd(20)} A[${fmt(A)}]  B[${fmt(B)}]`);
    if (okA && !okB) console.log(`      → ${pair.b.label}-д ДУТУУ (админ ихэвчлэн үүгээр заддаг!)`);
    if (!okA && okB) console.log(`      → ${pair.a.label}-д ДУТУУ`);
  }

  /* ── onlyA талбаруудыг мэдээлэл болгон харуулна ── */
  if (pair.onlyA?.length) {
    console.log(`\n  ℹ️  Зөвхөн ${pair.a.label}-д (зориуд): ${pair.onlyA.join(', ')}`);
  }
}

console.log(`\n╚═══ ${issues === 0 ? '✅ тэнцвэртэй' : `⚠️ ${issues} зөрүү`} ═══╝\n`);
process.exitCode = issues ? 1 : 0;
