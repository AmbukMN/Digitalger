# @digitalger/shared — Нэг UI, хоёр app

## Зарчим

**Button, Card, Dialog, DataTable** гэх мэт бүх UI зөвхөн `shared/src/ui/` дотор.

```tsx
// ✅ Зөв
import { Button, Card } from '@digitalger/shared/ui';
import { cn, formatPrice } from '@digitalger/shared';

// ❌ Бүү хий
// frontend/src/components/ui/button.tsx
```

## Ашиглах

### 1. `globals.css` (frontend/admin)

```css
@import "tailwindcss";
@import "../../../shared/src/styles/globals.css";
@source "../../../shared/src/**/*.{ts,tsx}";
```

### 2. `next.config.ts`

```ts
transpilePackages: ['@digitalger/shared'],
```

### 3. Providers

```tsx
import { ThemeProvider } from '@digitalger/shared/ui';
```

## Компонентууд

Button, Card, Input, Label, Badge, Dialog, Sheet, Select, DataTable, Skeleton, Loading, EmptyState, ErrorState, Separator, ThemeProvider

## Theme

CSS variables: primary, secondary, accent, muted, success, warning, destructive. `.dark` class.
