# BestTV — үйл ажиллагааны скриптүүд

VPS (`62.238.47.2`) дээр ажилладаг скриптүүдийн ЭХ ХУВИЛБАР.

> ⚠️⚠️ Эдгээр нь зөвхөн VPS дээр байвал сервер дахин суулгахад **алга
> болно**. Тиймээс git-д хадгална. VPS дээрх хувилбарыг өөрчилвөл
> ЭНД БУЦААЖ хуулна.

## Файлууд

| Файл | VPS дэх зам | Ажиллах |
|---|---|---|
| `besttv-backup.sh` | `/opt/besttv-backup.sh` | cron `0 3,15 * * *` |
| `r2-backup-upload.js` | `/opt/r2-backup-upload.js` → backend container | нөөцлөх скриптээс |

## Өгөгдлийн сангийн нөөцлөлт

**Яагаад чухал вэ:** DB-д хэрэглэгч, төлбөр, захиалга, эзэмшлийн БҮХ
бүртгэл байна. Postgres эвдрэх / диск гэмтэхэд R2-д видео үлдэнэ ч
**хэн юу худалдаж авсныг мэдэх арга байхгүй** болно.

**Хоёр газар хадгална:**

- **Локал** `/opt/backups/db` — 14 хоног (хурдан сэргээлт)
- **R2** `backups/db/` — 30 ширхэг (диск гэмтсэн ч үлдэнэ)

DB нь ~13 MB, шахсаны дараа ~300 KB. 30 нөөц = ~9 MB.

### Суулгах

```bash
scp ops/besttv-backup.sh root@62.238.47.2:/opt/besttv-backup.sh
scp ops/r2-backup-upload.js root@62.238.47.2:/opt/r2-backup-upload.js
ssh root@62.238.47.2 'chmod +x /opt/besttv-backup.sh && \
  docker cp /opt/r2-backup-upload.js besttv-backend:/app/backend/r2-backup-upload.js'
```

> ⚠️ `r2-backup-upload.js` нь backend container ДОТОР ажиллана — AWS SDK
> болон R2 credential тэнд байдаг. Container дахин үүсгэх бүрд
> `docker cp` ДАХИН хийнэ (эс бөгөөс R2 хуулбар чимээгүй алгасагдана —
> локал нөөц үргэлжилнэ, лог дээр `R2 WARN` гарна).

### Cron

```
0 3,15 * * * /opt/besttv-backup.sh          # DB нөөц өдөрт 2 удаа
0 4    * * * /usr/bin/docker builder prune -af   # build cache
```

### Сэргээх

```bash
# 1. Хамгийн сүүлийн нөөцийг олох
ssh root@62.238.47.2 'ls -t /opt/backups/db/*.sql.gz | head -1'

# 2. ⚠️ ЭХЛЭЭД тусдаа DB дээр ТУРШИНА (production хөндөхгүй)
ssh root@62.238.47.2 'docker exec besttv-postgres psql -U besttv -d postgres \
  -c "CREATE DATABASE restoretest"'
ssh root@62.238.47.2 'zcat /opt/backups/db/<файл>.sql.gz | \
  docker exec -i besttv-postgres psql -U besttv -d restoretest'

# 3. Мөрийн тоо харьцуулж баталгаажуулна
ssh root@62.238.47.2 'docker exec besttv-postgres psql -U besttv -d restoretest \
  -t -c "select count(*) from \"User\""'

# 4. Зөв бол production руу (⚠️ БУЦААХГҮЙ үйлдэл)
ssh root@62.238.47.2 'zcat /opt/backups/db/<файл>.sql.gz | \
  docker exec -i besttv-postgres psql -U besttv -d besttv'
```

`--clean --if-exists` тул сэргээхэд хуучин объект зөрчилдөхгүй.

### R2 дээрх нөөцийг татах

Локал диск гэмтсэн үед:

```bash
docker exec -w /app/backend besttv-backend node -e '
const {S3Client,ListObjectsV2Command}=require("@aws-sdk/client-s3");
const s3=new S3Client({region:"auto",endpoint:process.env.R2_ENDPOINT,
  credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,
  secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
s3.send(new ListObjectsV2Command({Bucket:process.env.R2_BUCKET_NAME,
  Prefix:"backups/db/"})).then(r=>r.Contents.forEach(o=>console.log(o.Key)));'
```

## Лог шалгах

```bash
ssh root@62.238.47.2 'tail -20 /opt/backups/db/backup.log'
```

- `OK:` — локал нөөц амжилттай
- `R2 OK:` — гадна хуулбар амжилттай
- `R2 WARN:` — R2 унасан, **локал нөөц бий** (script амжилтгүй гэж үзэхгүй)
- `FAIL:` — нөөц ОГТ үүсээгүй ⚠️ шалгах шаардлагатай

## Docker лог хязгаар

`/etc/docker/daemon.json`:

```json
{ "log-driver": "json-file", "log-opts": { "max-size": "50m", "max-file": "3" } }
```

> ⚠️ Өмнө нь хязгааргүй байсан тул нэг container 9.9 GB лог хуримтлуулж
> диск дүүргэсэн. Тохиргоо нь **daemon restart-д** үйлчилнэ.
