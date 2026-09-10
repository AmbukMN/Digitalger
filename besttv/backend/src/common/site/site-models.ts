import { isSite, type Site } from './site.constants';

/**
 * ⚠️⚠️ АЛЬ МОДЕЛ САЙТААР ТУСГААРЛАГДАХ ВЭ — ЭЦСИЙН ЖАГСААЛТ.
 *
 * Энэ файл нь БҮХ шүүлтийн ЦОРЫН ГАНЦ эх сурвалж. Prisma өргөтгөл,
 * migration, тест бүгд эндээс уншина. Хоёр газар бичвэл заавал зөрнө.
 *
 * ГУРВАН БҮЛЭГ:
 *   1. SCOPED  — `site` багана нэмнэ, автоматаар шүүгдэнэ
 *   2. SHARED  — сайт харгалзахгүй, хоёуланд ижил (кино, жанар)
 *   3. MULTI   — `sites String[]` — аль сайтад ХАРАГДАХ вэ (Title)
 */

/* ────────────────────────────────────────────────────────────────
   1. SCOPED — `site` багана нэмэгдэнэ, автомат шүүлтэд орно
   ──────────────────────────────────────────────────────────────── */

/**
 * ⚠️ Prisma-гийн ЖИЖИГ эхний үсэгтэй нэр (`prisma.user` → 'user').
 * Өргөтгөл нь `params.model`-ыг ингэж хүлээж авдаг.
 */
export const SCOPED_MODELS = [
  /* ── Хэрэглэгч ба нэвтрэлт ── */
  'User', //                нэг имэйл 2 сайтад тусдаа данстай
  'UserSession', //         төхөөрөмжийн хязгаар сайт бүрд тусдаа
  'DeviceToken', //         push мэдэгдэл
  'EmailOtp', //            имэйл баталгаажуулалт
  'PasswordResetToken', //  нууц үг сэргээх
  'PhoneVerifySession', //  утас баталгаажуулалт
  'UserAuditLog', //        админы үйлдлийн түүх

  /* ── Төлбөр ── */
  'Payment', //             ⚠️ QPay merchant ӨӨР тул заавал салгана
  'Subscription',
  'Plan', //                багц, үнэ сайт бүрд өөр
  'PlanGenre',
  'GenreSiteOrder', //      ⚠️ жанрын эрэмбэ сайт бүрд (Genre нь SHARED)
  'TitleSiteOrder', //      ⚠️ киноны эрэмбэ/hero сайт бүрд (Title нь MULTI)
  'Rental',
  'SavedCard',
  'WalletTransaction',
  'BankAccount', //         данс сайт бүрд өөр

  /* ── Маркетинг ── */
  'Coupon',
  'Promotion',
  'PromotionPlan',
  'PromotionRedemption',
  'HomeBanner', //          нүүрний баннер тусдаа

  /* ── Харилцаа ── */
  'ChatConversation',
  'ChatMessage', //         ⚠️ conversationId-аар дамжсан ч ШУУД site
  'Review', //              сэтгэгдэл тусдаа (өөр хэрэглэгчид)
  'ReviewVote',
  'ReviewReport',
  'Notification',

  /* ── Имэйл ── */
  'EmailLog',
  'EmailOpen',
  'EmailSuppression',
  'Subscriber',
  'EmailTemplateOverride',
  'EmailTemplateSaved',

  /* ── Хэрэглэгчийн үйлдэл ── */
  'WatchProgress', //       ⚠️ 2.9M шинэчлэлт — migration болгоомжтой
  'MyListItem',
  'Download',

  /* ── Статистик ── */
  'PageView', //            ⚠️ 132K мөр
  'TitleEvent', //          ⚠️ 366K мөр — хамгийн том
  'SearchEvent',
  'ErrorLog',

  /* ── Контент (сайт бүрд өөр текст) ── */
  'Page', //                нөхцөл, тусламж — сайт бүрд өөр
  'Faq',
  'BlogPost',

  /* ── Сошиал ── */
  'SocialPost',
  'SocialPostTarget',
  'SocialCrosspost',
  'SocialRelay',
  'SocialSlot',
  'SocialChannelSetting',

  /* ── Чатбот ── */
  'ChatKeyword', //         түлхүүр үг сайт бүрд өөр

  /* ── Админ ── */
  'AdminSeen',
] as const;

export type ScopedModel = (typeof SCOPED_MODELS)[number];

