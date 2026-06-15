const DEV_JWT_SECRET = 'dev-jwt-secret-change-me';
const DEV_REFRESH_SECRET = 'dev-refresh-secret-change-me';

// ⚠️ НУУЦЛАЛЫН FAIL-FAST: production-д JWT secret тохируулаагүй бол default
// (нийтэд мэдэгдсэн) secret-ээр токен гарын үсэг зурвал хэн ч хуурамч токен
// үүсгэж нэвтрэх боломжтой болно. Тиймээс production-д dev-default илэрвэл
// backend-ийг АСАХ ҮЕД ЗОГСООНО (чимээгүй эмзэг болохоос сэргийлнэ).
const jwtSecret = process.env.JWT_SECRET ?? DEV_JWT_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET ?? DEV_REFRESH_SECRET;
if (process.env.NODE_ENV === 'production') {
  if (jwtSecret === DEV_JWT_SECRET || jwtRefreshSecret === DEV_REFRESH_SECRET) {
    throw new Error(
      '🔴 АЮУЛГҮЙ БАЙДАЛ: Production-д JWT_SECRET / JWT_REFRESH_SECRET тохируулаагүй байна. ' +
        '.env.production-д жинхэнэ нууц утга (32+ тэмдэгт) оруулна уу.',
    );
  }
}

export default () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin:
    process.env.CORS_ORIGIN?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? ['http://localhost:3000'],
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwt: {
    secret: jwtSecret,
    refreshSecret: jwtRefreshSecret,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME ?? process.env.R2_BUCKET ?? 'digitalger',
    publicUrl: process.env.R2_PUBLIC_URL,
    endpoint: process.env.R2_ENDPOINT,
  },
  // Cloudflare Stream — ЗӨВХӨН төлбөртэй хичээлийн (course lesson) видеонд.
  // R2-аас ТУСДАА систем. accountId нь R2-тэйгээ ижил байж болно.
  stream: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.R2_ACCOUNT_ID,
    token: process.env.CLOUDFLARE_STREAM_TOKEN,
  },
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  // Verify.mn — MO SMS утас баталгаажуулалт (хэрэглэгч 144773 руу код илгээнэ).
  verifyMn: {
    apiKey: process.env.VERIFY_MN_API_KEY ?? null,
    baseUrl: process.env.VERIFY_MN_BASE_URL ?? 'https://api.verify.mn',
    shortcode: process.env.VERIFY_MN_SHORTCODE ?? '144773',
    callbackUrl: process.env.VERIFY_MN_CALLBACK_URL ?? null,
  },
  qpay: {
    username: process.env.QPAY_USERNAME,
    password: process.env.QPAY_PASSWORD,
    invoiceCode: process.env.QPAY_INVOICE_CODE,
    callbackUrl: process.env.QPAY_CALLBACK_URL,
    webhookSecret: process.env.QPAY_WEBHOOK_SECRET,
  },
  n8n: {
    webhookUrl: process.env.N8N_WEBHOOK_URL ?? null,
    webhookSecret: process.env.N8N_WEBHOOK_SECRET ?? null,
  },
});
