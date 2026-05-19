# DigitalGer — Docker Гарын авлага

## Файл бүтэц

```
docker/
├── docker-compose.dev.yml   Локал хөгжүүлэлт (зөвхөн postgres + redis)
├── docker-compose.prod.yml  Production (бүх сервис + nginx)
├── Dockerfile.frontend      Frontend production image
├── Dockerfile.admin         Admin production image
├── nginx/
│   ├── nginx.conf           Nginx үндсэн тохиргоо
│   └── conf.d/
│       ├── digitalger.conf  Virtual host тохиргоо
│       └── ssl.conf         SSL/TLS тохиргоо
└── scripts/
    ├── backup.sh            PostgreSQL backup
    └── restore.sh           PostgreSQL restore
```

---

## Локал хөгжүүлэлт

### 1. Зөвхөн DB + Redis ажиллуулах

```bash
cd docker
docker compose -f docker-compose.dev.yml up -d
```

### 2. Сервисүүдийг тусад нь ажиллуулах (hot reload)

```bash
# Terminal 1 — Backend
cd backend && npm run start:dev

# Terminal 2 — Frontend
cd frontend && npm run dev

# Terminal 3 — Admin
cd admin && npm run dev
```

### 3. Зогсоох

```bash
cd docker
docker compose -f docker-compose.dev.yml down
```

---

## Production build шалгах

```bash
# Frontend build test
docker build -f docker/Dockerfile.frontend -t digitalger-frontend .

# Admin build test
docker build -f docker/Dockerfile.admin -t digitalger-admin .

# Backend build test
docker build -f backend/Dockerfile -t digitalger-backend ./backend
```

---

## Production ажиллуулах

> Дэлгэрэнгүй: [DEPLOYMENT.md](DEPLOYMENT.md)

```bash
# VPS дээр
cd /opt/DigitalGer

# Бүх сервис ажиллуулах
docker compose -f docker/docker-compose.prod.yml up -d

# Зөвхөн backend шинэчлэх
docker compose -f docker/docker-compose.prod.yml up -d --build backend

# Логуудыг харах
docker compose -f docker/docker-compose.prod.yml logs -f backend
```

---

## Backup

### Гараар backup хийх

```bash
./docker/scripts/backup.sh
```

### Cron тохируулах (өдөр бүр 02:00)

```bash
crontab -e
# Нэмэх:
0 2 * * * /opt/DigitalGer/docker/scripts/backup.sh >> /opt/DigitalGer/logs/backup.log 2>&1
```

### Restore хийх

```bash
./docker/scripts/restore.sh /opt/DigitalGer/backups/digitalger_20260520_020000.sql.gz
```

---

## Dockerfile тайлбар

### Frontend / Admin (multi-stage)

| Stage | Зориулалт |
|-------|-----------|
| `deps` | npm workspaces dependency install |
| `builder` | `next build` (standalone output) |
| `runner` | Production image (non-root user `nextjs`) |

### Backend (multi-stage)

| Stage | Зориулалт |
|-------|-----------|
| `builder` | `nest build` + `prisma generate` |
| `runner` | Production image (non-root user `nestjs`, `prisma migrate deploy` on start) |

---

## Health checks

| Сервис | Шалгах |
|--------|--------|
| postgres | `pg_isready` |
| redis | `redis-cli ping` |
| backend | `GET /api/health` (DB + Redis status) |

---

## Network

Production-д бүх сервис `internal` network дотор байна. Гадаад руу зөвхөн **nginx:80/443** нээлттэй. PostgreSQL болон Redis гаднаас шууд хандах боломжгүй.
