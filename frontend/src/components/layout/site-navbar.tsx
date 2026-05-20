'use client';

import {
  Button,
  Input,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  ThemeToggle,
} from '@digitalger/shared/ui';
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
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { API_URL } from '@/lib/constants';
import { blogApi, menuApi, productsApi } from '@/lib/api';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';
import { AuthModal } from '@/components/auth/auth-modal';
import type { MenuItem } from '@/types/api';

const FALLBACK_NAV: MenuItem[] = [
  { id: '1', label: 'Нүүр', url: '/', pageSlug: null, target: '_self', openInNew: false },
  { id: '2', label: 'Файл Загварууд', url: '/products?types=FILE,TEMPLATE', pageSlug: null, target: '_self', openInNew: false },
  { id: '3', label: 'Хичээлүүд', url: '/products?types=LESSON,BUNDLE', pageSlug: null, target: '_self', openInNew: false },
  { id: '4', label: 'Нийтлэл', url: '/blog', pageSlug: null, target: '_self', openInNew: false },
  { id: '5', label: 'Бидний тухай', url: '/about', pageSlug: null, target: '_self', openInNew: false },
];

function menuHref(item: MenuItem): string {
  if (item.url) return item.url;
  if (item.pageSlug) return `/${item.pageSlug}`;
  return '/';
}

function usePublicSettings() {
  return useQuery({
    queryKey: ['public', 'settings'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/settings/public`);
      if (!res.ok) throw new Error('settings fetch failed');
      return res.json() as Promise<{ siteName: string; logoUrl: string | null }>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

function useMenuItems() {
  return useQuery({
    queryKey: ['public', 'menu'],
    queryFn: () => menuApi.list(),
    staleTime: 2 * 60 * 1000,
    placeholderData: FALLBACK_NAV,
  });
}

function useFeaturedProducts() {
  return useQuery({
    queryKey: ['public', 'featured-menu'],
    queryFn: () => productsApi.list({ featured: true, pageSize: 6 }).then((r) => r.items),
    staleTime: 5 * 60 * 1000,
    select: (items) => {
      const shuffled = [...items].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 3);
    },
  });
}

function useLatestPosts() {
  return useQuery({
    queryKey: ['public', 'latest-posts-menu'],
    queryFn: () => blogApi.latest(3),
    staleTime: 5 * 60 * 1000,
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
  const s = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm';
  if (isGuest) {
    return (
      <div className={`flex ${s} items-center justify-center rounded-full bg-muted text-muted-foreground`}>
        <Ghost className="h-4 w-4" />
      </div>
    );
  }
  if (image) {
    return (
      <Image
        src={image}
        alt={name ?? 'User'}
        width={32}
        height={32}
        className={`${s} rounded-full object-cover`}
      />
    );
  }
  return (
    <div className={`flex ${s} items-center justify-center rounded-full bg-primary/20 font-bold text-primary`}>
      {name ? name.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
    </div>
  );
}

const ACCOUNT_MENU = [
  { href: '/profile', label: 'Профайл', icon: User },
  { href: '/library', label: 'Миний сан', icon: Package },
  { href: '/orders', label: 'Захиалга', icon: ClipboardList },
  { href: '/wishlist', label: 'Хадгалсан', icon: Bookmark },
];

function MobileFeaturedProducts({ onClose }: { onClose: () => void }) {
  const { data: products = [] } = useFeaturedProducts();
  if (!products.length) return null;

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
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnailUrl} alt={p.title} className="h-full w-full object-cover" />
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
  const { data: posts = [] } = useLatestPosts();
  if (!posts.length) return null;

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
                // eslint-disable-next-line @next/next/no-img-element
                <img src={(post as any).coverImageUrl} alt={post.title} className="h-full w-full object-cover" />
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
  const [mobileSearchQ, setMobileSearchQ] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const cartCount = useCartStore((s) => s.items.length);
  const wishCount = useWishlistStore((s) => s.items.length);
  const { data: publicSettings, isLoading: settingsLoading } = usePublicSettings();
  const { data: menuItems = FALLBACK_NAV } = useMenuItems();

  const siteName = publicSettings?.siteName ?? 'DigitalGer';
  const logoSrc = publicSettings?.logoUrl ?? '/brand/logo.svg';
  const activeMenu = menuItems.length > 0 ? menuItems : FALLBACK_NAV;

  const isGuest =
    (session?.user as any)?.isGuest ??
    session?.user?.email?.endsWith('@guest.digitalger.mn') ??
    false;

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
    if (mobileSearchOpen && mobileSearchRef.current) {
      mobileSearchRef.current.focus();
    }
  }, [mobileSearchOpen]);

  useEffect(() => {
    setMobileSearchOpen(false);
    setMobileSearchQ('');
  }, [pathname]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQ.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQ.trim())}`);
    }
  };

  const onMobileSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (mobileSearchQ.trim()) {
      router.push(`/search?q=${encodeURIComponent(mobileSearchQ.trim())}`);
      setMobileSearchOpen(false);
      setMobileSearchQ('');
    }
  };

  const handleAccountClick = () => {
    if (session) {
      setUserMenuOpen((o) => !o);
    } else {
      setAuthOpen(true);
    }
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">

          {/* Mobile search overlay */}
          {mobileSearchOpen && (
            <form
              onSubmit={onMobileSearch}
              className="absolute inset-0 z-50 flex items-center gap-2 bg-background px-4 lg:hidden"
            >
              <button
                type="button"
                onClick={() => { setMobileSearchOpen(false); setMobileSearchQ(''); }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-muted"
                aria-label="Хаах"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="relative flex-1">
                <Input
                  ref={mobileSearchRef}
                  placeholder="Бүтээгдэхүүн, нийтлэл хайх..."
                  value={mobileSearchQ}
                  onChange={(e) => setMobileSearchQ(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Хайх"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          <Link href="/" className="flex shrink-0 items-center gap-2">
            {settingsLoading ? (
              <>
                <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />
                <div className="hidden h-4 w-24 animate-pulse rounded bg-muted sm:block" />
              </>
            ) : (
              <>
                <Image
                  src={logoSrc}
                  alt={siteName}
                  width={36}
                  height={36}
                  className="h-9 w-9"
                  priority
                />
                <span className="font-bold text-primary">{siteName}</span>
              </>
            )}
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

          <form onSubmit={onSearch} className="hidden max-w-xs flex-1 lg:flex">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Хайх..."
                className="pl-9"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />
            </div>
          </form>

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

            {/* Theme toggle */}
            <ThemeToggle />

            <Button variant="ghost" size="icon" asChild>
              <Link href="/wishlist" className="relative">
                <Heart className="h-5 w-5" />
                {wishCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {wishCount}
                  </span>
                )}
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href="/checkout" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {cartCount}
                  </span>
                )}
              </Link>
            </Button>

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
                      {isGuest ? 'Зочин' : (session.user?.name ?? 'Хэрэглэгч')}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {isGuest ? 'Зочин бүртгэл' : session.user?.email}
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
                    onClick={() => { setUserMenuOpen(false); signOut({ callbackUrl: '/' }); }}
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
              {settingsLoading ? (
                <>
                  <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                </>
              ) : (
                <>
                  <Image src={logoSrc} alt={siteName} width={32} height={32} className="h-8 w-8" />
                  <SheetTitle className="text-base font-bold text-primary">{siteName}</SheetTitle>
                </>
              )}
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
            {/* Navigation links */}
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

            {/* Theme toggle */}
            <div className="px-3 py-1 border-t border-border mt-1">
              <ThemeToggle iconOnly={false} />
            </div>

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
      />
    </>
  );
}
