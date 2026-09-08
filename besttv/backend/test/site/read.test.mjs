/**
 * ⚠️⚠️ БОДИТ ӨГӨГДЛИЙН САНГИЙН ТЕСТ.
 *
 * `bestfilm_migration_test` DB нь production-ийн БҮРЭН ХУУЛБАР
 * (2,179 хэрэглэгч, 2,712 төлбөр, 366K үйл явдал) дээр migration
 * ажилласан. Энэ тест нь Prisma өргөтгөл ҮНЭХЭЭР шүүж байгааг
 * бодит query-ээр батална.
 *
 * ⚠️ ЗӨВХӨН УНШИНА — бичих тест нь тусад нь, эцэст нь цэвэрлэнэ.
 * ⚠️ Production DB-д ОГТ ХҮРЭХГҮЙ.
 */
import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

/* ── site-context.ts-ийн хуулбар (dist биш, эх кодоос уншихад TS хэрэгтэй) ── */
const storage = new AsyncLocalStorage();
const currentSite = () => storage.getStore()?.site ?? 'besttv';
const hasSiteContext = () => storage.getStore() !== undefined;
const isAllSites = () => storage.getStore()?.allSites ?? false;
/* ⚠️ ASYNC — sync хувилбар нь Promise гадагш буцаахад контекстээ алддаг */
const runWithSite = (site, fn, allSites = false) =>
  storage.run({ site, allSites }, async () => fn());
const runAcrossSites = (fn) =>
  storage.run({ site: currentSite(), allSites: true }, async () => fn());

/* ── site-models.ts-ийн жагсаалт ── */
const SCOPED = new Set([
  'User','UserSession','DeviceToken','EmailOtp','PasswordResetToken','PhoneVerifySession',
  'UserAuditLog','Payment','Subscription','Plan','PlanGenre','Rental','SavedCard',
  'WalletTransaction','BankAccount','Coupon','Promotion','PromotionPlan','PromotionRedemption',
  'HomeBanner','ChatConversation','ChatMessage','Review','ReviewVote','ReviewReport',
  'Notification','EmailLog','EmailOpen','EmailSuppression','Subscriber','EmailTemplateOverride',
  'EmailTemplateSaved','WatchProgress','MyListItem','Download','PageView','TitleEvent',
  'SearchEvent','ErrorLog','Page','Faq','BlogPost','SocialPost','SocialPostTarget',
  'SocialCrosspost','SocialRelay','SocialSlot','SocialChannelSetting','AdminSeen',
]);
const MULTI = new Set(['Title']);
const READ = new Set(['findFirst','findFirstOrThrow','findMany','count','aggregate','groupBy']);
const BULK = new Set(['updateMany','updateManyAndReturn','deleteMany']);
const CREATE = new Set(['create','createMany','createManyAndReturn']);
const UNIQUE_READ = new Set(['findUnique','findUniqueOrThrow']);

function frag(model, site) {
  if (SCOPED.has(model)) return { site };
  if (MULTI.has(model)) return { sites: { has: site } };
  return null;
}

