#!/usr/bin/env node
/**
 * ТОХИРГООНЫ ДАТАГ НЭГ САЙТААС НӨГӨӨ РҮҮ ХУУЛНА.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ (2026-09-08 илэрсэн):
 *
 * `copy-content-to-site.mjs` нь ЗӨВХӨН баннер + блогийг хуулдаг.
 * Гэтэл site-scope миграц нь БАЙГАА мөрийг `besttv` гэж тэмдэглээд
 * орхидог тул BestFilm-д дараах хүснэгтүүд ХООСОН үлдсэн:
 *
 *   · EmailTemplateOverride  6 → 0   (автомат имэйлийн загвар)
 *   · ChatKeyword            2 → 0   (чатботын түлхүүр үг)
 *   · SocialChannelSetting   2 → 0   (FB/IG сувгийн төлөв)
 *
 * Хэрэглэгчийн шаардлага: «BestTV-ийн бүх дата эхлээд BestFilm-д
 * хуулагдсан байх ёстой, дараа нь админаас тусад нь засна».
 *
 * ⚠️ ЮУ Ч УСТГАХГҮЙ — зөвхөн НЭМНЭ. Зорилтот сайтад мөр АЛЬ ХЭДИЙН
 *    байвал АЛГАСНА (дарж бичихгүй) — админ гараар зассан байж
 *    болзошгүй тул түүнийг устгах эрхгүй.
 *
 * ⚠️ Брэндийн нэрийг ЗАЛГАНА: загварын гарчиг/биед `BestTV` гэж
 *    бичигдсэн бол зорилтот сайтын нэрээр солино. Эс бөгөөс
 *    BestFilm-ийн хэрэглэгч «BestTV» гэсэн имэйл авна.
 *
 * Хэрэглэх:
 *   node copy-settings-to-site.mjs --from=besttv --to=bestfilm --dry
 *   node copy-settings-to-site.mjs --from=besttv --to=bestfilm
 */
import { PrismaClient } from '@prisma/client';

const arg = (k, d) => {
  const v = process.argv.find((a) => a.startsWith(`--${k}=`));
  return v ? v.split('=').slice(1).join('=') : d;
};
const FROM = arg('from', 'besttv');
const TO = arg('to', 'bestfilm');
const DRY = process.argv.includes('--dry');

if (FROM === TO) {
  console.error('⛔ --from ба --to ижил байна');
  process.exit(1);
}

/** ⚠️ ЖИНХЭНЭ PrismaClient — site өргөтгөлгүй, хоёр сайтыг зэрэг харна */
const prisma = new PrismaClient();

/** Брэндийн нэрийг сольж бичих (зөвхөн текст талбарт) */
const LABEL = { besttv: 'BestTV', bestfilm: 'BestFilm' };
const rebrand = (v) => {
  if (typeof v !== 'string' || !LABEL[FROM] || !LABEL[TO]) return v;
  return v.split(LABEL[FROM]).join(LABEL[TO]);
};

let added = 0;
let skipped = 0;
const log = (...a) => console.log(...a);

