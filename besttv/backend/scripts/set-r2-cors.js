/**
 * R2 bucket-д CORS дүрэм тавина.
 *
 * ⚠️⚠️ ЯАГААД ЗААВАЛ ХЭРЭГТЭЙ ВЭ:
 * Видеог browser-оос ШУУД R2 руу presigned PUT-аар илгээдэг (backend-ээр
 * дамжуулбал том файлд Node socket унана). Browser өөр origin руу PUT хийхийн
 * өмнө OPTIONS preflight илгээнэ. Bucket дээр CORS байхгүй бол R2
 * `Access-Control-Allow-Origin` буцаахгүй → browser хүсэлтийг блоклоно →
 * "net::ERR_FAILED" + видео upload ОГТ болохгүй.
 *
 * Ажиллуулах:
 *   node scripts/set-r2-cors.js          # тавина
 *   node scripts/set-r2-cors.js --show   # одоогийн тохиргоог харна
 *
 * Env: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 */
const {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// .env.production → .env дарааллаар уншина (dotenv байхгүй байж болзошгүй)
for (const f of ['.env.production', '.env']) {
  const p = path.resolve(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;

if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error('❌ R2_* env дутуу байна (ENDPOINT / ACCESS_KEY_ID / SECRET / BUCKET_NAME)');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

/**
 * ⚠️ AllowedOrigins-д ЗӨВХӨН өөрсдийн домэйн — "*" тавибал хэн ч presigned
 * URL-ийг browser-оос ашиглах боломжтой болно. Локал хөгжүүлэлтийн порт
 * (3101 admin, 3100 frontend) багтаана — хөгжүүлэгч тест хийхэд хэрэгтэй.
 */
const CORS = {
  Bucket: R2_BUCKET_NAME,
  CORSConfiguration: {
    CORSRules: [
      {
        AllowedOrigins: [
          'https://admin.besttv.us',
          'https://besttv.us',
          'https://www.besttv.us',
          'http://localhost:3101',
          'http://localhost:3100',
        ],
        AllowedMethods: ['PUT', 'GET', 'HEAD'],
        // presigned PUT-д browser эдгээрийг илгээж болно
        AllowedHeaders: ['*'],
        // upload дууссаныг баталгаажуулахад ETag хэрэгтэй
        ExposeHeaders: ['ETag', 'Content-Length'],
        // preflight-ийг 1 цаг кэшлэнэ (анги бүрт дахин OPTIONS явуулахгүй)
        MaxAgeSeconds: 3600,
      },
    ],
  },
};

(async () => {
  if (process.argv.includes('--show')) {
    try {
      const cur = await client.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET_NAME }));
      console.log(JSON.stringify(cur.CORSRules, null, 2));
    } catch (e) {
      console.log(`CORS тохируулаагүй байна (${e.name})`);
    }
    return;
  }

  await client.send(new PutBucketCorsCommand(CORS));
  console.log(`✅ CORS тавигдлаа — bucket: ${R2_BUCKET_NAME}`);

  const check = await client.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET_NAME }));
  console.log(JSON.stringify(check.CORSRules, null, 2));
})().catch((e) => {
  console.error('❌ Алдаа:', e.name, e.message);
  process.exit(1);
});
