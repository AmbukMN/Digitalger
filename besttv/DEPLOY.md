# BestTV — Production deploy (besttv.us)

## Одоогийн байдал

| Зүйл | Утга |
|---|---|
| VPS | `62.238.47.2` (DigitalGer-тэй хамт) |
| Зам | `/opt/BestTV` |
| SSH | `ssh -i ~/.ssh/id_ed25519 root@62.238.47.2` |
| Compose | `docker/docker-compose.prod.yml`, project `besttv` |
| Nginx | DigitalGer-ийн `docker-nginx-1` (BestTV тусдаа nginx БАЙХГҮЙ) |
| SSL | Cloudflare Origin: `/etc/ssl/cloudflare/besttv.pem` + `.key` |
| Домэйн | besttv.us · www · admin.besttv.us · api.besttv.us |

### Container-ууд
`besttv-postgres` `besttv-redis` `besttv-backend` `besttv-worker` `besttv-frontend` `besttv-admin`

---

## ⚠️ Хамгийн чухал дүрмүүд

1. **ЗААВАЛ `-p besttv`** — DigitalGer ч мөн `docker/` хавтастай тул project name
   автоматаар "docker" болж **нөгөө стекийн container-ыг устгадаг**.
   ```bash
   docker compose -f docker/docker-compose.prod.yml -p besttv <команд>
   ```
2. **LOCAL-FIRST** — эхлээд local дээр зас → тест → дараа VPS руу. VPS дээр
   ШУУД бүү зас (дараагийн deploy-д алга болно).
3. **Worker rebuild** — queue/processor код өөрчлөгдвөл `besttv-worker`-ыг
   ЗААВАЛ дахин build (backend rebuild хангалтгүй).
4. Nginx conf засвал `/opt/DigitalGer/docker/nginx/conf.d/besttv.conf` руу хуулж
   `docker exec docker-nginx-1 nginx -t` → `nginx -s reload`.

---

## Deploy (кодын өөрчлөлт гаргах)

Local дээрээс:

```bash
cd besttv

# 1. Багц (node_modules/.next/dist хасна)
tar --exclude='node_modules' --exclude='.next' --exclude='dist' --exclude='.git' \
    --exclude='*.log' --exclude='./backend/storage' --exclude='origin_ssl' \
    --exclude='./docker/.env' --exclude='*/.env.production'     --exclude='*/.env.local' \
    -czf ../besttv-deploy.tar.gz .

# 2. Хуулах
scp -i ~/.ssh/id_ed25519 ../besttv-deploy.tar.gz root@62.238.47.2:/tmp/
ssh -i ~/.ssh/id_ed25519 root@62.238.47.2 \
  "tar -xzf /tmp/besttv-deploy.tar.gz -C /opt/BestTV && rm /tmp/besttv-deploy.tar.gz"

# 3. Build + асаах
ssh -i ~/.ssh/id_ed25519 root@62.238.47.2 \
  "cd /opt/BestTV && docker compose -f docker/docker-compose.prod.yml -p besttv up -d --build"
```

⚠️ **`docker/.env` болон `.env.production` файлууд архиваас ХАСАГДСАН** —
VPS дээрх нууц утгуудыг дарахгүй. Шинэ хувьсагч нэмэх бол VPS дээр гараар
нэмээд `--build`-тэй дахин ажиллуулна.

⚠️⚠️⚠️ **`.env.local` ХЭЗЭЭ Ч VPS руу бүү явуул.** Next.js-д `.env.local` нь
`.env.production`-оос **ДАВУУ эрхтэй** тул явбал `localhost:4100` гэх мэт локал
утга production build-д шигдэж, зураг upload/API дуудлага эвдэрнэ.
(`.dockerignore` + tar `--exclude` хоёулаа хамгаална.)

