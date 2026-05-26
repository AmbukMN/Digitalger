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
import { SearchAutocomplete } from '@/components/layout/search-autocomplete';
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
  });
}

function useMenuItems() {
  return useQuery({
    queryKey: ['public', 'menu'],
    queryFn: () => menuApi.list(),
    staleTime: 2 * 60 * 1000,
  });
}

function useFeaturedProducts() {
  return useQuery({
    queryKey: ['public', 'featured-menu'],
    queryFn: () => productsApi.list({ featured: true, pageSize: 6 }).then((r) => r.items),
    staleTime: 5 * 60 * 1000,
    select: (items) => items.slice(0, 3),
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
  { href: '/library', label: 'Миний сан', icon: Package },
  { href: '/orders', label: 'Захиалгын түүх', icon: ClipboardList },
  { href: '/wishlist', label: 'Хадгалсан бүтээгдэхүүн', icon: Bookmark },
  { href: '/profile', label: 'Профайл', icon: User },
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
                  <Image src={p.thumbnailUrl} alt={p.title} fill className="object-cover" sizes="40px" />
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
                <Image src={(post as any).coverImageUrl} alt={post.title} fill className="object-cover" sizes="40px" />
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
  const cartCount = useCartStore((s) => s.items.length);
  const wishCount = useWishlistStore((s) => s.items.length);
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
  const { data: publicSettings, isLoading: settingsLoading } = usePublicSettings();
  const { data: menuItems, isLoading: menuLoading } = useMenuItems();

  const siteName = publicSettings?.siteName || 'DigitalGer';
  const logoSrc = publicSettings?.logoUrl || '/brand/logo.svg';
  const activeMenu = menuItems ?? [];

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
                background: 'color-mix(in oklch, var(--primary) 8%, var(--background))',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid color-mix(in oklch, var(--primary) 20%, transparent)',
              }}
            >
              <button
                type="button"
                onClick={() => setMobileSearchOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary/10 transition-colors"
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
            {settingsLoading ? (
              <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
            ) : (
              <Image
                src={logoSrc}
                alt={siteName || 'DigitalGer'}
                width={36}
                height={36}
                className="h-9 w-9"
                priority
              />
            )}
            {settingsLoading ? (
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            ) : (
              <span className="font-bold navbar-logo-text">{siteName || 'DigitalGer'}</span>
            )}
          </Link>

          <nav className="hidden flex-1 justify-center gap-1 md:flex">
            {menuLoading ? (
              <>
                {[80, 96, 72, 64, 88].map((w) => (
                  <div key={w} className={`h-8 w-${w === 80 ? '[80px]' : w === 96 ? '[96px]' : w === 72 ? '[72px]' : w === 64 ? '[64px]' : '[88px]'} rounded-lg bg-muted animate-pulse`} />
                ))}
              </>
            ) : (
              activeMenu.map((item) => {
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
              })
            )}
          </nav>

          <SearchAutocomplete
            placeholder="Хайх..."
            className="hidden max-w-xs flex-1 lg:block"
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

            {/* Theme toggle */}
            <ThemeToggle />

            <Button variant="ghost" size="icon" asChild>
              <Link href="/wishlist" className="relative">
                <Heart className="h-5 w-5" />
                {wishCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: 'oklch(0.847 0.178 85.87)', color: 'oklch(0.1 0.04 264)' }}>
                    {wishCount}
                  </span>
                )}
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href="/checkout" className="relative">
                <ShoppingCart className={cn('h-5 w-5 transition-transform', cartShake && 'cart-shake')} />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: 'oklch(0.847 0.178 85.87)', color: 'oklch(0.1 0.04 264)' }}>
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
              {settingsLoading ? (
                <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
              ) : (
                <Image src={logoSrc} alt={siteName || 'DigitalGer'} width={32} height={32} className="h-8 w-8" />
              )}
              {settingsLoading ? (
                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
              ) : (
                <SheetTitle className="text-base font-bold navbar-logo-text">{siteName || 'DigitalGer'}</SheetTitle>
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
                {menuLoading ? (
                  <>
                    {[100, 120, 90, 80, 110].map((w, i) => (
                      <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" style={{ width: `${w}px` }} />
                    ))}
                  </>
                ) : (
                  activeMenu.map((item) => {
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
                  })
                )}
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
