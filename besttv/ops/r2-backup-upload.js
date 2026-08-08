/**
 * DB нөөцийг R2 руу хуулна — ГАДНА ХАДГАЛАЛТ.
 *
 * ⚠️⚠️ ЯАГААД: `/opt/backups` нь production DB-тэй ИЖИЛ диск дээр.
 * Диск гэмтэх / VPS устгагдахад ХОЁУЛАА алга болно. R2 нь өөр дэд
 * бүтэц тул хамт унахгүй.
 *
 * ⚠️ Backend container ДОТОР ажиллана (AWS SDK тэнд бий). Файлыг
 * `docker cp`-ээр /tmp руу хуулж өгнө.
 *
 * ⚠️ `backups/db/` угтвар — orphan цэвэрлэгээ видеоны key-г л хардаг
 * тул эдгээрийг андуурч устгахгүй.
 */
const fs = require('fs');
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = require('@aws-sdk/client-s3');

const FILE = process.argv[2];
const PREFIX = 'backups/db/';
/** R2-д хэдэн нөөц хадгалах (локалд 14 хоног, R2-д 30 ширхэг) */
const KEEP = 30;

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});
const Bucket = process.env.R2_BUCKET_NAME;

(async () => {
  const name = FILE.split('/').pop();
  const body = fs.readFileSync(FILE);

  await s3.send(
    new PutObjectCommand({
      Bucket,
      Key: PREFIX + name,
      Body: body,
      ContentType: 'application/gzip',
    }),
  );
  console.log(`R2 OK: ${name} (${(body.length / 1024).toFixed(0)} KB)`);

  /* ⚠️ Хуучныг цэвэрлэнэ — жилийн дараа мянган файл хуримтлагдаж
     Class B үйлдлийн төлбөр нэмэгдэхээс сэргийлнэ */
  const list = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: PREFIX }));
  const objs = (list.Contents ?? []).sort((a, b) => (a.Key > b.Key ? 1 : -1));
  const extra = objs.slice(0, Math.max(0, objs.length - KEEP));
  if (extra.length) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket,
        Delete: { Objects: extra.map((o) => ({ Key: o.Key })) },
      }),
    );
    console.log(`R2 цэвэрлэв: ${extra.length}`);
  }
  console.log(`R2 нийт: ${objs.length - extra.length}`);
})().catch((e) => {
  console.error('R2 FAIL: ' + e.message);
  process.exit(1);
});