class Svc extends PrismaClient {
  constructor(url) {
    super({ datasources: { db: { url } } });
    const scoped = this.$extends({
      name: 'site-scope',
      query: { $allModels: { async $allOperations({ model, operation, args, query }) {
        if (!hasSiteContext()) return query(args);
        if (isAllSites()) return query(args);
        const site = currentSite();
        const sc = SCOPED.has(model), mu = MULTI.has(model);
        if (!sc && !mu) return query(args);
        const a = args ?? {};
        const f = frag(model, site);
        if (f && (READ.has(operation) || BULK.has(operation))) {
          return query({ ...a, where: a.where ? { AND: [a.where, f] } : f });
        }
        if (CREATE.has(operation)) {
          const key = mu ? 'sites' : 'site', val = mu ? [site] : site;
          const d = a.data;
          if (Array.isArray(d)) return query({ ...a, data: d.map(r => key in r ? r : {...r,[key]:val}) });
          if (d && typeof d === 'object' && !(key in d)) return query({ ...a, data: {...d,[key]:val} });
          return query(a);
        }
        if (operation === 'upsert') {
          const key = mu ? 'sites' : 'site', val = mu ? [site] : site;
          const c = a.create;
          return query(c && typeof c==='object' && !(key in c) ? {...a, create:{...c,[key]:val}} : a);
        }
        const result = await query(args);
        if (UNIQUE_READ.has(operation) && result && typeof result === 'object') {
          if (sc && 'site' in result && result.site !== site) return null;
          if (mu && Array.isArray(result.sites) && !result.sites.includes(site)) return null;
        }
        return result;
      } } },
    });
    /* ⚠️ PROXY — бодит PrismaService-тэй ЯГ ИЖИЛ. Object.assign нь
       $transaction дотор өргөтгөлийг алддаг (батлагдсан). */
    const base = this;
    return new Proxy(scoped, {
      get(target, prop, recv) {
        if (prop === '$connect' || prop === '$disconnect') return base[prop].bind(base);
        const v = Reflect.get(target, prop, recv);
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
  }
}

const URL = process.argv[2];
if (!URL) { console.error('Хэрэглээ: node integration-test.mjs <DATABASE_URL>'); process.exit(1); }
const p = new Svc(URL);

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try {
    const ok = await fn();
    if (ok === true) { console.log(`  ✅ ${name}`); pass++; }
    else { console.log(`  ❌ ${name} — ${ok}`); fail++; }
  } catch (e) { console.log(`  ❌ ${name} — ОНЦГОЙ: ${e.message.slice(0,110)}`); fail++; }
};

console.log('\n╔═══ БОДИТ DB ТЕСТ — Prisma site өргөтгөл ═══╗\n');

console.log('── 1. УНШИЛТ: сайт бүрд өөр тоо ──');
await t('besttv-д 2179 хэрэглэгч', async () => {
  const n = await runWithSite('besttv', () => p.user.count());
  return n === 2179 || `${n} байна (2179 хүлээсэн)`;
});
await t('bestfilm-д 0 хэрэглэгч', async () => {
  const n = await runWithSite('bestfilm', () => p.user.count());
  return n === 0 || `${n} байна (0 хүлээсэн)`;
});
await t('bestfilm-д 0 төлбөр', async () => {
  const n = await runWithSite('bestfilm', () => p.payment.count());
  return n === 0 || `${n} байна`;
});
await t('besttv-д 2712 төлбөр', async () => {
  const n = await runWithSite('besttv', () => p.payment.count());
  return n === 2712 || `${n} байна`;
});

console.log('\n── 2. КИНО: хоёуланд харагдана ──');
await t('besttv-д 257 кино', async () => {
  const n = await runWithSite('besttv', () => p.title.count());
  return n === 257 || `${n} байна`;
});
await t('bestfilm-д ч 257 кино', async () => {
  const n = await runWithSite('bestfilm', () => p.title.count());
  return n === 257 || `${n} байна`;
});
await t('Episode нь SHARED — хоёуланд ижил', async () => {
  const a = await runWithSite('besttv', () => p.episode.count());
  const b = await runWithSite('bestfilm', () => p.episode.count());
  return (a === b && a > 0) || `besttv=${a} bestfilm=${b}`;
});

console.log('\n── 3. groupBy / aggregate шүүгдэх үү ──');
await t('groupBy — bestfilm хоосон', async () => {
  const r = await runWithSite('bestfilm', () => p.titleEvent.groupBy({ by: ['type'], _count: true }));
  return r.length === 0 || `${r.length} бүлэг буцав`;
});
await t('groupBy — besttv дүнтэй', async () => {
  const r = await runWithSite('besttv', () => p.titleEvent.groupBy({ by: ['type'], _count: true }));
  return r.length > 0 || 'хоосон буцав';
});
await t('aggregate — bestfilm дүн 0', async () => {
  const r = await runWithSite('bestfilm', () => p.payment.aggregate({ _sum: { amount: true } }));
  return (r._sum.amount ?? 0) === 0 || `${r._sum.amount} байна`;
});

console.log('\n── 4. findFirst — нэвтрэлтийн урсгал ──');
await t('besttv-ийн админ besttv-д олдоно', async () => {
  const u = await runWithSite('besttv', () => p.user.findFirst({ where: { email: 'admin@besttv.mn' } }));
  return Boolean(u) || 'олдсонгүй';
});
await t('besttv-ийн админ bestfilm-д ОЛДОХГҮЙ', async () => {
  const u = await runWithSite('bestfilm', () => p.user.findFirst({ where: { email: 'admin@besttv.mn' } }));
  return u === null || `олдлоо: ${u?.id}`;
});

console.log('\n── 5. Байгаа нөхцөл хадгалагдах уу ──');
await t('идэвхтэй хэрэглэгч + site (AND)', async () => {
  const n = await runWithSite('besttv', () => p.user.count({ where: { isActive: true } }));
  const all = await runWithSite('besttv', () => p.user.count());
  return (n <= all && n > 0) || `active=${n} нийт=${all}`;
});
await t('OR нөхцөл эвдэрдэггүй', async () => {
  const n = await runWithSite('besttv', () =>
    p.user.count({ where: { OR: [{ role: 'ADMIN' }, { role: 'USER' }] } }));
  return n === 2179 || `${n} байна`;
});

console.log('\n── 6. runAcrossSites — админы нэгдсэн харагдац ──');
await t('бүх сайтаас 2179 хэрэглэгч', async () => {
  const n = await runAcrossSites(() => p.user.count());
  return n === 2179 || `${n} байна`;
});

console.log('\n── 7. Контекстгүй (cron) — шүүлтгүй ──');
await t('cron нь бүх сайтыг хардаг', async () => {
  const n = await p.user.count();
  return n === 2179 || `${n} байна`;
});

console.log('\n── 8. findUnique хамгаалалт ──');
await t('id-аар олсон мөр өөр сайтынх бол null', async () => {
  const u = await runAcrossSites(() => p.user.findFirst({ where: { site: 'besttv' } }));
  if (!u) return 'туршилтын мөр олдсонгүй';
  const found = await runWithSite('bestfilm', () => p.user.findUnique({ where: { id: u.id } }));
  return found === null || `буцлаа: ${found?.email}`;
});

console.log(`\n╚═══ ${pass} амжилттай · ${fail} унасан ═══╝\n`);
await p.$disconnect();
process.exit(fail ? 1 : 0);