/* ────────────────────────────────────────────────────────────────
   2. SHARED — сайтаар шүүгдэхгүй
   ──────────────────────────────────────────────────────────────── */

/**
 * Хуваалцсан моделууд ба ЯАГААД:
 *
 *   Season, Episode, Subtitle — Title-д харьяалагдана. Title нь
 *     `sites[]`-ээр хянагддаг тул эдгээрт site ХЭРЭГГҮЙ. Нэмбэл
 *     давхардсан эх сурвалж болж, зөрөх эрсдэлтэй.
 *
 *   Genre, TitleGenre — жанрын нэр хоёр сайтад ижил. ЭРЭМБЭ ба
 *     ХАРАГДАЦ нь `GenreSiteOrder`-оор сайт бүрд салгагдсан
 *     (2026-09-08). Genre-г өөрийг нь салгавал 160+ киноны холбоос
 *     давхарлах шаардлагатай болно — тиймээс салгахгүй.
 *
 *   Settings — R2, SES, n8n нэг. ⚠️ QPay нь merchant ӨӨР тул
 *     түлхүүрийн нэрэнд сайт шигтгэнэ («bestfilm.qpay.username»)
 *     — модел биш, ӨГӨГДӨЛ түвшинд салгана.
 */
export const SHARED_MODELS = [
  'Title', //     ⚠️ `sites[]`-ээр хянагдана (доор)
  'Season',
  'Episode',
  'Subtitle',
  'Genre',
  'TitleGenre',
  'Settings',
] as const;

/* ────────────────────────────────────────────────────────────────
   3. MULTI — `sites String[]`
   ──────────────────────────────────────────────────────────────── */

/**
 * ⚠️ Title нь ХОЁУЛАНД харагдаж болно. Тиймээс ганц `site` биш,
 * `sites String[]` — «аль сайтуудад нийтлэгдсэн» гэсэн утга.
 *
 * Шүүлт: `where: { sites: { has: currentSite() } }`
 *
 * ⚠️ Migration-д одоогийн 257 кино БҮГД `['besttv','bestfilm']`
 * болно — таны шийдвэрээр эхлээд каталог ижил.
 */
export const MULTI_SITE_MODELS = ['Title'] as const;

/* ────────────────────────────────────────────────────────────────
   Туслах
   ──────────────────────────────────────────────────────────────── */

const scopedSet: ReadonlySet<string> = new Set(SCOPED_MODELS);
const multiSet: ReadonlySet<string> = new Set(MULTI_SITE_MODELS);

export function isScopedModel(model: string | undefined): boolean {
  return Boolean(model) && scopedSet.has(model as string);
}

export function isMultiSiteModel(model: string | undefined): boolean {
  return Boolean(model) && multiSet.has(model as string);
}

/**
 * Тухайн моделд тохирох site шүүлтийн хэсгийг буцаана.
 *
 *   scoped → `{ site: 'besttv' }`
 *   multi  → `{ sites: { has: 'besttv' } }`
 *   бусад  → `null` (шүүлт хийхгүй)
 */
export function siteWhereFragment(
  model: string | undefined,
  site: Site,
): Record<string, unknown> | null {
  if (isScopedModel(model)) return { site };
  if (isMultiSiteModel(model)) return { sites: { has: site } };
  return null;
}

/**
 * ⚠️⚠️ `Title.sites` МАССИВЫГ ЦЭВЭРЛЭНЭ — админаас ирсэн утга.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ: `sites` нь кино ХАРАГДАХ эсэхийг шийддэг.
 * Буруу утга орвол кино ХОЁУЛАНГААС нь алга болж, админ «яагаад
 * гарахгүй байна» гэж эрэлхийлнэ — DB-д мөр байгаа тул устсан ч
 * биш, олдохгүй ч байна.
 *
 * Хамгаалалт:
 *   · танихгүй нэрийг хаяна («besttv2», «BestTV» гэх мэт)
 *   · давхардлыг арилгана
 *   · ХООСОН массив бол `null` буцаана — дуудагч тал өөрийн
 *     анхдагчийг (шинэ кинонд `currentSite()`) хэрэглэнэ.
 *     Хоосон `[]` хадгалбал кино ХААНА Ч харагдахгүй болно.
 *
 * @returns цэвэрлэсэн массив, эсвэл `null` (утга өгөөгүй/бүгд буруу)
 */
export function normalizeSites(value: unknown): Site[] | null {
  if (!Array.isArray(value)) return null;
  const clean = [...new Set(value.filter(isSite))];
  return clean.length ? clean : null;
}