try {
  /* ═══ 1. EmailTemplateOverride — автомат имэйлийн загвар ═══ */
  log('\n── 1. Автомат имэйлийн загвар (EmailTemplateOverride) ──');
  {
    const src = await prisma.emailTemplateOverride.findMany({ where: { site: FROM } });
    const have = new Set(
      (await prisma.emailTemplateOverride.findMany({
        where: { site: TO }, select: { campaign: true },
      })).map((r) => r.campaign),
    );
    for (const row of src) {
      if (have.has(row.campaign)) {
        log(`  ⏭  ${row.campaign} — аль хэдийн бий`);
        skipped++;
        continue;
      }
      const { id: _id, site: _s, createdAt: _c, updatedAt: _u, ...data } = row;
      /**
       * ⚠️ Гарчиг/бие дэх брэндийн нэрийг солино.
       *
       * ⚠️ Талбарын нэр нь `information_schema`-аас БАТАЛГААЖСАН:
       * `bodyHtml`, `ctaText` (`body`/`ctaLabel` БИШ).
       */
      for (const k of ['subject', 'heading', 'bodyHtml', 'ctaText']) {
        if (k in data) data[k] = rebrand(data[k]);
      }
      log(`  + ${row.campaign} — «${String(data.subject ?? '').slice(0, 45)}»`);
      if (!DRY) await prisma.emailTemplateOverride.create({ data: { ...data, site: TO } });
      added++;
    }
    if (!src.length) log('  (эх сурвалж хоосон)');
  }

  /* ═══ 2. ChatKeyword — ХУУЛАХГҮЙ (санаатай) ═══ */
  /**
   * ⚠️⚠️ ЧАТБОТЫН ТҮЛХҮҮР ҮГ НЬ ХУУЛАГДАХГҮЙ.
   *
   * BestTV-ийн 2 мөр нь ТУХАЙН САЙТЫН КИНОНД зориулагдсан:
   *   · `{99,999}` → `titleIds` нь «Өнчин охин» киног заана
   *     (hitCount=9 — бодитоор ажиллаж байгаа)
   *   · `{88}`     → мөн адил
   *
   * `titleIds` нь ЭХ сайтын киноны ID тул BestFilm-д тэр кино
   * БАЙХГҮЙ. Хуулбал хэрэглэгч «99» гэж бичихэд чатбот хоосон
   * хариулж, эвдэрсэн мэт харагдана — хуулаагүйгээс ДОРДОНО.
   *
   * ⚠️ BestFilm-ийн админ өөрийн кинондоо тохируулан ШИНЭЭР
   * үүсгэнэ. Энэ бол дутуу ажил БИШ, шийдвэр.
   */
  log('\n── 2. Чатботын түлхүүр үг (ChatKeyword) ──');
  log('  ⏭  ХУУЛАХГҮЙ — түлхүүр үг нь эх сайтын КИНО руу заадаг');
  log('     (BestFilm-д тэр кино байхгүй тул чатбот хоосон хариулна)');

  /* ═══ 3. SocialChannelSetting — FB/IG сувгийн төлөв ═══ */
  log('\n── 3. Сошиал сувгийн төлөв (SocialChannelSetting) ──');
  {
    const src = await prisma.socialChannelSetting.findMany({ where: { site: FROM } });
    const have = new Set(
      (await prisma.socialChannelSetting.findMany({
        where: { site: TO }, select: { channel: true },
      })).map((r) => r.channel),
    );
    for (const row of src) {
      if (have.has(row.channel)) {
        log(`  ⏭  ${row.channel} — аль хэдийн бий`);
        skipped++;
        continue;
      }
      /**
       * ⚠️⚠️ `paused: true` — BestFilm-д FB/IG хуудас ХАРААХАН
       * үүсээгүй. Идэвхтэй үлдээвэл нийтлэл буруу хуудас руу явах
       * эсвэл чимээгүй унах эрсдэлтэй. Админ хуудсаа холбосны дараа
       * өөрөө асаана.
       */
      log(`  + ${row.channel} (paused=true — хуудас холбогдоогүй)`);
      if (!DRY) {
        await prisma.socialChannelSetting.create({
          data: { channel: row.channel, paused: true, site: TO },
        });
      }
      added++;
    }
    if (!src.length) log('  (эх сурвалж хоосон)');
  }

  /* ═══ ДҮН ═══ */
  log(`\n${DRY ? '[dry] ' : ''}Нэмсэн: ${added} · Алгассан: ${skipped}`);

  if (!DRY) {
    log('\n── Батлах ──');
    const rows = [
      ['EmailTemplateOverride', () => prisma.emailTemplateOverride.count({ where: { site: TO } })],
      ['SocialChannelSetting', () => prisma.socialChannelSetting.count({ where: { site: TO } })],
    ];
    for (const [name, fn] of rows) {
      const to = await fn();
      const from = await (name === 'EmailTemplateOverride'
        ? prisma.emailTemplateOverride.count({ where: { site: FROM } })
        : prisma.socialChannelSetting.count({ where: { site: FROM } }));
      const ok = to >= from ? '✅' : '⚠️';
      log(`  ${ok} ${name}: ${FROM}=${from} → ${TO}=${to}`);
    }
  }
} finally {
  await prisma.$disconnect();
}
