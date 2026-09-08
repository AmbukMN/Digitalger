import { AsyncLocalStorage } from 'node:async_hooks';
import { DEFAULT_SITE, type Site } from './site.constants';

/**
 * ⚠️⚠️ ХҮСЭЛТИЙН САЙТЫГ ДАМЖУУЛАХ МЕХАНИЗМ.
 *
 * ЯАГААД AsyncLocalStorage ВЭ (Prisma `$extends`-ийн оронд):
 *
 * Prisma-гийн alban ёсны загвар нь хүсэлт бүрд `prisma.$extends({...})`
 * дуудаж шинэ client үүсгэх боловч энэ нь БОДИТ ЭРСДЭЛТЭЙ:
 *   · `$extends` бүр өөрийн query engine холболт эзэмшинэ →
 *     `connection_limit=15` дээр хэдэн хүсэлтэд pool дүүрнэ
 *   · main.ts дээр CLUSTER (2 worker) ажиллаж байгаа тул
 *     холболтын тоо мөн 2 дахин
 *   · Nest-ийн DI нь PrismaService-ыг singleton-оор тарааж байгаа тул
 *     36 модулийн 200+ дуудлагыг бүгдийг нь өөрчлөх шаардлагатай болно
 *
 * AsyncLocalStorage нь Node-д СУУЛГААСТАЙ, нэмэлт хамаарал шаардахгүй,
 * нэг client дотор context уншина. Хүсэлтийн урсгал бүр өөрийн store-той.
 *
 * ⚠️ ХЯЗГААР: `setTimeout`, event listener, BullMQ job зэрэг хүсэлтээс
 * ГАДУУР ажиллах кодод context БАЙХГҮЙ → `DEFAULT_SITE` буцна. Тийм
 * газарт сайтыг ГАРААР дамжуулна (`runWithSite`).
 */

interface SiteStore {
  site: Site;
  /**
   * ⚠️ Админ панель — сайт СОНГОЛТ.
   *
   * Админ нь «бүх сайт» горимд ажиллаж болно (нийт борлуулалт харах).
   * Тэр үед шүүлт ХИЙХГҮЙ. Энэ нь зөвхөн ADMIN эрхтэйд зөвшөөрөгдөнө —
   * `SiteInterceptor` шалгана.
   */
  allSites: boolean;
}

const storage = new AsyncLocalStorage<SiteStore>();

/**
 * Хүсэлтийн туршид сайтыг тогтоож, дотор нь callback ажиллуулна.
 *
 * ⚠️⚠️⚠️ ХАМГИЙН ЧУХАЛ УРХИ — ЗААВАЛ УНШ:
 *
 * `fn` нь **Promise БУЦААВАЛ** контекст АЛДАГДАНА. Учир нь
 * `storage.run()` нь синхроноор дуусаад store-оо хаадаг; Promise-ийн
 * ажил түүнээс ХОЙШ гүйцэтгэгддэг.
 *
 * ```ts
 * // ⛔ БУРУУ — шүүлт ЧИМЭЭГҮЙ ажиллахгүй:
 * const n = await runWithSite('bestfilm', () => prisma.user.count());
 * //                                       ↑ Promise-ыг ГАДАГШ буцаав
 *
 * // ✅ ЗӨВ — await нь контекстийг дотор барина:
 * const n = await runWithSiteAsync('bestfilm', async () => {
 *   return prisma.user.count();
 * });
 * ```
 *
 * БОДИТ БАТАЛГАА (2026-09-08, production хуулбар дээр):
 *   sync callback  → `hasSiteContext()=false` → 2,179 хэрэглэгч буцав
 *   async callback → `hasSiteContext()=true`  → 0 буцав (зөв)
 *
 * ⚠️ Middleware дэх `runWithSite(site, () => next())` нь АЮУЛГҮЙ —
 * `next()` нь Promise биш, дараагийн давхаргыг СИНХРОНООР дууддаг
 * бөгөөд `await` бүхэн тэр дуудлагын ДОТОР үүсдэг (батлагдсан).
 *
 * ⚠️ Async ажилд ЗААВАЛ `runWithSiteAsync` ашигла.
 */
export function runWithSite<T>(site: Site, fn: () => T, allSites = false): T {
  return storage.run({ site, allSites }, fn);
}

/**
 * ⚠️ Async ажилд зориулсан хувилбар — контекстийг `await` дуустал барина.
 *
 * Хэрэглэх: webhook, cron, BullMQ job, тест — Promise буцаадаг бүх зүйл.
 * Дэлгэрэнгүй тайлбар `runWithSite` дээр.
 */
export async function runWithSiteAsync<T>(
  site: Site,
  fn: () => Promise<T> | T,
  allSites = false,
): Promise<T> {
  /* ⚠️ `async` callback — `await` нь `storage.run` ДОТОР үүснэ */
  return storage.run({ site, allSites }, async () => fn());
}

/**
 * Одоогийн сайт. Context байхгүй бол `besttv`.
 *
 * ⚠️ Fallback нь ЗОРИУДЫН: cron, worker, seed скрипт нь хүсэлтгүй
 * ажилладаг. Тэднийг BestTV гэж үзэх нь одоогийн зан төлөвтэй ижил.
 */
export function currentSite(): Site {
  return storage.getStore()?.site ?? DEFAULT_SITE;
}

/** Админ «бүх сайт» горимд байна уу — тийм бол site шүүлт алгасна. */
export function isAllSites(): boolean {
  return storage.getStore()?.allSites ?? false;
}

/**
 * Context огт тогтоогдоогүй эсэх (хүсэлтээс гадуур).
 *
 * ⚠️ Prisma өргөтгөл үүнийг ашиглана: context байхгүй үед шүүлт
 * ХИЙХГҮЙ. Учир нь cron нь БҮХ сайтын өгөгдөлд ажиллах ёстой
 * (жишээ: захиалгын хугацаа дуусгах watchdog).
 */
export function hasSiteContext(): boolean {
  return storage.getStore() !== undefined;
}

/**
 * Тухайн блокийн туршид site шүүлтийг ТҮР УНТРААНА.
 *
 * ⚠️ Хэрэглэх ЦОРЫН ГАНЦ тохиолдол: хоёр сайтын өгөгдлийг
 * зориуд нийлүүлж харах (админы «нийт» дашбоард, webhook-ийн
 * бичлэг хайх, migration шалгах скрипт).
 * Бусад газар ХЭРЭГЛЭВЭЛ өгөгдөл холилдоно.
 *
 * ⚠️⚠️ ASYNC — `runWithSite`-ийн урхинаас сэргийлж `async` болгосон.
 * Promise буцаадаг callback-т контекст алдагдахгүй.
 */
export async function runAcrossSites<T>(fn: () => Promise<T> | T): Promise<T> {
  const cur = storage.getStore();
  return storage.run(
    { site: cur?.site ?? DEFAULT_SITE, allSites: true },
    async () => fn(),
  );
}

/**
 * ⚠️ Синхрон хувилбар — ЗӨВХӨН Promise БУЦААХГҮЙ callback-д.
 *
 * Ихэвчлэн хэрэггүй. Async ажилд `runAcrossSites` ашигла.
 */
export function runAcrossSitesSync<T>(fn: () => T): T {
  const cur = storage.getStore();
  return storage.run({ site: cur?.site ?? DEFAULT_SITE, allSites: true }, fn);
}
