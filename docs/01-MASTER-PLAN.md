# DigitalGer — Үйлдвэрлэлийн төлөвлөгөө

**Домэйн:** digitalger.mn  
**Статус:** Step 2–16 хэрэгжсэн (2026-05-16)

---

## Бүтэц

```
DigitalGer/
├── shared/       → @digitalger/shared (UI + types + utils)
├── frontend/     → digitalger.mn
├── admin/        → admin panel (:3001)
├── backend/      → NestJS API (:4000)
├── assets/
├── docs/
└── docker/
```

---

## Фазууд

| # | Фаз | Статус |
|---|-----|--------|
| 1 | Бүтэц | ✅ |
| 2 | Design system (shared UI) | ✅ |
| 3 | Auth | ✅ |
| 4 | Frontend website | ✅ |
| 5 | User dashboard | ✅ |
| 6 | Admin layout | ✅ |
| 7 | Admin CRUD | ✅ |
| 8 | Upload → R2 | ✅ |
| 9 | Prisma schema | ✅ (migrate: Docker postgres шаардлагатай) |
| 10 | Backend modules | ✅ |
| 11 | QPay | ✅ (+ dev auto-pay) |
| 12 | Download security | ✅ |
| 13 | Redis | ✅ |
| 14 | Security | ✅ |
| 15 | SEO | ✅ |
| 16 | Docker | ✅ (compose бэлэн) |

---

## Ажиллуулах

```powershell
# 1. Docker Desktop асаана
cd docker
docker compose up -d postgres redis

# 2. DB
cd ../backend
copy .env.example .env   # R2, QPay оруулна
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

**Admin:** admin@digitalger.mn / Admin@12345

---

## Shared UI

`docs/04-SHARED-UI.md` уншина уу.
