# DigitalGer

**Домэйн:** [digitalger.mn](https://digitalger.mn)  
Үйлдвэрлэлийн дижитал marketplace — файл, загвар, курс, видео.

## Бүтэц

| Folder | Зориулалт |
|--------|-----------|
| `frontend/` | Хэрэглэгчийн вэб |
| `admin/` | Админ самбар (`admin.digitalger.mn`) |
| `backend/` | NestJS API |
| `shared/` | Нийтлэг TypeScript types |
| `assets/` | Лого, статик |
| `docs/` | Төлөвлөгөө, баримт |
| `docker/` | Docker Compose |

## Хөгжүүлэлт

Дэлгэрэнгүй: [`docs/01-MASTER-PLAN.md`](docs/01-MASTER-PLAN.md)

### Step 1 (одоо)

```powershell
# PostgreSQL + Redis (docker/)
cd docker
docker compose up -d postgres redis

# Backend
cd backend
copy .env.example .env
npm run start:dev

# Frontend
cd frontend
copy .env.example .env.local
npm run dev

# Admin
cd admin
copy .env.example .env.local
npm run dev -- -p 3001
```

## Tech stack

Next.js · NestJS · Prisma · PostgreSQL · Redis · Cloudflare R2 · QPay · Resend
