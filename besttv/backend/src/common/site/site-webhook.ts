import { runAcrossSites, runWithSiteAsync } from './site-context';
import { toSite, type Site } from './site.constants';

/**
 * ⚠️⚠️ ГАДНААС ИРЭХ WEBHOOK-Д САЙТЫГ ТОГТООХ.
 *
 * АСУУДАЛ: QPay, Bonum, AWS SNS зэрэг гадаад үйлчилгээ нь
 * `X-Site` толгой ИЛГЭЭДЭГГҮЙ. Тэдний хүсэлт `Origin`-гүй,
 * `Host` нь `api.besttv.us` (нэг л домэйн) — тиймээс middleware
 * нь `besttv` гэж таамаглана.
 *
 * ⚠️⚠️ ҮР ДАГАВАР: BestFilm-ийн төлбөрийн webhook ирэхэд
 * `payment.findFirst({ qpayInvoiceId })` нь site='besttv' шүүлттэй
 * явж ОЛДОХГҮЙ → хэрэглэгч мөнгө төлсөн ч эрх авахгүй.
 *
 * Энэ нь ЧИМЭЭГҮЙ алдаа: webhook 200 буцаана, лог «payment
 * олдсонгүй» гэж бичнэ, хэрэглэгч гомдол гаргаж байж мэдэгдэнэ.
 *
 * ШИЙДЭЛ: хоёр алхам —
 *   1. Бичлэгийг БҮХ САЙТААС хайна (`runAcrossSites`)
 *   2. Олдсоны ДАРАА түүний сайтаар үлдсэн ажлыг ажиллуулна
 *      (`runWithSite`) — ингэснээр захиалга, имэйл, мэдэгдэл
 *      бүгд ЗӨВ сайтад очно
 */

/** Сайттай ямар нэг бичлэг (Prisma-гийн `site` багана). */
interface HasSite {
  site: string;
}

/**
 * Webhook-ийн бичлэгийг бүх сайтаас олж, түүний сайтаар
 * үргэлжлүүлнэ.
 *
 * ```ts
 * return resolveByRecord(
 *   () => this.prisma.payment.findFirst({ where: { qpayInvoiceId } }),
 *   (payment) => this.finishPayment(payment),   // ⚠️ payment.site-аар
 *   () => ({ received: true, matched: false }), // олдоогүй үед
 * );
 * ```
 */
export async function resolveByRecord<R extends HasSite, T>(
  find: () => Promise<R | null>,
  then: (record: R) => Promise<T> | T,
  notFound: () => T,
): Promise<T> {
  /* ⚠️ 1. Бүх сайтаас хайна — шүүлтгүй */
  const record = await runAcrossSites(find);
  if (!record) return notFound();

  /**
   * ⚠️ 2. Олдсон бичлэгийн сайтаар үлдсэнийг ажиллуулна.
   *
   * ⚠️⚠️ `runWithSiteAsync` — синхрон хувилбар нь Promise-ыг гадагш
   * буцаахад контекстээ алддаг (`site-context.ts` дахь урхи).
   */
  return runWithSiteAsync(toSite(record.site), () => then(record));
}

/**
 * Сайт нь аль хэдийн мэдэгдэж байвал шууд тогтоох.
 *
 * Хэрэглэх: cron, BullMQ job, webhook — тэдгээр нь боловсруулж буй
 * бичлэгийн сайтыг мэддэг.
 *
 * ⚠️ ASYNC — Promise буцаадаг ажилд контекст алдагдахгүй.
 */
export function withSite<T>(site: Site | string, fn: () => Promise<T> | T): Promise<T> {
  return runWithSiteAsync(toSite(site), fn);
}

export { runAcrossSites };
