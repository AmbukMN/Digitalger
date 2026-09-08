import { currentSite } from './site-context';
import { DEFAULT_SITE, SITE_LABEL, type Site } from './site.constants';

/**
 * ⚠️⚠️ САЙТ БҮРИЙН ТОХИРГОО — ЦОРЫН ГАНЦ ЭХ СУРВАЛЖ.
 *
 * БОДИТ АСУУДАЛ: кодод «BestTV», «besttv.us», «noreply@besttv.us»
 * гэсэн 107 хатуу бичээс бий. BestFilm-д бүртгүүлсэн хэрэглэгч
 * «BestTV-д тавтай морил» имэйл авах нь ЯЛГААГҮЙ АЛДАА —
 * брэнд эвдэрч, хэрэглэгч төөрөлдөнө.
 *
 * ⚠️ ЯАГААД ENV БИШ ВЭ: `process.env.FRONTEND_URL` нь НЭГ утгатай.
 * Нэг backend хоёр сайт үйлчилдэг тул хүсэлт бүрд ӨӨР байх ёстой.
 * Тиймээс env нь зөвхөн ӨГӨГДМӨЛ утга болно.
 *
 * ⚠️ ХЭРЭГЛЭХ: `siteConfig()` — одоогийн хүсэлтийн сайтынхыг өгнө.
 * Cron/worker дотор `siteConfig('bestfilm')` гэж ГАРААР зааж болно.
 */

export interface SiteConfig {
  /** Дотоод түлхүүр — `besttv` | `bestfilm` */
  key: Site;
  /** Хүн уншихад — «BestTV» */
  name: string;
  /** Үндсэн домэйн — «besttv.us» */
  domain: string;
  /** Вэбсайтын хаяг — «https://besttv.us» */
  url: string;
  /** API-ийн нийтийн хаяг (имэйлийн зураг, unsubscribe холбоос) */
  apiUrl: string;
  /** Илгээгчийн имэйл — «noreply@besttv.us» */
  mailFrom: string;
  /** Имэйлийн лого (R2 нийтийн хаяг) */
  logoUrl: string;
  /** Уриа — SEO, имэйлийн preheader */
  tagline: string;
  /** Зочин хэрэглэгчийн имэйлийн төгсгөл — жинхэнэ имэйл БИШ */
  guestEmailSuffix: string;
  /** Имэйлгүй хэрэглэгчийн орлуулагч төгсгөл */
  noEmailSuffix: string;
  /** Брэндийн үндсэн өнгө — имэйлийн товч, толгой */
  brandColor: string;
  /** Telegram сануулгын bot тэмдэг (лог, дохио) */
  alertPrefix: string;
}

/**
 * ⚠️ ENV-ЭЭР ДАРЖ БОЛНО: `SITE_BESTFILM_URL` гэх мэт.
 *
 * Ингэснээр локал хөгжүүлэлтэд (`localhost:3100`, `localhost:3102`)
 * кодыг өөрчлөхгүйгээр туршиж болно.
 */
function envOr(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : fallback;
}

const CONFIGS: Record<Site, SiteConfig> = {
  besttv: {
    key: 'besttv',
    name: SITE_LABEL.besttv,
    domain: 'besttv.us',
    /**
     * ⚠️ `FRONTEND_URL` — ОДООГИЙН env хувьсагч. BestTV-ийн зан төлөв
     * ЯГ ХЭВЭЭР үлдэхийн тулд эхлээд түүнийг уншина.
     */
    url: envOr('FRONTEND_URL', 'https://besttv.us'),
    apiUrl: envOr('PUBLIC_API_URL', 'https://api.besttv.us'),
    mailFrom: envOr('MAIL_FROM', 'noreply@besttv.us'),
    logoUrl: envOr('EMAIL_LOGO_URL', 'https://assets.besttv.us/brand/logo.png'),
    tagline: 'Үз, мэдэр, дахин үз',
    guestEmailSuffix: '@guest.besttv.mn',
    noEmailSuffix: '@noemail.besttv.mn',
    brandColor: '#e50914',
    alertPrefix: 'BestTV',
  },
  bestfilm: {
    key: 'bestfilm',
    name: SITE_LABEL.bestfilm,
    domain: 'bestfilm.net',
    url: envOr('BESTFILM_FRONTEND_URL', 'https://bestfilm.net'),
    apiUrl: envOr('BESTFILM_PUBLIC_API_URL', 'https://api.bestfilm.net'),
    mailFrom: envOr('BESTFILM_MAIL_FROM', 'noreply@bestfilm.net'),
    logoUrl: envOr('BESTFILM_EMAIL_LOGO_URL', 'https://assets.besttv.us/brand/bestfilm-logo.png'),
    tagline: 'Үз, мэдэр, дахин үз',
    guestEmailSuffix: '@guest.bestfilm.net',
    noEmailSuffix: '@noemail.bestfilm.net',
    /**
     * ⚠️ Логоны ЯГ улаан. Имэйл нь ихэвчлэн ЦАГААН дэвсгэртэй тул
     * light горимын өнгө (`#C8001E`, контраст 6.04:1) ашиглана —
     * `#F80010` нь цагаан дээр 4.20:1, WCAG AA хангахгүй.
     */
    brandColor: '#C8001E',
    alertPrefix: 'BestFilm',
  },
};

/**
 * Одоогийн хүсэлтийн сайтын тохиргоо.
 *
 * ⚠️ Хүсэлтээс ГАДУУР (cron, worker) дуудвал `besttv` буцна.
 * Тэнд сайтыг ГАРААР дамжуул: `siteConfig('bestfilm')`.
 */
export function siteConfig(site?: Site): SiteConfig {
  return CONFIGS[site ?? currentSite()] ?? CONFIGS[DEFAULT_SITE];
}

/** Бүх сайтын тохиргоо — cron-д давталт хийхэд. */
export function allSiteConfigs(): SiteConfig[] {
  return Object.values(CONFIGS);
}

/**
 * Имэйл нь ЗОЧНЫ орлуулагч уу — аль ч сайтынхыг таньна.
 *
 * ⚠️ БҮХ сайтыг шалгана: хэрэглэгчийн өгөгдөл сайт хооронд
 * шилжихгүй ч, cron нь хоёуланг хамарч ажилладаг.
 */
export function isPlaceholderEmail(email: string): boolean {
  const e = email.toLowerCase().trim();
  return allSiteConfigs().some(
    (c) => e.endsWith(c.guestEmailSuffix) || e.endsWith(c.noEmailSuffix),
  );
}

/** ⚠️ Хуучин BestTV-ийн тест домэйн — хэвээр таниулна. */
export function isTestEmail(email: string): boolean {
  return email.toLowerCase().trim().endsWith('@besttv.test');
}
