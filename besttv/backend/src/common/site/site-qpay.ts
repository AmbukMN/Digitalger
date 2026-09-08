import { currentSite } from './site-context';
import { DEFAULT_SITE, type Site } from './site.constants';

/**
 * ⚠️⚠️ QPAY MERCHANT — САЙТ БҮРД ӨӨР ДАНС.
 *
 * Хэрэглэгчийн шийдвэр: «qpay uur merchant harin busad buh zuil adil».
 * Өөрөөр хэлбэл R2, SES, n8n нь НЭГ, харин QPay нь ХОЁР — тэгснээр
 * орлого тус тусдаа данс руу орно.
 *
 * ⚠️⚠️ ЯАГААД ЭНЭ НЬ ХАМГИЙН ЭРСДЭЛТЭЙ ВЭ:
 *
 * Буруу merchant ашиглавал ХЭРЭГЛЭГЧИЙН МӨНГӨ БУРУУ ДАНС руу орно.
 * Тэр нь чимээгүй алдаа — QR ажиллана, төлбөр амжилттай болно,
 * зөвхөн мөнгө өөр эзэнд очно. Тиймээс:
 *   · Сайт бүрийн credential бүрэн эсэхийг ЭХЛЭЭД шалгана
 *   · Дутуу бол алдаа ШИДНЭ (чимээгүй besttv руу унахгүй)
 *
 * ⚠️ BestTV-ийн зан төлөв ЯГ ХЭВЭЭР: `QPAY_USERNAME` гэх мэт
 * одоогийн env хувьсагчийг уншина.
 */

export interface QpayCredentials {
  username: string;
  password: string;
  invoiceCode: string;
  callbackUrl: string;
  webhookSecret: string;
}

/** Сайт бүрийн env угтвар. ⚠️ besttv нь угтваргүй — ХУУЧИН нэрс. */
const ENV_PREFIX: Record<Site, string> = {
  besttv: 'QPAY_',
  bestfilm: 'BESTFILM_QPAY_',
};

function read(site: Site, key: string): string {
  return (process.env[`${ENV_PREFIX[site]}${key}`] ?? '').trim();
}

/**
 * Тухайн сайтын QPay мэдээлэл. Дутуу талбарыг хоосон мөрөөр буцаана —
 * бүрэн эсэхийг `isQpayConfigured` шалгана.
 */
export function qpayCredentials(site?: Site): QpayCredentials {
  const s = site ?? currentSite();
  return {
    username: read(s, 'USERNAME'),
    password: read(s, 'PASSWORD'),
    invoiceCode: read(s, 'INVOICE_CODE'),
    callbackUrl: read(s, 'CALLBACK_URL'),
    webhookSecret: read(s, 'WEBHOOK_SECRET'),
  };
}

/** Төлбөр авах боломжтой эсэх — QR үүсгэхийн ӨМНӨ шалгана. */
export function isQpayConfigured(site?: Site): boolean {
  const c = qpayCredentials(site);
  return Boolean(c.username && c.password && c.invoiceCode);
}

/**
 * ⚠️ Токены кэшийн түлхүүр — САЙТААР САЛГАНА.
 *
 * БОДИТ ЭРСДЭЛ: QPay токен нь merchant-д харьяалагдана. Нэг кэшэнд
 * хадгалвал BestFilm-ийн хүсэлт BestTV-ийн токеноор нэхэмжлэх
 * үүсгэж, МӨНГӨ БУРУУ ДАНС руу орно.
 *
 * (Санах ойд тэмдэглэсэн QPay токены алдаа: expires_in нь Unix
 * timestamp — тэр асуудал ХЭВЭЭР, энэ нь ТУСДАА хамгаалалт.)
 */
export function qpayTokenCacheKey(site?: Site): string {
  return `qpay:token:${site ?? currentSite()}`;
}

/**
 * Webhook-ийн нууц үг. ⚠️ Сайт танигдаагүй үед `besttv`-г ашиглана —
 * QPay нь webhook-д `X-Site` толгой илгээдэггүй тул callback URL-д
 * сайтыг шигтгэсэн байх ЁСТОЙ (доорх тайлбар).
 */
export function qpayWebhookSecret(site?: Site): string {
  return qpayCredentials(site ?? DEFAULT_SITE).webhookSecret;
}
