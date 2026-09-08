# BestFilm — Тохиргооны заавар

⚠️ **Код бэлэн, deploy ХИЙГЭЭГҮЙ.** Энэ баримт нь таны хийх ажил.

---

## 1. Cloudflare — DNS

`bestfilm.net` домэйныг Cloudflare-т нэмсэн байх ёстой.

**DNS → Records** дээр 3 бичлэг:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | `62.238.47.2` | 🟠 Proxied |
| A | `www` | `62.238.47.2` | 🟠 Proxied |
| A | `api` | `62.238.47.2` | 🟠 Proxied |

⚠️ **Proxy заавал АСААЛТТАЙ** (улбар шар үүл). Унтраавал:
- Жинхэнэ сервер IP ил гарна (DDoS эрсдэл)
- `CF-Connecting-IP` толгой ирэхгүй → nginx-ийн rate limit бүх
  хэрэглэгчийг нэг IP гэж үзэж, нэг бот бүгдийг блоклоно

---

## 2. Cloudflare — SSL/TLS

### 2.1 Горим

**SSL/TLS → Overview → Full (strict)**

⚠️ `Flexible` БОЛОХГҮЙ — Cloudflare↔сервер хооронд шифрлэлтгүй болно.
⚠️ `Full` (strict-гүй) нь өөрөө гарын үсэг зурсан сертификат
зөвшөөрдөг тул MITM-ээс хамгаалахгүй.

### 2.2 Origin сертификат үүсгэх

**SSL/TLS → Origin Server → Create Certificate**

- Private key type: **RSA (2048)**
- Hostnames: `bestfilm.net`, `*.bestfilm.net`
- Certificate Validity: **15 years**

Гарч ирэх ХОЁР текстийг хадгална:

```
Origin Certificate  →  bestfilm.pem
Private Key         →  bestfilm.key
```

⚠️ **Private Key нь ГАНЦ УДАА харагдана** — цонх хаахаас өмнө хуулна.

### 2.3 VPS руу байршуулах

```bash
# Локал дээр файл үүсгээд (эсвэл шууд nano-оор VPS дээр)
scp bestfilm.pem bestfilm.key root@62.238.47.2:/tmp/

ssh root@62.238.47.2
mkdir -p /etc/ssl/cloudflare
mv /tmp/bestfilm.pem /etc/ssl/cloudflare/
mv /tmp/bestfilm.key /etc/ssl/cloudflare/
chmod 600 /etc/ssl/cloudflare/bestfilm.key
chmod 644 /etc/ssl/cloudflare/bestfilm.pem

# ⚠️ nginx container-д mount хийгдсэн эсэхийг шалгана
docker exec docker-nginx-1 ls -la /etc/ssl/cloudflare/
```

⚠️ Хэрэв container дотор харагдахгүй бол `docker-compose.yml`-д
`/etc/ssl/cloudflare:/etc/ssl/cloudflare:ro` volume нэмэх шаардлагатай
(BestTV-д аль хэдийн бий тул магадгүй шаардлагагүй).

### 2.4 Always Use HTTPS

**SSL/TLS → Edge Certificates → Always Use HTTPS: ON**

---

## 3. Cloudflare — R2 (кино файл)

⚠️⚠️ **ШИНЭ BUCKET ҮҮСГЭХГҮЙ.** Кино нь ХУВААЛЦСАН — BestTV-ийн
одоогийн bucket (`assets.besttv.us`) хэвээр ашиглана.

**ЯАГААД:**
- 257 кино давхардвал R2 зай 2 дахин, төлбөр 2 дахин
- Кино нэмэхэд 2 удаа upload хийх шаардлагатай болно
- `Title.sites[]` нь аль сайтад харагдахыг хянана

`bestfilm/frontend/.env.production`-д:
```
NEXT_PUBLIC_ASSETS_URL=https://assets.besttv.us
```

