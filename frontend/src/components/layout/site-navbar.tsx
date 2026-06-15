'use client';

import {
  Button,
  Input,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  ThemeToggle,
  Avatar,
} from '@digitalger/shared/ui';
import { SearchAutocomplete } from '@/components/layout/search-autocomplete';
import { NotificationBell } from '@/components/layout/notification-bell';
import { cn, formatPrice } from '@digitalger/shared';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bookmark,
  ClipboardList,
  Ghost,
  Heart,
  LogOut,
  Menu,
  BookOpen,
  Package,
  Search,
  ShoppingCart,
  Star,
  User,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { SmartImage } from '@/components/ui/smart-image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { API_URL } from '@/lib/constants';
import { blogApi, menuApi, productsApi } from '@/lib/api';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';
import { AuthModal } from '@/components/auth/auth-modal';
import {
  FacebookIcon,
  InstagramIcon,
  TwitterXIcon,
  ThreadsIcon,
  TelegramIcon,
  WhatsAppIcon,
  TikTokIcon,
  YouTubeIcon,
  LinkedInIcon,
} from '@/components/social-icons';
import type { MenuItem } from '@/types/api';

// ─── Статик placeholder-ууд ───────────────────────────────────────────────
// Анх удаа (cache-гүй) ачаалахад API хариу ирэхээс ӨМНӨ шууд харагдах ёстой
// зүйлс. Ингэснээр лого/меню API timeout болж гацах асуудал арилна.
// API ирвэл доорх утгууд admin-аас ирсэн динамик утгаар солигдоно.
const STATIC_LOGO = '/brand/logo-color.png';

// API ачаалагдаагүй/гацсан ч харагдах үндсэн меню (Light DOM, шууд render).
const FALLBACK_MENU: MenuItem[] = [
  { id: 'f-home', label: 'Нүүр', url: '/', pageSlug: null, target: '_self', openInNew: false },
  { id: 'f-products', label: 'Бүтээгдэхүүн', url: '/products', pageSlug: null, target: '_self', openInNew: false },
  { id: 'f-blog', label: 'Нийтлэл', url: '/blog', pageSlug: null, target: '_self', openInNew: false },
  { id: 'f-about', label: 'Бидний тухай', url: '/about', pageSlug: null, target: '_self', openInNew: false },
];

// Public fetch-д timeout — API удаан/унавал хязгааргүй хүлээж гацахаас сэргийлнэ.
// ⚠️ AbortSignal.timeout нь iOS15/iPhone7-д БАЙХГҮЙ тул AbortController polyfill.
async function fetchWithTimeout(url: string, ms = 6000): Promise<Response> {
  const AS = AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal };
  if (typeof AS.timeout === 'function') return fetch(url, { signal: AS.timeout(ms) });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}


function menuHref(item: MenuItem): string {
  if (item.url) return item.url;
  if (item.pageSlug) return `/${item.pageSlug}`;
  return '/';
}

