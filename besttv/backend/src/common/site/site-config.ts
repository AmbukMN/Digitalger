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
  /**
   * ⚠️ Имэйлийн логоны ӨРГӨН (px), `height=34`-д тохирсон.
   *
   * Outlook desktop (Word engine) нь `width:auto`-г ойлгодоггүй тул
   * `width` attribute ЗААВАЛ. Лого бүрийн харьцаа өөр учир сайтаас
   * хамаарна: BestTV 500×200 (2.50) → 85, BestFilm 395×120 (3.29) → 112.
   */
  logoWidth: number;
  /** Telegram сануулгын bot тэмдэг (лог, дохио) */
  alertPrefix: string;

  /**
   * ⚠️ Автомат үүсгэсэн купоны кодын угтвар («BTV3F9A2C»).
   *
   * БОДИТ АЛДАА (аудитаар илэрсэн): `lifecycle.service.ts` нь БҮХ
   * сайтад `BTV` угтвар хэрэглэдэг байв — BestFilm-ийн хэрэглэгчид
   * «BTV…» гэсэн код очиж брэнд зөрдөг.
   */
  couponPrefix: string;
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
    /**
     * ⚠️⚠️ АНХНЫ УТГА нь SES-д БАТАЛГААЖСАН домэйн байх ЁСТОЙ.
     *
     * `noreply@besttv.us` нь eu-north-1-д баталгаажаагүй тул анхны
     * утга байх нь аюултай: `MAIL_FROM` env ямар нэг шалтгаанаар
     * алдагдвал (worker дахин үүсгэх, .env буруу файл г.м.) BestTV-ийн
     * БҮХ имэйл чимээгүй унана. BestFilm дээр яг тэр зүйл болсон.
     */
    mailFrom: envOr('MAIL_FROM', 'noreply@digitalger.mn'),
    logoUrl: envOr('EMAIL_LOGO_URL', 'https://assets.besttv.us/brand/logo.png'),
    tagline: 'Үз, мэдэр, дахин үз',
    guestEmailSuffix: '@guest.besttv.mn',
    noEmailSuffix: '@noemail.besttv.mn',
    brandColor: '#e50914',
    /** 500×200 лого, height=34 → 85px */
    logoWidth: 85,
    alertPrefix: 'BestTV',
    couponPrefix: 'BTV',
  },
  bestfilm: {
    key: 'bestfilm',
    name: SITE_LABEL.bestfilm,
    domain: 'bestfilm.net',
    url: envOr('BESTFILM_FRONTEND_URL', 'https://bestfilm.net'),
    apiUrl: envOr('BESTFILM_PUBLIC_API_URL', 'https://api.bestfilm.net'),
    /**
     * ⚠️⚠️ АНХНЫ УТГА нь `noreply@digitalger.mn` — `bestfilm.net` БИШ.
     *
     * БОДИТ АЛДАА (2026-09-08): анхны утга нь `noreply@bestfilm.net`
     * байсан ба тэр хаяг SES дээр БАТАЛГААЖААГҮЙ тул BestFilm-ийн
     * БҮХ имэйл `MessageRejected: Email address is not verified`
     * гэж унасан — тавтай морил, төлбөр, нууц үг сэргээх бүгд.
     *
     * SES-д (eu-north-1) баталгаажсан ЦОРЫН ГАНЦ домэйн нь
     * `digitalger.mn`. BestTV ажиллаж байсан шалтгаан нь
     * `MAIL_FROM=noreply@digitalger.mn` гэж env-д ТОДОРХОЙ заасан;
     * BestFilm-д тийм заалт байгаагүй тул анхны утга руугаа унасан.
     *
     * ⚠️ `bestfilm.net`-ыг SES-д баталгаажуулсны ДАРАА л
     * `BESTFILM_MAIL_FROM` env-ээр солино. Хүртэл нь илгээгчийн НЭР
     * («BestFilm») л ялгарна — хаяг нь нийтлэг.
     */
    mailFrom: envOr('BESTFILM_MAIL_FROM', envOr('MAIL_FROM', 'noreply@digitalger.mn')),
    /**
     * ⚠️⚠️ ИМЭЙЛИЙН ЛОГО — R2-д БОДИТООР БАЙХ ЁСТОЙ.
     *
     * ⛔ БОДИТ АЛДАА (2026-09-09, хэрэглэгч зурагтай мэдээлсэн):
     * `brand/bestfilm-logo.png` файл R2-д ОГТ БАЙГААГҮЙ → BestFilm-ийн
     * БҮХ имэйлийн толгойд эвдэрсэн зураг (❓ хайрцаг) харагдаж байв.
     *
     * ЗАСВАР: админд оруулсан ЖИНХЭНЭ логог (`.webp`, 500×152) PNG
     * болгож (395×120, тунгалаг) R2-д байршуулав.
     *
     * ⚠️ `-email-` гэсэн нэр нь САНААТАЙ: `bestfilm-logo.png` нэр нь
     * Cloudflare-т 4 цагийн 404 СӨРӨГ КЭШ авсан байсан (файл
     * байршуулсны дараа ч 404 буцаасаар). Кэш дуусахыг хүлээхийн
     * оронд шинэ нэр ашиглав.
     *
     * ⚠️ Зохиосон/демо лого ХЭРЭГЛЭЭГҮЙ — эх сурвалж нь админы
     * `bestfilm:brand` тохиргооны лого.
     */
    logoUrl: envOr(
      'BESTFILM_EMAIL_LOGO_URL',
      'https://assets.besttv.us/brand/bestfilm-email-logo.png',
    ),
    tagline: 'Үз, мэдэр, дахин үз',
    guestEmailSuffix: '@guest.bestfilm.net',
    noEmailSuffix: '@noemail.bestfilm.net',
    /**
     * ⚠️ Логоны ЯГ улаан. Имэйл нь ихэвчлэн ЦАГААН дэвсгэртэй тул
     * light горимын өнгө (`#C8001E`, контраст 6.04:1) ашиглана —
     * `#F80010` нь цагаан дээр 4.20:1, WCAG AA хангахгүй.
     */
    brandColor: '#C8001E',
    /** 395×120 лого, height=34 → 112px */
    logoWidth: 112,
    alertPrefix: 'BestFilm',
    couponPrefix: 'BFM',
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