⚠️ Хэрэв ирээдүйд `assets.bestfilm.net` гэсэн тусдаа домэйн
хүсвэл — R2 bucket дээр **хоёр дахь custom domain** нэмнэ
(файл давхардахгүй, зөвхөн өөр хаягаар хандана):

**R2 → besttv bucket → Settings → Custom Domains → Add**
→ `assets.bestfilm.net`

---

## 4. Cloudflare — Хурд, аюулгүй байдал

| Хэсэг | Тохиргоо | Яагаад |
|---|---|---|
| **Speed → Optimization** | Brotli: ON | HTML 812KB → 40KB |
| **Caching → Configuration** | Browser TTL: Respect Existing Headers | nginx-ийн `Cache-Control` хүчинтэй болно |
| **Security → Bots** | Bot Fight Mode: ON | ⚠️ Super Bot Fight Mode БИШ (төлбөртэй) |
| **Security → WAF** | Managed Rules: ON | |
| **Rules → Page Rules** | — | Одоохондоо хэрэггүй |

⚠️ **Rocket Loader БҮҮ АСАА** — Next.js-ийн hydration эвдэрнэ.
⚠️ **Auto Minify** нь хуучирсан (Cloudflare өөрөө хассан).

---

## 5. Google OAuth

**console.cloud.google.com → APIs & Services → Credentials**

### Сонголт A — Шинэ OAuth client (санал болгож байна)

1. **Create Credentials → OAuth client ID → Web application**
2. Name: `BestFilm`
3. Authorized JavaScript origins:
   - `https://bestfilm.net`
4. Authorized redirect URIs:
   - `https://bestfilm.net/api/auth/callback/google`
5. Client ID + Secret-ыг `.env.production`-д бичнэ

### Сонголт B — Байгаа client дээр нэмэх (хялбар)

BestTV-ийн OAuth client дээр redirect URI-г НЭМНЭ:
- `https://bestfilm.net/api/auth/callback/google`

⚠️ Хоёр сайт нэг апп-ын хязгаарыг хуваалцана. OAuth consent
дэлгэц дээр «BestTV» гэж харагдана — хэрэглэгч эргэлзэж болзошгүй.

---

## 6. Facebook OAuth

**developers.facebook.com → Apps**

### Сонголт A — Шинэ апп

1. **Create App → Consumer → Facebook Login**
2. Settings → Basic:
   - App Domains: `bestfilm.net`
   - Privacy Policy URL: `https://bestfilm.net/p/privacy`
   - Terms of Service URL: `https://bestfilm.net/p/terms`
3. Facebook Login → Settings:
   - Valid OAuth Redirect URIs:
     `https://bestfilm.net/api/auth/callback/facebook`
4. App ID + Secret-ыг `.env.production`-д

### Сонголт B — Байгаа апп дээр нэмэх

BestTV-ийн апп дээр redirect URI нэмнэ.

⚠️ **App Review**: шинэ апп нь `email`, `public_profile`
зөвшөөрлийг автоматаар авдаг — нэмэлт review хэрэггүй.

---

## 7. QPay merchant (ӨӨР данс)

Таны шийдвэрээр BestFilm нь **тусдаа merchant** ашиглана.

### 7.1 QPay-ээс авах

merchant.qpay.mn дээр шинэ merchant бүртгүүлж:
- `username`
- `password`
- `invoice_code`

### 7.2 `besttv/backend/.env.production`-д НЭМНЭ

```bash
# ⚠️ BestTV-ийнх ХЭВЭЭР — хөндөхгүй
QPAY_USERNAME=...
QPAY_PASSWORD=...
QPAY_INVOICE_CODE=DIGITAL_GER_INVOICE
QPAY_CALLBACK_URL=https://api.besttv.us/api/payments/qpay/callback
QPAY_WEBHOOK_SECRET=...

# ⚠️⚠️ BestFilm — ШИНЭ (BESTFILM_ угтвартай)
BESTFILM_QPAY_USERNAME=
BESTFILM_QPAY_PASSWORD=
BESTFILM_QPAY_INVOICE_CODE=
BESTFILM_QPAY_CALLBACK_URL=https://api.bestfilm.net/api/payments/qpay/callback
BESTFILM_QPAY_WEBHOOK_SECRET=
```

