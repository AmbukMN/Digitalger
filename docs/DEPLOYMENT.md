# DigitalGer — Байршуулалтын гарын авлага

## Орчин

| Зүйл | Утга |
|------|------|
| VPS | Hetzner |
| OS | Ubuntu 24.04 LTS |
| Docker | Docker Engine + Compose v2 |
| SSL | Let's Encrypt (Certbot) |
| DNS | Cloudflare |
| Git | GitHub |

---

## VPS анхны тохируулга (нэг удаа)

```bash
# 1. Шинэчлэх
apt update && apt upgrade -y

# 2. Docker суулгах
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER

# 3. Project директори
mkdir -p /opt/DigitalGer
cd /opt/DigitalGer

# 4. Repo clone
git clone https://github.com/your-org/DigitalGer.git .

# 5. Production env
cp .env.production.example .env.production
nano .env.production        # Бодит утгуудыг оруулна
chmod 600 .env.production

# 6. Let's Encrypt SSL
apt install certbot -y
certbot certonly --standalone -d digitalger.mn -d www.digitalger.mn -d admin.digitalger.mn -d api.digitalger.mn

# 7. Backup директори
mkdir -p /opt/DigitalGer/backups
mkdir -p /opt/DigitalGer/logs
chmod +x docker/scripts/backup.sh docker/scripts/restore.sh

# 8. Cron backup тохируулах
crontab -e
# Нэмэх: 0 2 * * * /opt/DigitalGer/docker/scripts/backup.sh >> /opt/DigitalGer/logs/backup.log 2>&1
```

---

## Эхний deployment

```bash
cd /opt/DigitalGer

# Build + ажиллуулах
docker compose -f docker/docker-compose.prod.yml up -d --build

# Migrations шалгах (backend CMD-д автоматаар ажиллана)
docker compose -f docker/docker-compose.prod.yml logs backend | grep "migrate"

# Seed (зөвхөн эхний удаа)
docker compose -f docker/docker-compose.prod.yml exec backend \
  npx prisma db seed
```

---

## Шинэчлэлт (Rolling update)

GitHub-с pull хийгээд зөвхөн өөрчлөгдсөн сервисийг build хийнэ:

```bash
cd /opt/DigitalGer
git pull

# Зөвхөн backend шинэчлэх
docker compose -f docker/docker-compose.prod.yml up -d --build backend

# Зөвхөн frontend шинэчлэх
docker compose -f docker/docker-compose.prod.yml up -d --build frontend

# Зөвхөн admin шинэчлэх
docker compose -f docker/docker-compose.prod.yml up -d --build admin

# Бүгдийг шинэчлэх
docker compose -f docker/docker-compose.prod.yml up -d --build
```

**Тэмдэглэл:** `postgres` болон `redis` service-ийг `--build` хийхгүй — өгөгдөл хадгалагдана.

---

## SSL сунгах

Let's Encrypt cert 90 хоног дараа дуусна. Автоматаар:

```bash
certbot renew --pre-hook "docker compose -f /opt/DigitalGer/docker/docker-compose.prod.yml stop nginx" \
              --post-hook "docker compose -f /opt/DigitalGer/docker/docker-compose.prod.yml start nginx"
```

Cron-д нэмэх:
```bash
0 3 * * 1 certbot renew --quiet
```

---

## Логууд харах

```bash
# Бүх сервис
docker compose -f docker/docker-compose.prod.yml logs -f

# Тодорхой сервис
docker compose -f docker/docker-compose.prod.yml logs -f backend
docker compose -f docker/docker-compose.prod.yml logs -f nginx

# Nginx access log
docker compose -f docker/docker-compose.prod.yml exec nginx tail -f /var/log/nginx/access.log
```

---

## Буцаах (Rollback)

```bash
# Өмнөх commit руу буцах
git log --oneline -10
git checkout <commit_hash>
docker compose -f docker/docker-compose.prod.yml up -d --build
```

---

## Health шалгах

```bash
curl https://api.digitalger.mn/api/health
# Хариу:
# { "status": "ok", "checks": { "database": "ok", "redis": "ok" } }
```

---

## Яаралтай үйлдлүүд

```bash
# Бүх зүйл зогсоох
docker compose -f docker/docker-compose.prod.yml down

# Backend дахин эхлүүлэх
docker compose -f docker/docker-compose.prod.yml restart backend

# DB-д шууд орох
docker compose -f docker/docker-compose.prod.yml exec postgres \
  psql -U digitalger digitalger

# Backup хийх
./docker/scripts/backup.sh
```

---

## Мониторинг (бэлтгэл)

Дараах хэрэгслүүдийг суулгах тохиолдолд дэмжинэ:

- **Uptime Kuma** — `https://api.digitalger.mn/api/health` endpoint шалгах
- **Grafana + Prometheus** — CPU, RAM, disk
- **Loki** — Docker log aggregation

> Одоогоор суулгаагүй. Шаардлагатай бол `docker-compose.prod.yml`-д нэмнэ.
