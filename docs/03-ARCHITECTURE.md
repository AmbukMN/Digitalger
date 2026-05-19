# DigitalGer — Folder convention

## Frontend & Admin (ижил зарчим)

```
src/
├── app/              # App Router — зөвхөн routing, SSR
├── components/
│   ├── ui/           # shadcn (Step 2)
│   ├── layout/       # Navbar, Footer, Sidebar
│   └── common/       # Дахин ашиглах бусад
├── lib/              # utils, api client, constants
├── hooks/
├── stores/           # Zustand
└── types/            # App-specific types
```

**Дүрэм:** Feature бүрт давхардсан component үүсгэхгүй. `components/ui` → design system only.

## Backend

```
src/
├── common/           # guards, filters, pipes
├── config/           # env configuration
├── modules/          # Nest feature modules
└── prisma/           # schema (Step 9)
```

## Shared

`shared/src` — enums, API response shapes. Backend Prisma types-тай sync (Step 9).
