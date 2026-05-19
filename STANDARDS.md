# DigitalGer — Design Standards & Patterns

## Хариулт хэл
Монгол хэл. Бүх UI текст, алдааны мэдэгдэл, placeholder монгол хэлтэй байна.

---

## Auth

### Login / Signup modal
- `AuthModal` компонент — tab switcher: Нэвтрэх / Бүртгүүлэх
- Нэвтрэх: identifier (email эсвэл утас) + нууц үг
- Бүртгүүлэх: нэр (заавал), утас (заавал), и-мэйл (заавал), нууц үг + давтах
- **Зочноор нэвтрэх**: login form-ийн доод хэсэгт "Нэвтрэх" товчны хажууд
  - `localStorage` ("digitalger-guest") дотор зочин итгэмжлэл хадгална
  - Дахин нэвтрэхэд хадгалсан итгэмжлэлийг ашиглана (device persistence)
- Google/Facebook: `SocialButtons` компонент — ижил style, зөвхөн icon ялгаатай

### Session separation
- Frontend (`:3000`): cookie нэр = `next-auth.session-token`
- Admin (`:3001`): cookie нэр = `admin.next-auth.session-token`
- Admin middleware: `withAuth` биш, `getToken({ cookieName: 'admin.next-auth.session-token' })` ашиглана

---

## Wishlist (localStorage)

```typescript
// store/wishlist.ts — flat items array, NO computed list() function
const useWishlistStore = create(persist((set, get) => ({
  items: [],
  toggle: (product) => set((s) => ...),
  has: (id) => get().items.some(i => i.id === id),
}), { name: 'digitalger-wishlist' }))
```

### Hydration mismatch fix
```tsx
// Компонент дотор (ProductCard, PurchaseCard):
const inWishlistRaw = useWishlistStore((s) => s.has(product.id));
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
const inWishlist = mounted && inWishlistRaw;
```
- Server render: `false` → client hydration: actual value
- `list()` функц БИЧИХГҮЙ — шинэ array reference үүсгэж infinite loop гаргана

---

## Loading States
- Skeleton ашиглана, spinner АШИГЛАХГҮЙ
- Server fetch + `Promise.all()` for parallel fetches
- TanStack Query: `staleTime` тохируулна (5min for static data)

---

## Blog Section (home page)
- Desktop (sm+): 3-column grid, эхний 6 нийтлэл
- Mobile: CSS scroll-snap horizontal swiper, 1 card at a time
  - `w-[82vw] snap-center shrink-0`, `overflow-x-auto snap-x snap-mandatory`
- Blog page: бүх нийтлэл (`pageSize: 24`)

---

## Product Gallery
- `MediaGallery` компонент: YouTube/Vimeo embed + зураг дэмжинэ
- Main viewer: `aspect-video`, nav arrows, dot indicators
- Thumbnail grid: `grid-cols-6 sm:grid-cols-8`

---

## Avatar & User UI
- Guest user: `Ghost` icon (Lucide), bg-muted
- OAuth user: profile image (Image tag, unoptimized)
- Email/phone user: нэрийн эхний үсэг, bg-primary/20

---

## Product Page
- `howToUseSteps`: зөвхөн product-д өөрийн steps байвал харуулна. DEFAULT fallback БАЙХГҮЙ
- Social proof: FAQ-ийн ДАРАА байрлана (зүүн баганын доод хэсэг)

---

## Forms
- React Hook Form + Zod
- `FieldError` helper компонент: `<p className="text-xs text-destructive mt-1">`
- Password field: show/hide toggle (`PasswordInput` компонент)
- Required field: `<span className="text-destructive">*</span>`

---

## Dropdown / Menu
```tsx
const menuRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (!open) return;
  const handler = (e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, [open]);
```

---

## Tailwind
- Brand colors: `primary` (#022179 navy), `secondary` (#ffbe00 gold)
- `bg-gradient-to-*` → `bg-linear-to-*` (Tailwind v4)
- Sheet/Dialog: CSS keyframe animations in `globals.css` (smooth slide/zoom)

---

## API Calls
- `ordersApi`, `usersApi`, `authApi`, etc. — `@/lib/api.ts`
- Shared: `@digitalger/shared` (formatPrice, cn, types)
- UI: `@digitalger/shared/ui` (Button, Card, Badge, etc.)

---

## Admin Panel
- Credentials: `admin@digitalger.mn` / `Admin@12345`
- Role check: `data.user.role !== 'ADMIN'` → return null
- Separate Next.js app on port 3001
