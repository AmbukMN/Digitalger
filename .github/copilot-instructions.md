# Copilot instructions for DigitalGer

## What this repo is
- Monorepo with 4 workspaces: `shared`, `frontend`, `admin`, `backend`.
- `shared` is the single source of reusable UI components, CSS utilities, and cross-app types.
- `frontend` is the public storefront, `admin` is the admin panel, and `backend` is the NestJS API.

## Architecture and boundaries
- `frontend` and `admin` are Next.js apps that both import `@digitalger/shared/ui` and `@digitalger/shared`.
- Shared UI must remain under `shared/src/ui/`; do not duplicate primitives in `frontend/src/components/ui` or `admin/src/components/ui`.
- Backend is a NestJS application. Feature code lives in `backend/src/modules/*` and shared guards/filters live in `backend/src/common/*`.
- Prisma access is centralized through `backend/src/prisma/prisma.service.ts` and exported by `backend/src/prisma/prisma.module.ts`.
- Backend API routes are prefixed with `/api` in `backend/src/main.ts` and the frontend client expects `API_URL/api`.

## Critical workflows
- Root development commands are the easiest path:
  - `npm run dev:frontend` to start storefront
  - `npm run dev:admin` to start admin panel on port `3001`
  - `npm run dev:backend` to start NestJS API
- Root build command compiles shared + backend + frontend + admin: `npm run build`.
- Database setup is backend-scoped:
  - `npm run db:migrate`
  - `npm run db:seed`
- Local backend configuration comes from `backend/src/config/configuration.ts` and `.env` values.

## Project-specific conventions
- Shared UI is consumed, not reimplemented:
  - `import { Button } from '@digitalger/shared/ui';`
  - `import { cn, formatPrice } from '@digitalger/shared';`
- Next apps use `transpilePackages: ['@digitalger/shared']` in `frontend/next.config.ts` and `admin/next.config.ts`.
- `frontend/src/lib/api.ts` is the canonical REST client. It constructs requests to `API_URL/api` and handles JSON + `Authorization: Bearer` tokens.
- Feature modules in `backend/src/modules/*` generally pair a controller with a service and use Prisma filters in DTO-style query logic.
- Auth and role protection use `backend/src/modules/auth` plus `backend/src/common/guards/roles.guard.ts` and `backend/src/common/decorators/roles.decorator.ts`.
- Cache and external integrations are configured in `backend/src/app.module.ts`:
  - Redis cache via `cache-manager-redis-yet`
  - Cloudflare R2 and QPay env-driven integrations

## What to inspect first
- `docs/03-ARCHITECTURE.md` for folder/layout conventions
- `docs/04-SHARED-UI.md` for shared component and theming rules
- `backend/src/app.module.ts` for global backend wiring
- `backend/src/main.ts` for API prefix, CORS, and validation behavior
- `frontend/src/lib/api.ts` for how frontend calls backend routes
- `shared/src/index.ts` for shared exports
- `backend/prisma/seed.ts` for seeded test data and admin credentials

## Avoid
- Avoid creating local UI duplicates in `frontend` or `admin`; extend instead of copying.
- Avoid changing backend route structure without updating the frontend client and `frontend/src/lib/api.ts` together.
- Avoid modifying shared type shapes without checking Prisma data models and frontend API contracts.

## Ask for clarification if
- You need to change `shared` exports, because both apps consume the same package.
- You are adding a backend feature that requires new env vars; confirm expected values in `backend/src/config/configuration.ts`.
- You are changing auth/role logic; verify the flow in `backend/src/modules/auth` and `backend/src/common/guards`.
