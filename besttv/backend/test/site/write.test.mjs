/**
 * ⚠️⚠️ БИЧИХ ҮЙЛДЛИЙН ТЕСТ — хамгийн эрсдэлтэй хэсэг.
 *
 * `updateMany` / `deleteMany` нь site-гүй явбал ХОЁР сайтын мөрийг
 * зэрэг өөрчилнө. Тэр нь буцаах боломжгүй өгөгдлийн гэмтэл.
 *
 * ⚠️ ЗӨВХӨН `bestfilm_migration_test` DB дээр. Production-д ХҮРЭХГҮЙ.
 * ⚠️ Үүсгэсэн БҮХ мөрийг эцэст нь цэвэрлэнэ (finally блок).
 */
import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();
const currentSite = () => storage.getStore()?.site ?? 'besttv';
const hasSiteContext = () => storage.getStore() !== undefined;
const isAllSites = () => storage.getStore()?.allSites ?? false;
const runWithSite = (site, fn, allSites = false) =>
  storage.run({ site, allSites }, async () => fn());
const runAcrossSites = (fn) =>
  storage.run({ site: currentSite(), allSites: true }, async () => fn());

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

const frag = (m, s) => (SCOPED.has(m) ? { site: s } : MULTI.has(m) ? { sites: { has: s } } : null);

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
          return query(c && typeof c === 'object' && !(key in c) ? {...a, create:{...c,[key]:val}} : a);
        }
        const r = await query(args);
        if (UNIQUE_READ.has(operation) && r && typeof r === 'object') {
          if (sc && 'site' in r && r.site !== site) return null;
          if (mu && Array.isArray(r.sites) && !r.sites.includes(site)) return null;
        }
        return r;
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

const p = new Svc(process.argv[2]);
let pass = 0, fail = 0;
const t = async (name, fn) => {
  try {
    const ok = await fn();
    if (ok === true) { console.log(`  ✅ ${name}`); pass++; }
    else { console.log(`  ❌ ${name} — ${ok}`); fail++; }
  } catch (e) { console.log(`  ❌ ${name} — ОНЦГОЙ: ${e.message.slice(0,130)}`); fail++; }
};

/* ⚠️ Тестийн мөрийг ТАНИХ угтвар — цэвэрлэхэд ашиглана */
const TAG = 'zz_sitetest_';

console.log('\n╔═══ БИЧИХ ҮЙЛДЛИЙН ТЕСТ ═══╗\n');

