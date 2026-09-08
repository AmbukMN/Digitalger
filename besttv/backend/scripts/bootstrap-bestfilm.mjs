/**
 * ⚠️⚠️ BESTFILM-ИЙН АНХНЫ ӨГӨГДӨЛ ҮҮСГЭХ.
 *
 * Migration нь БҮХ мөрийг `besttv` болгодог тул BestFilm нь
 * ЦЭВЭР ХООСОН эхэлнэ. Тэр байдлаар сайт нээвэл:
 *
 *   ⛔ Админ нэвтэрч ЧАДАХГҮЙ (User байхгүй)
 *   ⛔ Багц байхгүй → хэрэглэгч ТӨЛБӨР ХИЙЖ ЧАДАХГҮЙ
 *   ⛔ «Үйлчилгээний нөхцөл», «Нууцлал» → 404
 *      (Google/Facebook OAUTH нь эдгээр холбоосыг ШААРДДАГ)
 *   ⛔ Банкны данс байхгүй → шилжүүлгээр төлөх боломжгүй
 *
 * ЭНЭ СКРИПТ нь BestTV-ийн ОДООГИЙН өгөгдлөөс хуулбарлана —
 * гараар бичихээс илүү найдвартай (бодит үнэ, бодит текст).
 *
 * ⚠️ ХУУЛАХГҮЙ ЗҮЙЛС (зориуд):
 *   · Хэрэглэгч — BestFilm шинээр бүртгүүлнэ (таны шийдвэр)
 *   · Төлбөр, захиалга — түүх холилдох ёсгүй
 *   · Купон, урамшуулал — маркетинг тусдаа
 *   · Чат, сэтгэгдэл — өөр хэрэглэгчид
 *
 * Ажиллуулах:
 *   node scripts/bootstrap-bestfilm.mjs --dry     (зөвхөн харах)
 *   node scripts/bootstrap-bestfilm.mjs           (бичих)
 *   node scripts/bootstrap-bestfilm.mjs --db="postgresql://..."
 *
 * ⚠️ ДАХИН АЖИЛЛУУЛАХАД АЮУЛГҮЙ (idempotent) — байгааг алгасана.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import readline from 'node:readline';

const DRY = process.argv.includes('--dry');
const dbArg = process.argv.find((a) => a.startsWith('--db='));
const DB = dbArg ? dbArg.slice(5) : process.env.DATABASE_URL;

if (!DB) {
  console.error('⚠️ DATABASE_URL алга. --db="postgresql://..." эсвэл env');
  process.exit(1);
}

/* ⚠️ ӨРГӨТГӨЛГҮЙ client — site-ыг ГАРААР удирдана.
   Өргөтгөлтэй бол `besttv` контекстээр шүүгдэж хоосон буцна. */
const p = new PrismaClient({ datasources: { db: { url: DB } } });

const SRC = 'besttv';
const DST = 'bestfilm';

const log = [];
const note = (s) => {
  console.log(s);
  log.push(s);
};

/** Нууц үг — админаас асууна (кодод хатуу бичихгүй) */
async function askPassword() {
  if (process.env.BESTFILM_ADMIN_PASSWORD) return process.env.BESTFILM_ADMIN_PASSWORD;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question('BestFilm админы нууц үг: ', (a) => {
      rl.close();
      res(a.trim());
    });
  });
}