function usePublicSettings() {
  return useQuery({
    queryKey: ['public', 'settings'],
    queryFn: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/settings/public`);
      if (!res.ok) throw new Error('settings fetch failed');
      return res.json() as Promise<{
        siteName: string;
        logoUrl: string | null;
        socialFacebook: string | null;
        socialInstagram: string | null;
        socialTwitter: string | null;
        socialThreads: string | null;
        socialTelegram: string | null;
        socialWhatsapp: string | null;
        socialTiktok: string | null;
        socialYoutube: string | null;
        socialLinkedin: string | null;
      }>;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

function useMenuItems() {
  return useQuery({
    queryKey: ['public', 'menu'],
    queryFn: () => menuApi.list(),
    staleTime: 2 * 60 * 1000,
    retry: 1,
    // Server (RootLayout)-д prefetch хийсэн меню cache-д аль хэдийн байгаа тул
    // анхны render шууд бодит утгаар гарна (flash-гүй). Cache хоосон (API унасан)
    // үед л доорх activeMenu logic FALLBACK_MENU руу шилжинэ.
  });
}

function useFeaturedProducts() {
  return useQuery({
    queryKey: ['public', 'featured-menu'],
    queryFn: () => productsApi.list({ featured: true, pageSize: 6 }).then((r) => r.items),
    staleTime: 5 * 60 * 1000,
    select: (items) => items.slice(0, 3),
    // Удаан/тогтворгүй сүлжээнд гацахгүйн тулд 3 удаа эскпонентаар дахин оролдоно
    retry: 3,
    retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
  });
}

function useLatestPosts() {
  return useQuery({
    queryKey: ['public', 'latest-posts-menu'],
    queryFn: () => blogApi.latest(3),
    staleTime: 5 * 60 * 1000,
    retry: 3,
    retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
  });
}

function UserAvatar({
  image,
  name,
  isGuest,
  size = 'md',
}: {
  image?: string | null;
  name?: string | null;
  isGuest?: boolean;
  size?: 'sm' | 'md';
}) {
  const px = size === 'sm' ? 28 : 32;
  if (isGuest) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-muted text-muted-foreground"
        style={{ width: px, height: px }}
      >
        <Ghost className="h-4 w-4" />
      </div>
    );
  }
  // Login хийгээгүй (зураг ч нэр ч байхгүй) → default User icon (НЭ "U" үсэг).
  if (!image && !name) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-muted text-muted-foreground"
        style={{ width: px, height: px }}
      >
        <User className="h-4 w-4" />
      </div>
    );
  }
  // Нэвтэрсэн — Avatar (onError fallback + raw <img>, OAuth/R2 timeout-аас сэргийлнэ)
  return <Avatar src={image} name={name} size={px} priority />;
}

const ACCOUNT_MENU = [
  { href: '/library', label: 'Миний сан', icon: Package },
  { href: '/orders', label: 'Захиалгын түүх', icon: ClipboardList },
  { href: '/wishlist', label: 'Хадгалсан бүтээгдэхүүн', icon: Bookmark },
  { href: '/profile', label: 'Профайл', icon: User },
];

function MobileFeaturedProducts({ onClose }: { onClose: () => void }) {
  const { data: products = [], isLoading } = useFeaturedProducts();

  // Ачаалж байх үед skeleton (хэсэг бүрэн алга болж "гацсан" мэт харагдахаас сэргийлнэ).
  if (isLoading) {
    return (
      <div className="border-t border-border pt-4 pb-2">
        <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Онцлох</p>
        <div className="space-y-1 px-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
              <div className="h-10 w-10 shrink-0 rounded-md bg-muted animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  // Ачаалж чадаагүй (iPhone7 удаан сүлжээ/алдаа) ч хэсэг АЛГА болгохгүй —
  // "Бүгдийг үзэх" линк үлдээж, хэрэглэгч жагсаалт руу орох боломжтой.
  if (!products.length) {
    return (
      <div className="border-t border-border pt-4 pb-2">
        <Link
          href="/products?featured=true"
          onClick={onClose}
          className="flex items-center justify-between px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground"
        >
          Онцлох бүтээгдэхүүн <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-4 pb-2">
      <div className="flex items-center justify-between px-3 mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Онцлох</p>
        <Link
          href="/products?featured=true"
          onClick={onClose}
          className="flex items-center gap-0.5 text-xs text-primary hover:underline"
        >
          Бүгд <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-1 px-1">
        {products.map((p) => {
          const hasDiscount = p.compareAtPrice && Number(p.compareAtPrice) > Number(p.price);
          return (
            <Link
              key={p.id}
              href={`/products/${p.slug}`}
              onClick={onClose}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors"
            >
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                {p.thumbnailUrl ? (
                  <SmartImage src={p.thumbnailUrl} alt={p.title} fill className="object-cover" sizes="40px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Star className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium leading-tight">{p.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-primary font-semibold">{formatPrice(Number(p.price))}</p>
                  {hasDiscount && (
                    <p className="text-[10px] text-muted-foreground line-through">
                      {formatPrice(Number(p.compareAtPrice))}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function MobileLatestPosts({ onClose }: { onClose: () => void }) {
  const { data: posts = [], isLoading } = useLatestPosts();

  if (isLoading) {
    return (
      <div className="border-t border-border pt-4 pb-2">
        <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Нийтлэл</p>
        <div className="space-y-1 px-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
              <div className="h-10 w-10 shrink-0 rounded-md bg-muted animate-pulse" />
              <div className="h-3 flex-1 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!posts.length) {
    return (
      <div className="border-t border-border pt-4 pb-2">
        <Link
          href="/blog"
          onClick={onClose}
          className="flex items-center justify-between px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground"
        >
          Нийтлэл <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-4 pb-2">
      <div className="flex items-center justify-between px-3 mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Нийтлэл</p>
        <Link
          href="/blog"
          onClick={onClose}
          className="flex items-center gap-0.5 text-xs text-primary hover:underline"
        >
          Бүгд <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-1 px-1">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            onClick={onClose}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors"
          >
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
              {(post as any).coverImageUrl ? (
                <SmartImage src={(post as any).coverImageUrl} alt={post.title} fill className="object-cover" sizes="40px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <BookOpen className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
            </div>
            <p className="text-xs font-medium leading-tight line-clamp-2 min-w-0 flex-1">{post.title}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SiteNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cartCount = useCartStore((s) => (s.items ?? []).length);
  const wishCount = useWishlistStore((s) => (s.items ?? []).length);
  const [cartShake, setCartShake] = useState(false);
  const prevCartCount = useRef(cartCount);
  const shakeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cartCount > prevCartCount.current) {
      setCartShake(true);
      setTimeout(() => setCartShake(false), 600);
    }
    prevCartCount.current = cartCount;
  }, [cartCount]);

  // FB/IG-аас системийн браузар руу нэвтрэх intent-ээр шилжсэн бол URL-д
  // ?showAuth=1 байна. Хэрэглэгч нэвтрэх гэж байсан тул нэвтрэх modal-ийг АВТОМАТ
  // нээнэ — дахин account дарах шаардлагагүй. Нэвтрээгүй үед л (session байхгүй).
  //
  // ⚠️ Checkout хуудсан дээр энэ effect-ийг АЛГАСНА — учир нь checkout өөрийн
  // AuthModal-тай (callbackUrl="/checkout?autopay=1") ба autopay урсгалыг
  // зохицуулдаг. Энд navbar AuthModal (callbackUrl=нүүр) нээвэл нэвтэрсний дараа
  // нүүр рүү хаягдаж autopay тасрах байсан. Тиймээс checkout-д navbar showAuth
  // ажиллуулахгүй — checkout-ийн autopay effect session ирэхэд login modal-аа
  // өөрөө нээнэ. authShownRef — session resolve бүрд давтан нээхээс сэргийлнэ.
  const authShownRef = useRef(false);
  useEffect(() => {
    if (pathname?.startsWith('/checkout')) return;
    if (authShownRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('showAuth') === '1') {
      authShownRef.current = true;
      if (!session) setAuthOpen(true);
      // ?showAuth-г URL-аас цэвэрлэнэ (refresh-д дахин нээхгүй)
      params.delete('showAuth');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, [session, pathname]);

  useEffect(() => {
    if (shakeIntervalRef.current) clearInterval(shakeIntervalRef.current);
    if (cartCount > 0) {
      shakeIntervalRef.current = setInterval(() => {
        setCartShake(true);
        setTimeout(() => setCartShake(false), 600);
      }, 4000);
    }
    return () => { if (shakeIntervalRef.current) clearInterval(shakeIntervalRef.current); };
  }, [cartCount]);
  const { data: publicSettings } = usePublicSettings();
  const { data: menuItems } = useMenuItems();

  const siteName = publicSettings?.siteName || 'DigitalGer';
  // Лого: admin оруулсан logoUrl байвал түүнийг, эс бол статик PNG-г шууд харуулна.
  // Анх удаа (cache-гүй) ачаалахад API хүлээлгүйгээр лого шууд гарна.
  const [logoError, setLogoError] = useState(false);
  const logoSrc = !logoError && publicSettings?.logoUrl ? publicSettings.logoUrl : STATIC_LOGO;
  const activeMenu = (menuItems && menuItems.length > 0) ? menuItems : FALLBACK_MENU;

  const isGuest =
    (session?.user as any)?.isGuest ??
    session?.user?.email?.endsWith('@guest.digitalger.mn') ??
    false;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  useEffect(() => {
    setMobileSearchOpen(false);
  }, [pathname]);

  const handleAccountClick = () => {
    if (session) {
      setUserMenuOpen((o) => !o);
    } else {
      setAuthOpen(true);
    }
  };

  return (
    <>
      <header
        data-nextjs-scroll-focus-boundary
        className={`fixed inset-x-0 top-0 z-40 border-b bg-background/98 transition-[border-color,box-shadow] duration-200 ${
          scrolled
            ? 'border-border/60 shadow-[0_1px_12px_rgba(0,0,0,0.15)]'
            : 'border-border/30 shadow-none'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">

          {/* Mobile search overlay */}
          {mobileSearchOpen && (
            <div
              className="absolute inset-x-0 top-0 z-50 flex items-center gap-2 px-4 lg:hidden animate-search-slide-down"
              style={{
                height: '64px',
                paddingTop: 'env(safe-area-inset-top, 0px)',
                background: 'var(--card)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                onClick={() => setMobileSearchOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary hover:bg-muted/70 transition-colors"
                aria-label="Хаах"
              >
                <X className="h-5 w-5" />
              </button>
              <SearchAutocomplete
                placeholder="Бүтээгдэхүүн, нийтлэл хайх..."
                className="flex-1"
                inputClassName="border-primary/30 focus-visible:ring-primary/40 bg-background/80"
                onNavigate={() => setMobileSearchOpen(false)}
              />
            </div>
          )}

          <Link href="/" className="flex shrink-0 items-center gap-2">
            {/* Лого — статик placeholder тул API хүлээлгүй шууд харагдана.
                next/image-ийн optimize-аас болж анхны ачаалал удаахаас сэргийлж
                unoptimized — статик PNG жижиг тул шууд serve хийгдэнэ. */}
            <Image
              src={logoSrc}
              alt={siteName || 'DigitalGer'}
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
              priority
              unoptimized
              onError={() => setLogoError(true)}
            />
            <span className="font-bold navbar-logo-text">{siteName || 'DigitalGer'}</span>
          </Link>

          <nav className="hidden flex-1 justify-center gap-1 md:flex">
            {activeMenu.map((item) => {
              const href = menuHref(item);
              const active = href === '/'
                ? pathname === '/'
                : pathname.startsWith(href.split('?')[0]);
              return (
                <Link
                  key={item.id}
                  href={href}
                  target={item.openInNew ? '_blank' : undefined}
                  rel={item.openInNew ? 'noopener noreferrer' : undefined}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/10',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <SearchAutocomplete
            placeholder="Хайх..."
            className="hidden w-44 shrink-0 lg:block xl:w-56"
          />

          <div className="ml-auto flex items-center gap-1">
            {/* Mobile search toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Хайх"
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Theme toggle — mobile-д НУУНА (hamburger дотор бий, icon багтахгүй
                болж hamburger тастагдахаас сэргийлнэ). Зөвхөн md+ дээр. */}
            <span className="hidden md:inline-flex">
              <ThemeToggle />
            </span>

            <Button variant="ghost" size="icon" asChild>
              <Link href="/wishlist" className="relative">
                <Heart className="h-5 w-5" />
                {wishCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: '#ffbe00', color: '#022179' }}>
                    {wishCount}
                  </span>
                )}
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href="/checkout" className="relative">
                <ShoppingCart className={cn('h-5 w-5 transition-transform', cartShake && 'cart-shake')} />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: '#ffbe00', color: '#022179' }}>
                    {cartCount}
                  </span>
                )}
              </Link>
            </Button>

            {/* Мэдэгдэл (🔔) — зөвхөн нэвтэрсэн хэрэглэгчид (доторх логик нуудаг) */}
            <NotificationBell />

            {/* Account dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={handleAccountClick}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
                aria-label="Бүртгэл"
              >
                <UserAvatar
                  image={session?.user?.image}
                  name={session?.user?.name}
                  isGuest={isGuest}
                />
              </button>

              {session && userMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-popover p-1 shadow-lg">
                  <div className="px-3 py-2">
                    <p className="text-xs font-medium truncate">
                      {isGuest ? 'Зочин хэрэглэгч' : (session.user?.name ?? 'Хэрэглэгч')}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {isGuest ? 'Зочин горимд ажиллаж байна' : session.user?.email}
                    </p>
                  </div>
                  <div className="my-1 h-px bg-border" />
                  {ACCOUNT_MENU.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {label}
                    </Link>
                  ))}
                  <div className="my-1 h-px bg-border" />
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                    onClick={() => { setUserMenuOpen(false); signOut({ callbackUrl: pathname }); }}
                  >
                    <LogOut className="h-4 w-4" />
                    Гарах
                  </button>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Цэс нээх"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col">
          <SheetHeader className="flex-row items-center justify-between border-b border-border px-4 py-3 shrink-0">
            <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
              <Image
                src={logoSrc}
                alt={siteName || 'DigitalGer'}
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
                unoptimized
                onError={() => setLogoError(true)}
              />
              <SheetTitle className="text-base font-bold navbar-logo-text">{siteName || 'DigitalGer'}</SheetTitle>
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Хаах"
            >
              <X className="h-4 w-4" />
            </button>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {/* Navigation links — статик fallback тул API гацсан ч шууд харагдана */}
            <nav className="py-3 px-3">
              <div className="space-y-0.5">
                {activeMenu.map((item) => {
                  const href = menuHref(item);
                  const active = href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(href.split('?')[0]);
                  return (
                    <Link
                      key={item.id}
                      href={href}
                      target={item.openInNew ? '_blank' : undefined}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* Theme toggle + Social icons — нэг мөрт */}
            {(() => {
              const socialItems = [
                { key: 'socialFacebook' as const, label: 'Facebook', Icon: FacebookIcon },
                { key: 'socialInstagram' as const, label: 'Instagram', Icon: InstagramIcon },
                { key: 'socialTwitter' as const, label: 'Twitter / X', Icon: TwitterXIcon },
                { key: 'socialThreads' as const, label: 'Threads', Icon: ThreadsIcon },
                { key: 'socialTelegram' as const, label: 'Telegram', Icon: TelegramIcon },
                { key: 'socialWhatsapp' as const, label: 'WhatsApp', Icon: WhatsAppIcon },
                { key: 'socialTiktok' as const, label: 'TikTok', Icon: TikTokIcon },
                { key: 'socialYoutube' as const, label: 'YouTube', Icon: YouTubeIcon },
                { key: 'socialLinkedin' as const, label: 'LinkedIn', Icon: LinkedInIcon },
              ].filter(({ key }) => !!publicSettings?.[key]);
              return (
                <div className="border-t border-border mt-1 px-4 py-2.5 flex items-center gap-2">
                  <ThemeToggle />
                  {socialItems.length > 0 && (
                    <>
                      <div className="w-px h-5 bg-border shrink-0" />
                      <div className="flex items-center gap-3 flex-wrap">
                        {socialItems.map(({ key, label, Icon }) => (
                          <Link
                            key={key}
                            href={publicSettings![key]!}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={label}
                            onClick={() => setMobileOpen(false)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Icon className="h-5 w-5" />
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Featured products */}
            <div className="px-3">
              <MobileFeaturedProducts onClose={() => setMobileOpen(false)} />
            </div>

            {/* Latest blog posts */}
            <div className="px-3">
              <MobileLatestPosts onClose={() => setMobileOpen(false)} />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultTab="login"
        callbackUrl={
          pathname.startsWith('/checkout') || pathname.startsWith('/payment') || pathname.startsWith('/admin')
            ? '/'
            : pathname
        }
      />
    </>
  );
}