try {
  console.log('── 1. create — site автоматаар бичигдэх үү ──');
  await t('bestfilm-д үүсгэсэн хэрэглэгч site=bestfilm', async () => {
    const u = await runWithSite('bestfilm', () =>
      p.user.create({ data: { email: `${TAG}a@test.mn`, name: 'Тест', passwordHash: 'x' } }));
    return u.site === 'bestfilm' || `site=${u.site}`;
  });
  await t('besttv-д үүсгэсэн хэрэглэгч site=besttv', async () => {
    const u = await runWithSite('besttv', () =>
      p.user.create({ data: { email: `${TAG}b@test.mn`, name: 'Тест', passwordHash: 'x' } }));
    return u.site === 'besttv' || `site=${u.site}`;
  });
  await t('ИЖИЛ имэйл 2 сайтад зэрэг болно', async () => {
    const u = await runWithSite('bestfilm', () =>
      p.user.create({ data: { email: `${TAG}b@test.mn`, name: 'Тест', passwordHash: 'x' } }));
    return u.site === 'bestfilm' || `site=${u.site}`;
  });

  console.log('\n── 2. updateMany — ХАМГИЙН АЮУЛТАЙ ──');
  await t('bestfilm-ийн updateMany нь besttv-д ХҮРЭХГҮЙ', async () => {
    const r = await runWithSite('bestfilm', () =>
      p.user.updateMany({ where: { email: { startsWith: TAG } }, data: { name: 'ӨӨРЧЛӨГДСӨН' } }));
    /* bestfilm-д 2 мөр (a, b) — besttv-ийн b хөндөгдөх ЁСГҮЙ */
    if (r.count !== 2) return `${r.count} мөр өөрчлөгдөв (2 хүлээсэн)`;
    const bt = await runWithSite('besttv', () =>
      p.user.findFirst({ where: { email: `${TAG}b@test.mn` } }));
    return bt?.name === 'Тест' || `besttv-ийн нэр ЭВДЭРСЭН: ${bt?.name}`;
  });

  console.log('\n── 3. deleteMany — тусгаарлагдах уу ──');
  await t('bestfilm-ийн deleteMany нь besttv-д хүрэхгүй', async () => {
    const r = await runWithSite('bestfilm', () =>
      p.user.deleteMany({ where: { email: { startsWith: TAG } } }));
    if (r.count !== 2) return `${r.count} устав (2 хүлээсэн)`;
    const left = await runAcrossSites(() =>
      p.user.count({ where: { email: { startsWith: TAG } } }));
    return left === 1 || `${left} мөр үлдэв (1 хүлээсэн — besttv-ийнх)`;
  });

  console.log('\n── 4. upsert — create талд site орох уу ──');
  await t('upsert.create-д site бичигдэнэ', async () => {
    const s = await runWithSite('bestfilm', () =>
      p.subscriber.upsert({
        where: { email_site: { email: `${TAG}sub@test.mn`, site: 'bestfilm' } },
        create: { email: `${TAG}sub@test.mn`, source: 'test' },
        update: { source: 'test2' },
      }));
    return s.site === 'bestfilm' || `site=${s.site}`;
  });

  console.log('\n── 5. Title — sites массив ──');
  await t('bestfilm-д үүсгэсэн кино sites=[bestfilm]', async () => {
    const tt = await runWithSite('bestfilm', () =>
      p.title.create({ data: { type: 'MOVIE', title: 'ZZ Тест', slug: `${TAG}film`, description: 'т' } }));
    return (tt.sites.length === 1 && tt.sites[0] === 'bestfilm') || `sites=${JSON.stringify(tt.sites)}`;
  });
  await t('тэр кино besttv-д ХАРАГДАХГҮЙ', async () => {
    const n = await runWithSite('besttv', () =>
      p.title.count({ where: { slug: `${TAG}film` } }));
    return n === 0 || `${n} олдов`;
  });
  await t('зориуд хоёуланд нийтлэвэл хоёуланд харагдана', async () => {
    await runAcrossSites(() =>
      p.title.update({ where: { slug: `${TAG}film` }, data: { sites: ['besttv', 'bestfilm'] } }));
    const a = await runWithSite('besttv', () => p.title.count({ where: { slug: `${TAG}film` } }));
    const b = await runWithSite('bestfilm', () => p.title.count({ where: { slug: `${TAG}film` } }));
    return (a === 1 && b === 1) || `besttv=${a} bestfilm=${b}`;
  });

  console.log('\n── 6. transaction — өргөтгөл дамжих уу ──');
  await t('$transaction дотор site бичигдэнэ', async () => {
    const u = await runWithSite('bestfilm', () =>
      p.$transaction(async (tx) =>
        tx.user.create({ data: { email: `${TAG}tx@test.mn`, name: 'TX', passwordHash: 'x' } })));
    return u.site === 'bestfilm' || `site=${u.site}`;
  });
} finally {
  /* ⚠️⚠️ ЦЭВЭРЛЭХ — тестийн дата ҮЛДЭЭХГҮЙ */
  console.log('\n── ЦЭВЭРЛЭХ ──');
  const dels = await runAcrossSites(async () => {
    const a = await p.user.deleteMany({ where: { email: { startsWith: TAG } } });
    const b = await p.subscriber.deleteMany({ where: { email: { startsWith: TAG } } });
    const c = await p.title.deleteMany({ where: { slug: { startsWith: TAG } } });
    return a.count + b.count + c.count;
  });
  console.log(`  🧹 ${dels} мөр устгав`);

  const left = await runAcrossSites(async () =>
    (await p.user.count({ where: { email: { startsWith: TAG } } })) +
    (await p.title.count({ where: { slug: { startsWith: TAG } } })));
  console.log(left === 0 ? '  ✅ үлдэгдэлгүй' : `  ⚠️ ${left} мөр ҮЛДЭВ!`);

  console.log(`\n╚═══ ${pass} амжилттай · ${fail} унасан ═══╝\n`);
  await p.$disconnect();
  process.exit(fail ? 1 : 0);
}