async function main() {
  note('╔═══ BestFilm анхны өгөгдөл ═══╗\n');

  /* ── 0. Migration хийгдсэн эсэх ── */
  const cols = await p.$queryRaw`
    SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'site'`;
  if (!cols[0]?.n) {
    console.error('⛔ `site` багана БАЙХГҮЙ — migration эхлээд ажиллуул.');
    process.exit(1);
  }
  note(`✓ migration хийгдсэн (${cols[0].n} хүснэгтэд site)\n`);

  /* ── 1. АДМИН ── */
  note('── 1. Админ хэрэглэгч ──');
  const adminEmail = 'admin@bestfilm.net';
  const existingAdmin = await p.user.findFirst({
    where: { email: adminEmail, site: DST },
    select: { id: true },
  });
  if (existingAdmin) {
    note(`  ⏭  ${adminEmail} аль хэдийн бий`);
  } else if (DRY) {
    note(`  [dry] ${adminEmail} үүсгэнэ`);
  } else {
    const pw = await askPassword();
    if (pw.length < 8) {
      console.error('⛔ Нууц үг 8+ тэмдэгт байх ёстой');
      process.exit(1);
    }
    await p.user.create({
      data: {
        email: adminEmail,
        name: 'BestFilm Admin',
        passwordHash: await bcrypt.hash(pw, 10),
        role: 'ADMIN',
        site: DST,
        emailVerified: true,
      },
    });
    note(`  ✅ ${adminEmail} үүсгэв`);
  }

  /* ── 2. БАГЦ (Plan + PlanGenre) ── */
  note('\n── 2. Багц ──');
  const srcPlans = await p.plan.findMany({
    where: { site: SRC },
    include: { genres: true },
    orderBy: { order: 'asc' },
  });
  const dstPlanCount = await p.plan.count({ where: { site: DST } });

  if (dstPlanCount) {
    note(`  ⏭  ${dstPlanCount} багц аль хэдийн бий`);
  } else if (!srcPlans.length) {
    note('  ⚠️ BestTV-д багц алга — гараар үүсгэнэ үү');
  } else {
    for (const plan of srcPlans) {
      const { id, genres, createdAt, updatedAt, ...rest } = plan;
      if (DRY) {
        note(`  [dry] ${plan.name} — ${plan.price}₮ (${genres.length} жанар)`);
        continue;
      }
      const created = await p.plan.create({ data: { ...rest, site: DST } });
      /* ⚠️ Жанар нь ХУВААЛЦСАН — genreId ижил хэвээр */
      if (genres.length) {
        await p.planGenre.createMany({
          data: genres.map((g) => ({
            planId: created.id,
            genreId: g.genreId,
            site: DST,
          })),
          skipDuplicates: true,
        });
      }
      note(`  ✅ ${plan.name} — ${plan.price}₮ (${genres.length} жанар)`);
    }
  }

  /* ── 3. СТАТИК ХУУДАС ── */
  note('\n── 3. Статик хуудас ──');
  const srcPages = await p.page.findMany({ where: { site: SRC } });
  let pageN = 0;
  for (const page of srcPages) {
    const exists = await p.page.findFirst({
      where: { slug: page.slug, site: DST },
      select: { id: true },
    });
    if (exists) continue;
    if (DRY) {
      note(`  [dry] /${page.slug} — ${page.title}`);
      pageN++;
      continue;
    }
    const { id, createdAt, updatedAt, ...rest } = page;
    await p.page.create({
      data: {
        ...rest,
        site: DST,
        /* ⚠️ Агуулга доторх «BestTV» → «BestFilm» */
        title: rest.title.replaceAll('BestTV', 'BestFilm'),
        content: (rest.content ?? '')
          .replaceAll('BestTV', 'BestFilm')
          .replaceAll('besttv.us', 'bestfilm.net')
          .replaceAll('besttv.mn', 'bestfilm.net'),
      },
    });
    note(`  ✅ /${page.slug} — ${page.title}`);
    pageN++;
  }
  if (!pageN) note(`  ⏭  ${srcPages.length} хуудас аль хэдийн бий`);

  /* ── 4. БАНКНЫ ДАНС ── */
  note('\n── 4. Банкны данс ──');
  const dstBank = await p.bankAccount.count({ where: { site: DST } });
  if (dstBank) {
    note(`  ⏭  ${dstBank} данс бий`);
  } else {
    /**
     * ⚠️ ДАНСЫГ ХУУЛАХГҮЙ — БestFilm нь ӨӨР данстай байх ёстой
     * (QPay merchant ч өөр). Буруу данс руу мөнгө орох нь
     * буцаах боломжгүй алдаа.
     */
    note('  ⚠️ ХУУЛААГҮЙ — админ панелаас ГАРААР нэмнэ');
    note('     (BestFilm нь ӨӨР данстай — QPay merchant ч өөр)');
  }

  /* ── 5. FAQ ── */
  note('\n── 5. Түгээмэл асуулт ──');
  const srcFaqs = await p.faq.findMany({ where: { site: SRC }, orderBy: { order: 'asc' } });
  const dstFaq = await p.faq.count({ where: { site: DST } });
  if (dstFaq) {
    note(`  ⏭  ${dstFaq} FAQ бий`);
  } else if (DRY) {
    note(`  [dry] ${srcFaqs.length} FAQ хуулна`);
  } else {
    for (const f of srcFaqs) {
      const { id, createdAt, updatedAt, ...rest } = f;
      await p.faq.create({
        data: {
          ...rest,
          site: DST,
          question: rest.question.replaceAll('BestTV', 'BestFilm'),
          answer: rest.answer
            .replaceAll('BestTV', 'BestFilm')
            .replaceAll('besttv.us', 'bestfilm.net'),
        },
      });
    }
    note(`  ✅ ${srcFaqs.length} FAQ хуулав`);
  }

  /* ── 6. ХУРААНГУЙ ── */
  note('\n── Эцсийн байдал ──');
  const stat = async (label, fn) => note(`  ${label}: ${await fn()}`);
  await stat('админ', () => p.user.count({ where: { site: DST, role: 'ADMIN' } }));
  await stat('багц', () => p.plan.count({ where: { site: DST } }));
  await stat('хуудас', () => p.page.count({ where: { site: DST } }));
  await stat('FAQ', () => p.faq.count({ where: { site: DST } }));
  await stat('кино (sites-д bestfilm)', () =>
    p.title.count({ where: { sites: { has: DST } } }),
  );

  note(DRY ? '\n⚠️ --dry — ЮУ Ч БИЧСЭНГҮЙ' : '\n✅ Дууслаа');
}

main()
  .catch((e) => {
    console.error('⛔ Алдаа:', e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