⚠️⚠️ **Callback URL нь `api.bestfilm.net` руу** — QPay нь webhook-д
`X-Site` толgoй илгээдэггүй тул backend нь төлбөрийн бичлэгээс
сайтыг олно. Гэхдээ nginx нь `api.bestfilm.net`-д
`X-Site: bestfilm` тавьдаг тул давхар хамгаалалт болно.

⚠️ Тохируулаагүй бол BestFilm дээр QPay товч харагдахгүй
(`isQpayConfigured()` false буцаана) — сайт унахгүй.

---

## 8. BestFilm-ийн frontend env

`bestfilm/frontend/.env.production` бөглөх:

```bash
NEXTAUTH_SECRET=<санамсаргүй 32+ тэмдэгт>
GOOGLE_CLIENT_ID=<5-р алхмаас>
GOOGLE_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=<6-р алхмаас>
FACEBOOK_CLIENT_SECRET=

# ⚠️⚠️ BestTV-ийн backend/.env.production-оос ЯГ ХУУЛНА (нэг backend)
OAUTH_SHARED_SECRET=<besttv-ийнхтэй ИЖИЛ>
```

`NEXTAUTH_SECRET` үүсгэх:
```bash
openssl rand -base64 32
```

---

## 9. Deploy (миний хийх ажил — ТАНЫ зөвшөөрлөөр)

### 9.1 Migration (⚠️ УБ 04:00–06:00)

```bash
# Нөөц
docker exec besttv-postgres pg_dump -U besttv -d besttv | gzip -9 \
  > /opt/backups/besttv-BEFORE-SITE-$(date +%Y%m%d-%H%M).sql.gz

# 1. Багана (208мс)
docker exec -i besttv-postgres psql -U besttv -d besttv \
  -v ON_ERROR_STOP=1 -f /tmp/1_columns.sql

# 2. Индекс (1сек) — ⚠️ транзакцаас ГАДНА
docker exec -i besttv-postgres psql -U besttv -d besttv -f /tmp/2_indexes.sql

# 3. ЗААВАЛ шалгах — хоосон байх ЁСТОЙ
docker exec besttv-postgres psql -U besttv -d besttv \
  -c "select indexrelid::regclass from pg_index where not indisvalid;"
```

### 9.2 Backend deploy

```bash
docker compose -f docker/docker-compose.prod.yml -p besttv \
  up -d --build backend worker admin
```

### 9.3 Сайт шалгах (ГАРААР)

- besttv.us нээгдэх үү
- нэвтрэх ажиллах уу
- кино тоглох уу
- төлбөрийн хуудас

### 9.4 Хуучин unique хаях

```bash
docker exec -i besttv-postgres psql -U besttv -d besttv -f /tmp/3_drop_old.sql
```

### 9.5 BestFilm frontend

```bash
docker compose -f bestfilm/docker/docker-compose.prod.yml -p bestfilm \
  up -d --build
scp bestfilm/nginx/bestfilm.conf \
  root@62.238.47.2:/opt/DigitalGer/docker/nginx/conf.d/
docker exec docker-nginx-1 nginx -t && docker restart docker-nginx-1
```

---

## 10. Дараа нь хийх (сонголт)

- **n8n чат workflow** — BestFilm-ийн FB/IG хуудас нэмэх
  (`/chat/ingest` нь `site` талбар хүлээж авдаг болсон)
- **Жанрын эрэмбэ** — сайт бүрд өөр (таны хүсэлт)
- **Имэйлийн лого** — R2-д `brand/bestfilm-logo.png` байршуулах
- **Telegram** — n8n дээр `{{$json.site}}`-аар ялгаж өөр чат руу
