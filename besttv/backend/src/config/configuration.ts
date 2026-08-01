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
  jwt: {
    secret: jwtSecret,
    refreshSecret: jwtRefreshSecret,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
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
  tmdb: {
    apiKey: process.env.TMDB_API_KEY ?? null,
  },
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3100',
  adminUrl: process.env.ADMIN_URL ?? 'http://localhost:3101',
  // R2 тохируулаагүй үед локал дискний файлыг энэ хаягаар serve хийнэ
  // (/media/* static route). Production-д VPS-ийн бодит домэйн/IP тавина.
  backendUrl: process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? '4100'}`,
});