⚠️⚠️ `NEXT_PUBLIC_*` нь **build үед** код руу шигдэнэ (restart хангалтгүй).
Жишээ алдаа: `NEXT_PUBLIC_ASSETS_URL` хоосон build хийгдвэл next/image
**бүх зурганд 400** буцааж, сайт зурааргүй харагдана.

Migration нь backend container асахад **автоматаар** хэрэгжинэ
(`npx prisma migrate deploy`).

---

## Cloudflare тохиргоо

### DNS (аль хэдийн хийгдсэн)
| Нэр | Төрөл | Утга | Proxy |
|---|---|---|---|
| besttv.us | A | 62.238.47.2 | ✅ |
| www | A/CNAME | 62.238.47.2 | ✅ |
| admin | A | 62.238.47.2 | ✅ |
| api | A | 62.238.47.2 | ✅ |

### SSL/TLS горим
**Full (strict)** сонгоно — origin дээр Cloudflare Origin сертификат байгаа.

### Assets CDN (ЗУРАГ — та хийнэ)
1. R2 bucket → **Settings → Public access → Connect Domain**
2. `assets.besttv.us` холбоно (DNS автоматаар CNAME үүснэ)
3. Дараа нь **3 газарт ижил утга** оруулна:
   - `/opt/BestTV/backend/.env.production` → `R2_PUBLIC_URL=https://assets.besttv.us`
   - `/opt/BestTV/frontend/.env.production` → `NEXT_PUBLIC_ASSETS_URL=https://assets.besttv.us`
   - `/opt/BestTV/docker/.env` → `NEXT_PUBLIC_ASSETS_URL=https://assets.besttv.us`
4. **Rebuild ЗААВАЛ** (NEXT_PUBLIC_* нь build үед код руу шигддэг):
   ```bash
   cd /opt/BestTV && docker compose -f docker/docker-compose.prod.yml -p besttv up -d --build frontend admin backend
   ```

Хоосон үлдээвэл зураг presigned URL-ээр явна — ажиллана, гэхдээ CDN кэшгүй.

⚠️ **Видео (HLS)** нь эрхийн шалгалттай тул `R2_PUBLIC_URL` тохируулсан ч
presigned URL-ээр л явна — энэ зориуд.

---

## OAuth redirect URI

### Facebook (developers.facebook.com)
**Facebook Login → Settings → Valid OAuth Redirect URIs:**
```
https://besttv.us/api/auth/callback/facebook
https://www.besttv.us/api/auth/callback/facebook
```
**Settings → Basic:** App Domains = `besttv.us`, Site URL = `https://besttv.us`

Дараа нь `frontend/.env.production`-д `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`
оруулаад frontend-ыг rebuild. (Одоогоор хоосон тул FB товч харагдахгүй — код зөв,
утга орсны дараа автоматаар гарна.)

### Google (console.cloud.google.com)
```
https://besttv.us/api/auth/callback/google
https://www.besttv.us/api/auth/callback/google
```

---

## Түгээмэл үйлдэл

```bash
S="ssh -i ~/.ssh/id_ed25519 root@62.238.47.2"

# Төлөв
$S "docker ps --filter name=besttv --format '{{.Names}}\t{{.Status}}'"

# Лог
$S "docker logs -f besttv-backend"
$S "docker logs -f besttv-worker"

# Дахин асаах
$S "cd /opt/BestTV && docker compose -f docker/docker-compose.prod.yml -p besttv restart backend"

# Seed (анх удаа эсвэл шинэ багц/жанр нэмэхэд)
$S "docker exec besttv-backend sh -c 'cd /app/backend && npx prisma db seed'"

# DB руу орох
$S "docker exec -it besttv-postgres psql -U besttv -d besttv"

# 502 гарвал
$S "docker restart docker-nginx-1"
```

---

## Админ

https://admin.besttv.us — `admin@besttv.mn` / `Admin@12345`

⚠️ **Production-д нууц үгээ ЗААВАЛ солино уу.**
