# DigitalGer — Architecture

## Системийн тойм

```
                    Cloudflare (DNS + CDN + DDoS)
                           │
                    Hetzner VPS
                           │
                      Nginx (proxy)
                    ┌──────┴──────┐──────────────┐
                    ↓             ↓              ↓
               frontend:3000  admin:3001   backend:4000
               (Next.js)      (Next.js)    (NestJS)
                                               │
                                    ┌──────────┴────────────┐
                                    ↓                       ↓
                              postgres:5432           redis:6379
                              (PostgreSQL)             (Cache)

               Cloudflare R2 (assets.digitalger.mn)
               QPay (payment)
```

## Monorepo бүтэц

```
DigitalGer/
├── shared/          @digitalger/shared — UI components, utils, types
├── frontend/        digitalger.mn — хэрэглэгчийн вэб
├── admin/           admin.digitalger.mn — админ самбар
├── backend/         api.digitalger.mn — NestJS REST API
├── docker/          Docker Compose, Nginx, скриптүүд
│   ├── nginx/       Nginx тохиргоо
│   └── scripts/     Backup, deploy скриптүүд
├── docs/            Архитектур, байршуулалтын баримт
└── logs/            Локал лог файлууд
```

## Frontend (`frontend/`)

| Зүйл | Технологи |
|------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | TailwindCSS 4 + shadcn/ui |
| State | Zustand (persist) |
| Server state | TanStack Query |
| Auth | NextAuth v4 (JWT strategy) |
| Build | `output: 'standalone'` |

### Route groups
```
app/
├── (marketing)/     Нүүр, бүтээгдэхүүн, blog, search
├── (shop)/          Cart, checkout
├── (dashboard)/     Orders, library, profile
└── (auth)/          Login, register (modal)
```

## Admin (`admin/`)

| Зүйл | Технологи |
|------|-----------|
| Framework | Next.js 15 (App Router) |
| Auth | NextAuth v4 (custom cookie: `admin.next-auth.session-token`) |
| Editor | TipTap rich text |
| Build | `output: 'standalone'` |

### Admin-ийн хамгаалалт
- Middleware: `getToken({ cookieName: 'admin.next-auth.session-token' })`
- Backend: `@UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN)`

## Backend (`backend/`)

```
src/
├── app.module.ts        Root module
├── main.ts              Bootstrap (helmet, cors, validation, compression)
├── config/              Env configuration
├── prisma/              PrismaService, PrismaModule
├── storage/             Cloudflare R2 (S3-compatible)
├── common/
│   ├── guards/          JwtAuthGuard, RolesGuard
│   ├── decorators/      @CurrentUser(), @Roles()
│   └── filters/         HttpExceptionFilter
└── modules/
    ├── auth/            JWT login, register, refresh
    ├── users/           User CRUD
    ├── products/        Product listing, detail
    ├── categories/      Category management
    ├── orders/          Order creation, status
    ├── payments/        QPay integration
    ├── downloads/       Signed URL download
    ├── uploads/         File upload → R2
    ├── courses/         Course lesson video URL
    ├── admin/           Admin CRUD (products, orders, users, settings)
    ├── coupons/         Coupon validation + application
    ├── banners/         Home page banners
    ├── blog/            Blog posts
    ├── faqs/            FAQ management
    ├── testimonials/    Testimonials
    ├── bundles/         Product bundles
    ├── menu/            Navigation menu items
    ├── pages/           Static pages
    ├── wishlist/        User wishlist
    └── notifications/   User notifications
```

## Database (PostgreSQL + Prisma)

### Core models
| Model | Зориулалт |
|-------|-----------|
| User | Хэрэглэгч (email/phone/OAuth) |
| Product | Бүтээгдэхүүн (FILE, TEMPLATE, COURSE, VIDEO...) |
| Course / CourseModule / Lesson | Курсын агуулга |
| Order / OrderItem | Захиалга |
| Payment | QPay төлбөр |
| Download | Файл татан авалт |
| Coupon | Хөнгөлөлтийн код |
| ProductFile | Татан авах файлууд |
| ProductImage | Бүтээгдэхүүний зураг/видео |

### Migration стратеги
- **Development:** `npx prisma migrate dev`
- **Production:** `npx prisma migrate deploy` (Docker CMD-д автоматаар ажиллана)
- **Хориотой:** `prisma db push` (production-д schema drift үүсгэнэ)

## Storage (Cloudflare R2)

```
assets.digitalger.mn → R2 Bucket (digitalger-assets)
├── uploads/         Admin upload files
├── products/        Product images
└── lessons/         Course video files
```

### Presigned URL flow
```
Хэрэглэгч → Backend (ownership check) → Presigned URL (5 мин) → R2
```

## Auth flow

```
Login → POST /api/auth/login → { accessToken, refreshToken }
        accessToken (15m) → Authorization: Bearer ...
        refreshToken (7d) → POST /api/auth/refresh
```

## Payment flow (QPay)

```
Checkout → POST /api/orders → orderId
        → POST /api/payments/initiate → QPay QR
        → Хэрэглэгч QPay app → webhook → POST /api/payments/webhook
        → signature verify → order.status = PAID
        → Download unlocked
```

## Shared Package (`@digitalger/shared`)

```typescript
import { Button, Card, Badge } from '@digitalger/shared/ui';
import { cn, formatPrice } from '@digitalger/shared';
```

- Зөвхөн `shared/src/ui/` дотор UI component
- Frontend болон Admin хоёулаа дахин ашиглана
- Local duplicate хориотой
