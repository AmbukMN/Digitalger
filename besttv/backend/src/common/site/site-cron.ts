import { Logger } from '@nestjs/common';
import { runWithSiteAsync } from './site-context';
import { SITES, type Site } from './site.constants';

/**
 * ⚠️⚠️ CRON-Ы САЙТЫН ХАМРАХ ХҮРЭЭ.
 *
 * Cron нь HTTP хүсэлтээс ГАДУУР ажилладаг тул `SiteMiddleware`
 * хүрдэггүй — контекст БАЙХГҮЙ. Prisma өргөтгөл нь тэр үед шүүлт
 * хийхгүй (бүх сайт).
 *
 * ГЭХДЭЭ ЭНЭ НЬ ЗӨВХӨН ЗАРИМ CRON-Д ЗӨВ:
 *
 * ✅ БҮХ САЙТ ЗЭРЭГ (шүүлтгүй нь зөв):
 *    · `payment-cleanup`  — хугацаа хэтэрсэн төлбөр цэвэрлэх
 *    · `payments-reconcile` — QPay-тэй тулгах
 *    · `storage-usage`    — R2 хэмжээ (нэг дэд бүтэц)
 *    · `errors` цэвэрлэх, `video-recovery`
 *
 * ⛔ САЙТ БҮРД ТУСАД НЬ (шүүлтгүй бол ЭВДЭРНЭ):
 *    · `lifecycle`      — «BestTV-д тавтай морил» имэйл BestFilm-ийн
 *                         хэрэглэгчид ОЧИЖ БОЛОХГҮЙ
 *    · `expiry-notify`  — сунгах линк өөр домэйн руу заана
 *    · `auto-renew`     — ⚠️⚠️ QPay merchant ӨӨР! Буруу данснаас
 *                         мөнгө татах нь БУЦААХ БОЛОМЖГҮЙ алдаа
 *    · `daily-report`   — Telegram тайлан салгах
 *    · `social-scheduler` — FB/IG хуудас өөр
 *
 * ⚠️ Тиймээс тэдгээр cron нь `forEachSite`-аар ДАВТАЖ ажиллана.
 */

const logger = new Logger('SiteCron');

/**
 * Cron-ыг сайт БҮРД тусад нь ажиллуулна.
 *
 * ```ts
 * @Cron('0 11 * * *')
 * async runDaily() {
 *   await forEachSite('lifecycle', (site) => this.runForSite(site));
 * }
 * ```
 *
 * ⚠️ НЭГ САЙТ УНАВАЛ НӨГӨӨГ ЗОГСООХГҮЙ — алдааг барьж логдоод
 * үргэлжилнэ. Эс бөгөөс BestFilm-ийн алдаанаас болж BestTV-ийн
 * хэрэглэгчид имэйл ирэхгүй болно.
 *
 * ⚠️ ДАРААЛЛААР (зэрэг БИШ) — DB холболт `connection_limit=15`,
 * хоёр сайтын хүнд query зэрэг явбал pool дүүрнэ.
 */
export async function forEachSite(
  label: string,
  fn: (site: Site) => Promise<void>,
): Promise<void> {
  for (const site of SITES) {
    try {
      await runWithSiteAsync(site, () => fn(site));
    } catch (e) {
      /* ⚠️ Нэг сайтын алдаа нөгөөг зогсоохгүй */
      logger.error(
        `${label} — ${site} дээр амжилтгүй: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}

/**
 * Сайт бүрд ажиллуулж, дүнг цуглуулна.
 *
 * ⚠️ Тоо буцаадаг cron-д (жишээ: «N имэйл илгээв») — сайт бүрийн
 * дүнг тусад нь логдох боломж өгнө.
 */
export async function mapEachSite<T>(
  label: string,
  fn: (site: Site) => Promise<T>,
): Promise<Partial<Record<Site, T>>> {
  const out: Partial<Record<Site, T>> = {};
  for (const site of SITES) {
    try {
      out[site] = await runWithSiteAsync(site, () => fn(site));
    } catch (e) {
      logger.error(
        `${label} — ${site} дээр амжилтгүй: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return out;
}
