# DigitalGer — Claude Code Instructions

## Project
Mongolian digital product marketplace (digitalger.mn). Monorepo: frontend (Next.js, :3000), admin (Next.js, :3001), backend (NestJS, :4000), shared UI package.

## Permissions
All bash commands, file edits, and tool calls are pre-approved. Run everything without asking.

## UI Architecture (strict)
- **Base:** shadcn/ui + Radix UI + TailwindCSS
- **Enhancements:** Lucide, Framer Motion, Sonner, React Hook Form + Zod, TanStack Table, TanStack Query, Zustand
- **Optional blocks:** Magic UI, Aceternity UI, shadcn blocks — only isolated sections adapted to DigitalGer design system
- **Forbidden:** Material UI, Ant Design, Bootstrap, Chakra UI
- shadcn/ui is the single source of truth. Do not mix design systems.

## Dev Commands
```powershell
# Start all services
docker compose -f docker/docker-compose.yml up -d postgres redis
cd backend  && npm run start:dev   # port 4000
cd frontend && npm run dev          # port 3000
cd admin    && npm run dev          # port 3001

# Database
cd backend && npx prisma migrate dev
cd backend && npx prisma db seed
```

## Stack
- Frontend/Admin: Next.js 15, React 19, TailwindCSS 4, NextAuth 4
- Backend: NestJS 11, Prisma 6, PostgreSQL, Redis
- Storage: Cloudflare R2 | Payment: QPay | Icons: Lucide

## Shared Package
`@digitalger/shared` — source of all shared UI components and types. Import as:
```ts
import { Button, Card } from '@digitalger/shared/ui'
import { cn, formatPrice } from '@digitalger/shared'
```

## Admin Credentials
admin@digitalger.mn / Admin@12345
