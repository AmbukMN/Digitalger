const DEV_JWT_SECRET = 'dev-besttv-jwt-secret-change-me';
const DEV_REFRESH_SECRET = 'dev-besttv-refresh-secret-change-me';

// ⚠️ Production-д dev-default JWT secret илэрвэл асах үед зогсооно
// (нийтэд мэдэгдсэн secret-ээр хуурамч токен үүсгэхээс сэргийлнэ).
const jwtSecret = process.env.JWT_SECRET ?? DEV_JWT_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET ?? DEV_REFRESH_SECRET;
if (process.env.NODE_ENV === 'production') {
  if (jwtSecret === DEV_JWT_SECRET || jwtRefreshSecret === DEV_REFRESH_SECRET) {
    throw new Error(
      '🔴 АЮУЛГҮЙ БАЙДАЛ: Production-д JWT_SECRET / JWT_REFRESH_SECRET тохируулаагүй байна.',
    );
  }
}

export default () => ({
  port: parseInt(process.env.PORT ?? '4100', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin:
    process.env.CORS_ORIGIN?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? ['http://localhost:3100', 'http://localhost:3101'],
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',

  /**
   * n8n → Telegram мэдэгдэл.
   *
   * ⚠️ `digitalger-n8n` нь ӨӨР docker сүлжээнд ажилладаг тул compose-д
   * `n8n_net` (external: digitalger-n8n-network) нэмсэн. Контейнерийн
   * нэрээр хандана: `http://digitalger-n8n:5678`
   *
   * ⚠️ Гадаад IP (62.238.47.2:5678) БҮҮ хэрэглэ — тэр порт интернэтэд
   * нээлттэй тул хэн ч хуурамч webhook дуудна.
   *
   * ⚠️ Тохируулаагүй бол мэдэгдэл чимээгүй унтарна (алдаа шидэхгүй) —
   * мэдэгдэл нь НЭМЭЛТ, төлбөр/захиалга зогсоохгүй.
   */
  n8n: {
    webhookUrl: process.env.N8N_WEBHOOK_URL ?? null,
    webhookSecret: process.env.N8N_WEBHOOK_SECRET ?? null,
  },
  jwt: {
    secret: jwtSecret,
    refreshSecret: jwtRefreshSecret,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },
  auth: {
    /**
     * ⚠️⚠️ `/auth/oauth`-ийг хамгаалах СЕРВЕР ХООРОНДЫН нууц.
     *
     * Тэр endpoint нь имэйлээр хэрэглэгч олоод ТҮҮНИЙ токеныг буцаадаг
     * тул баталгаажуулалтгүй бол ХЭН Ч admin@besttv.mn гэж бичээд ADMIN
     * эрх авна (production дээр бодитоор тестлэж баталсан цоорхой).
     *
     * ⚠️ Frontend-ийн `NEXTAUTH_OAUTH_SECRET`-тэй ЯГ ИЖИЛ байх ёстой.
     * ⚠️ Тохируулаагүй бол OAuth нэвтрэлт АЖИЛЛАХГҮЙ — задгай үлдээхээс
     *    унасан нь дээр (`auth.service.ts:oauthLogin`-ыг харна уу).
     */
    oauthSharedSecret: process.env.OAUTH_SHARED_SECRET ?? null,
  },
  // R2 storage.
  //
  // ⚠️ ХОЁР ГОРИМ:
  //   1) publicUrl ТОХИРУУЛААГҮЙ (default) — private bucket, БҮХ хандалт
  //      presigned URL-ээр. Хамгийн аюулгүй.
  //   2) publicUrl ТОХИРУУЛСАН — зураг/постер зэрэг НИЙТИЙН asset-ыг тухайн
  //      CDN домэйнээс шууд уншина (presign-гүй → CDN кэштэй, хурдан).
  //      ⚠️ ВИДЕО (HLS m3u8/segment) нь ЭРХ шаарддаг тул ЭНЭ ҮЕД Ч presign-ээр
  //      явна — publicUrl нь видеонд ХЭРЭГЛЭГДЭХГҮЙ (stream module шийднэ).
  /**
   * verify.mn — утас баталгаажуулалт (MO SMS).
   * ⚠️ BestTV-ийн ТУСДАА API түлхүүр (DigitalGer-ийнхээс өөр).
   */
  verifyMn: {
    apiKey: process.env.VERIFY_MN_API_KEY ?? null,
    baseUrl: process.env.VERIFY_MN_BASE_URL ?? 'https://api.verify.mn',
    shortcode: process.env.VERIFY_MN_SHORTCODE ?? '144773',
    /* ⚠️ Хоосон бол зөвхөн polling ажиллана — тэр нь ч хангалттай */
    callbackUrl: process.env.VERIFY_MN_CALLBACK_URL ?? null,
  },

  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME ?? 'besttv',
    endpoint: process.env.R2_ENDPOINT,
    /** Нийтийн asset CDN домэйн, ж: https://assets.besttv.us (сүүлийн / хэрэггүй) */
    publicUrl: process.env.R2_PUBLIC_URL,
  },
  qpay: {
    username: process.env.QPAY_USERNAME,
    password: process.env.QPAY_PASSWORD,
    invoiceCode: process.env.QPAY_INVOICE_CODE,
    callbackUrl: process.env.QPAY_CALLBACK_URL,
    webhookSecret: process.env.QPAY_WEBHOOK_SECRET,
  },
  /**
   * Bonum Gateway — карт (VISA/Master/UnionPay/Amex), Apple Pay,
   * Google Pay, WeChat Pay. Hosted checkout (redirect) загвартай.
   *
   * ⚠️⚠️ Credential нь DIGITALGER merchant дээр бүртгэлтэй (Terminal
   * 17173069) — invoice/callback/item-д брэнд нэр ОГТ явуулахгүй
   * (QPay-ийн ижил зарчим, дээрх qpay тайлбарыг үз).
   *
   * ⚠️ Callback нь x-checksum-v2 = HMAC-SHA256(rawBody, checksumKey).
   */
  bonum: {
    baseUrl: process.env.BONUM_BASE_URL ?? 'https://apis.bonum.mn',
    appSecret: process.env.BONUM_APP_SECRET,
    terminalId: process.env.BONUM_TERMINAL_ID,
    checksumKey: process.env.BONUM_CHECKSUM_KEY,
    callbackUrl: process.env.BONUM_CALLBACK_URL,
    /**
     * Карт хадгалсны дараа хэрэглэгчийг БУЦААХ хаяг.
     * ⚠️ Webhook-оос ТУСДАА: webhook нь server-to-server (токен ирнэ),
     *    энэ нь browser redirect. Тохируулаагүй бол `callbackUrl` руу
     *    унах ба тэнд GET handler хэрэглэгчийг сайт руу буцаана.
     */
    cardCallbackUrl: process.env.BONUM_CARD_CALLBACK_URL,
  },
  tmdb: {
    apiKey: process.env.TMDB_API_KEY ?? null,
  },
  /**
   * AI орчуулга — TMDB-ээс ирсэн АНГЛИ тайлбар/дүрийн нэрийг монгол руу.
   *
   * ⚠️ Машин орчуулга биш — LLM-ээр УТГАЧИЛЖ орчуулна (киноны тайлбар нь
   * зүйрлэл ихтэй тул шууд орчуулга эвгүй гардаг).
   *
   * ⚠️ Түлхүүр БАЙХГҮЙ бол орчуулга АЛГАСНА (алдаа биш) — англи эх
   * хувилбар нь `descriptionEn`-д хадгалагдсан хэвээр үлдэнэ.
   */
  ai: {
    /** OpenAI эсвэл Anthropic — аль нь тохируулагдсан түүнийг хэрэглэнэ */
    openaiKey: process.env.OPENAI_API_KEY ?? null,
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? null,
    /** ⚠️ Загварыг hardcode хийхгүй — үнэ/чанар өөрчлөгдвөл .env-ээс солино */
    openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
  },
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3100',
  adminUrl: process.env.ADMIN_URL ?? 'http://localhost:3101',
  // R2 тохируулаагүй үед локал дискний файлыг энэ хаягаар serve хийнэ
  // (/media/* static route). Production-д VPS-ийн бодит домэйн/IP тавина.
  backendUrl: process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? '4100'}`,
});
