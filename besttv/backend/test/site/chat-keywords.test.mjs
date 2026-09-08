/**
 * ⚠️⚠️ ЧАТБОТЫН ТҮЛХҮҮР ҮГИЙН ТЕСТ.
 *
 * БОДИТ ХЭРЭГЦЭЭ: хэрэглэгч чатад «99», «999» гэж бичихэд
 * «Өнчин охин» киног харуулах ёстой.
 *
 * ⚠️ ЗӨВХӨН тест DB дээр. Үүсгэсэн дүрмийг эцэст нь цэвэрлэнэ.
 *
 * Ажиллуулах:
 *   node test/site/chat-keywords.test.mjs "postgresql://..."
 */
import { PrismaClient } from '@prisma/client';

const DB = process.argv[2] ?? process.env.DATABASE_URL;
if (!DB) {
  console.error('Хэрэглээ: node chat-keywords.test.mjs <DATABASE_URL>');
  process.exit(1);
}
const p = new PrismaClient({ datasources: { db: { url: DB } } });

/* ── `chat-keywords.service.ts`-ийн логикийн хуулбар ── */
function normalize(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function matches(msg, key, type) {
  if (type === 'EXACT') return msg === key;
  if (type === 'PREFIX') return msg.startsWith(key);
  if (type === 'CONTAINS') {
    return new RegExp(`(^|\\s)${escapeRe(key)}(\\s|$)`).test(msg);
  }
  return false;
}

async function match(rawMessage) {
  const msg = normalize(rawMessage);
  if (!msg) return null;
  const rules = await p.chatKeyword.findMany({
    where: { isActive: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    take: 500,
  });
  for (const rule of rules) {
    for (const kw of rule.keywords) {
      const key = normalize(kw);
      if (key && matches(msg, key, rule.matchType)) {
        return { titleIds: rule.titleIds, reply: rule.reply, ruleId: rule.id };
      }
    }
  }
  return null;
}

let pass = 0,
  fail = 0;
const t = async (name, fn) => {
  try {
    const ok = await fn();
    if (ok === true) {
      console.log(`  ✅ ${name}`);
      pass++;
    } else {
      console.log(`  ❌ ${name} — ${ok}`);
      fail++;
    }
  } catch (e) {
    console.log(`  ❌ ${name} — ОНЦГОЙ: ${String(e).slice(0, 120)}`);
    fail++;
  }
};

const TAG = 'zz_kwtest_';

console.log('\n╔═══ ЧАТБОТЫН ТҮЛХҮҮР ҮГ ═══╗\n');

let ruleId = null;
let filmId = null;

try {
  /* ── Бэлтгэл: «Өнчин охин» киног олно ── */
  console.log('── Бэлтгэл ──');
  const film = await p.title.findFirst({
    where: { title: { contains: 'Өнчин охин', mode: 'insensitive' } },
    select: { id: true, title: true, slug: true, isActive: true },
  });
  if (!film) {
    console.log('  ⛔ «Өнчин охин» кино олдсонгүй — тест боломжгүй');
    process.exit(1);
  }
  filmId = film.id;
  console.log(`  ✅ кино: ${film.title} (${film.slug}) идэвхтэй=${film.isActive}`);

  /* ── Дүрэм үүсгэх ── */
  const rule = await p.chatKeyword.create({
    data: {
      keywords: ['99', '999'],
      matchType: 'EXACT',
      titleIds: [film.id],
      note: `${TAG}Өнчин охин — хочилсон нэр`,
      site: 'besttv',
    },
  });
  ruleId = rule.id;
  console.log(`  ✅ дүрэм үүсгэв: [${rule.keywords.join(', ')}] → ${film.title}`);

  /* ── 1. Үндсэн тохиолдол ── */
  console.log('\n── 1. Үндсэн ──');
  await t('«99» → Өнчин охин', async () => {
    const h = await match('99');
    return h?.titleIds[0] === filmId || `олдсонгүй (${JSON.stringify(h)})`;
  });
  await t('«999» → Өнчин охин', async () => {
    const h = await match('999');
    return h?.titleIds[0] === filmId || 'олдсонгүй';
  });

  /* ── 2. Цэвэрлэлт (emoji, зай, том үсэг) ── */
  console.log('\n── 2. Цэвэрлэлт ──');
  await t('« 99 » (зайтай)', async () => {
    const h = await match('  99  ');
    return h?.titleIds[0] === filmId || 'олдсонгүй';
  });
  await t('«99!» (цэг таслал)', async () => {
    const h = await match('99!');
    return h?.titleIds[0] === filmId || 'олдсонгүй';
  });
  await t('«🎬99» (emoji — FB ice breaker)', async () => {
    const h = await match('🎬99');
    return h?.titleIds[0] === filmId || 'олдсонгүй';
  });

  /* ── 3. ⚠️ БУРУУ ТААРАЛТ ГАРАХГҮЙ (EXACT) ── */
  console.log('\n── 3. ⚠️ Буруу таарц ГАРАХГҮЙ ──');
  await t('«1999» → таарахгүй', async () => {
    const h = await match('1999');
    return h === null || `ТААРСАН — буруу! (${h.ruleId})`;
  });
  await t('«99 кино байна уу» → EXACT тул таарахгүй', async () => {
    const h = await match('99 кино байна уу');
    return h === null || 'ТААРСАН — EXACT дүрэм зөрчигдсөн';
  });
  await t('«хайр» → таарахгүй', async () => {
    const h = await match('хайр');
    return h === null || 'ТААРСАН — буруу!';
  });
  await t('хоосон мессеж → null', async () => {
    const h = await match('   ');
    return h === null || 'ТААРСАН — буруу!';
  });

  /* ── 4. CONTAINS горим ── */
  console.log('\n── 4. CONTAINS горим ──');
  await p.chatKeyword.update({ where: { id: ruleId }, data: { matchType: 'CONTAINS' } });
  await t('«99 кино байна уу» → одоо таарна', async () => {
    const h = await match('99 кино байна уу');
    return h?.titleIds[0] === filmId || 'олдсонгүй';
  });
  await t('⚠️ «1999 он» → таарахГҮЙ (бүтэн үг)', async () => {
    const h = await match('1999 он');
    return h === null || 'ТААРСАН — «1999» доторх «99»-д таарч БОЛОХГҮЙ';
  });
  await p.chatKeyword.update({ where: { id: ruleId }, data: { matchType: 'EXACT' } });

  /* ── 5. Идэвхгүй дүрэм ── */
  console.log('\n── 5. Идэвхгүй дүрэм ──');
  await p.chatKeyword.update({ where: { id: ruleId }, data: { isActive: false } });
  await t('идэвхгүй бол таарахгүй', async () => {
    const h = await match('99');
    return h === null || 'ТААРСАН — идэвхгүй дүрэм ажиллаж байна!';
  });
  await p.chatKeyword.update({ where: { id: ruleId }, data: { isActive: true } });

  /* ── 6. Сайтын тусгаарлалт ── */
  console.log('\n── 6. Сайтын тусгаарлалт ──');
  await t('дүрэм site=besttv', async () => {
    const r = await p.chatKeyword.findUnique({ where: { id: ruleId } });
    return r.site === 'besttv' || `site=${r.site}`;
  });
  await t('bestfilm-д ийм дүрэм алга', async () => {
    const n = await p.chatKeyword.count({ where: { site: 'bestfilm' } });
    return n === 0 || `${n} дүрэм байна`;
  });

  /* ── 7. Текст хариу ── */
  console.log('\n── 7. Текст хариу (киногүй) ──');
  const txtRule = await p.chatKeyword.create({
    data: {
      keywords: ['хямдрал'],
      matchType: 'EXACT',
      titleIds: [],
      reply: 'Одоогоор урамшуулал явагдаагүй байна.',
      note: `${TAG}текст хариу`,
      site: 'besttv',
    },
  });
  await t('«хямдрал» → текст хариу', async () => {
    const h = await match('хямдрал');
    return (h?.reply?.includes('урамшуулал') && h.titleIds.length === 0) || 'буруу хариу';
  });
  await p.chatKeyword.delete({ where: { id: txtRule.id } });

  /* ── 8. Эрэмбэ ── */
  console.log('\n── 8. Эрэмбэ (order) ──');
  const first = await p.chatKeyword.create({
    data: {
      keywords: ['99'],
      matchType: 'EXACT',
      titleIds: [],
      reply: 'ЭХНИЙХ',
      order: -10,
      note: `${TAG}эрэмбэ`,
      site: 'besttv',
    },
  });
  await t('order бага нь ТҮРҮҮЛНЭ', async () => {
    const h = await match('99');
    return h?.reply === 'ЭХНИЙХ' || `«${h?.reply}» ирлээ`;
  });
  await p.chatKeyword.delete({ where: { id: first.id } });
} finally {
  /* ⚠️⚠️ ЦЭВЭРЛЭХ — тестийн дата ҮЛДЭЭХГҮЙ */
  console.log('\n── ЦЭВЭРЛЭХ ──');
  const del = await p.chatKeyword.deleteMany({ where: { note: { startsWith: TAG } } });
  console.log(`  🧹 ${del.count} дүрэм устгав`);
  const left = await p.chatKeyword.count({ where: { note: { startsWith: TAG } } });
  console.log(left === 0 ? '  ✅ үлдэгдэлгүй' : `  ⚠️ ${left} үлдэв!`);

  console.log(`\n╚═══ ${pass} амжилттай · ${fail} унасан ═══╝\n`);
  await p.$disconnect();
  process.exit(fail ? 1 : 0);
}
