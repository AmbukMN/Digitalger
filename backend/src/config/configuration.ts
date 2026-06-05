export default () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin:
    process.env.CORS_ORIGIN?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? ['http://localhost:3000'],
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  // Backend-ийн нийтийн URL (FB/IG "go" татах redirect линкэд ашиглана)
  apiPublicUrl: process.env.API_PUBLIC_URL ?? 'https://api.digitalger.mn',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
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
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
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
