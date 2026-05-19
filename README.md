# DigitalGer

**Домэйн:** [digitalger.mn](https://digitalger.mn)  
Монголын дижитал бүтээгдэхүүний зах зээл — курс, загвар, файл, видео.

## Бүтэц

| Folder | Зориулалт |
|--------|-----------|
| `frontend/` | Хэрэглэгчийн вэб (`digitalger.mn`) |
| `admin/` | Админ самбар (`admin.digitalger.mn`) |
| `backend/` | NestJS API (`api.digitalger.mn`) |
| `shared/` | Нийтлэг UI компонент + types |
| `assets/` | Лого, статик зураг |
| `docs/` | Архитектур, байршуулалтын баримт |
| `docker/` | Docker Compose, Nginx, скриптүүд |
| `logs/` | Локал лог файлууд |

## Хурдан эхлэх

```powershell
# 1. PostgreSQL + Redis асаах
cd docker
docker compose -f docker-compose.dev.yml up -d postgres redis

# 2. Backend
cd ../backend
copy .env.example .env    # R2, QPay тохиргоо оруулна
npm run prisma:migrate
npm run prisma:seed
npm run start:dev

# 3. Frontend
cd ../frontend
copy .env.example .env.local
npm run dev

# 4. Admin
cd ../admin
copy .env.example .env.local
npm run dev
```

**Admin:** `admin@digitalger.mn` / `Admin@12345`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TailwindCSS 4, shadcn/ui |
| Admin | Next.js 15, React 19, TailwindCSS 4 |
| Backend | NestJS 11, Prisma 6, PostgreSQL 16, Redis 7 |
| Storage | Cloudflare R2 |
| Payment | QPay |
| Infrastructure | Hetzner VPS, Docker, Nginx, Cloudflare |

## Домэйнүүд

| Домэйн | Зориулалт |
|--------|-----------|
| `digitalger.mn` | Frontend |
| `admin.digitalger.mn` | Админ самбар |
| `api.digitalger.mn` | Backend API |
| `assets.digitalger.mn` | Cloudflare R2 |

## Баримт

- [Архитектур](docs/ARCHITECTURE.md)
- [Docker гарын авлага](docs/DOCKER.md)
- [Байршуулалт](docs/DEPLOYMENT.md)
- [Орчны хувьсагчид](docs/ENVIRONMENT.md)
