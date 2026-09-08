import type { Request } from 'express';
import { DEFAULT_SITE, SITE_DOMAIN, SITE_HEADER, isSite, type Site } from './site.constants';

/**
 * ⚠️⚠️ ХҮСЭЛТЭЭС САЙТЫГ ТОГТООХ — БҮХ ШҮҮЛТИЙН ЭХЛЭЛ.
 *
 * Энд буруу таньвал бүх өгөгдөл буруу сайтад очно.
 *
 * ДАРААЛАЛ (эхнийх нь давамгайлна):
 *   1. `X-Site` толгой  — frontend/admin зориуд илгээнэ
 *   2. `Origin`/`Referer` — хөтчийн шууд хандалт (CORS-той)
 *   3. `Host`            — API-д домэйнээр шууд хандсан
 *   4. Аль нь ч биш      → `besttv` (одоогийн зан төлөв ХЭВЭЭР)
 *
 * ⚠️ 4-р алхам нь ЗОРИУДЫН: хуучин mobile апп, хайлтын бот, кэштэй
 * хөтөч толгойгүй ирж болно. Тэднийг BestTV гэж үзэх нь одоо
 * ажиллаж байгаа зан төлөвтэй ЯГ ИЖИЛ — өөрчлөлт мэдрэгдэхгүй.
 */

/** Админ «бүх сайт» горим — `X-Site: all`. */
const ALL_SITES_VALUE = 'all';

export interface ResolvedSite {
  site: Site;
  /** Шүүлт хийхгүй (админы нэгдсэн дашбоард). */
  allSites: boolean;
}

export function resolveSite(req: Request): ResolvedSite {
  const header = req.headers[SITE_HEADER];
  const raw = Array.isArray(header) ? header[0] : header;

  /**
   * ⚠️ «Бүх сайт» — ЭРХ ШАЛГАХГҮЙ энд.
   *
   * Middleware нь guard-аас ӨМНӨ ажилладаг тул `req.user` хараахан
   * байхгүй. Тиймээс эрхийг `AllSitesGuard` ХОЙШ шалгана —
   * админ биш хүн `X-Site: all` илгээвэл 403 авна.
   *
   * ⚠️ Аюулгүй эсэх: allSites=true нь өгөгдөл ХАРУУЛАХ хамрах хүрээг
   * л өргөтгөнө. Админ бус хүн admin endpoint-д хүрч чадахгүй тул
   * (JwtAuthGuard + RolesGuard) энэ нь нүх биш. Гэсэн ч AllSitesGuard
   * нь давхар хамгаалалт болно.
   */
  if (raw === ALL_SITES_VALUE) {
    return { site: DEFAULT_SITE, allSites: true };
  }

  if (isSite(raw)) return { site: raw, allSites: false };

  const fromOrigin = siteFromUrl(req.headers.origin) ?? siteFromUrl(req.headers.referer);
  if (fromOrigin) return { site: fromOrigin, allSites: false };

  const fromHost = siteFromHost(req.headers.host);
  if (fromHost) return { site: fromHost, allSites: false };

  return { site: DEFAULT_SITE, allSites: false };
}

function siteFromUrl(value: string | undefined): Site | null {
  if (!value) return null;
  try {
    return siteFromHost(new URL(value).host);
  } catch {
    return null;
  }
}

/**
 * Домэйнээр сайт олно. Дэд домэйныг ч хамарна
 * (`www.`, `admin.`, `api.`).
 */
function siteFromHost(host: string | undefined): Site | null {
  if (!host) return null;
  const clean = host.toLowerCase().split(':')[0];
  for (const [site, domain] of Object.entries(SITE_DOMAIN)) {
    if (clean === domain || clean.endsWith(`.${domain}`)) return site as Site;
  }
  return null;
}
