'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileEdit,
  FileText,
  FolderTree,
  Globe,
  HelpCircle,
  Images,
  LayoutDashboard,
  Layers,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  MessagesSquare,
  Navigation,
  Package,
  Settings,
  Shield,
  ShoppingCart,
  Star,
  Tag,
  User,
  Users,
  Activity,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Button, Separator, ThemeToggle } from '@digitalger/shared/ui';
import { cn } from '@digitalger/shared';
import { API_URL } from '@/lib/constants';
import { adminApi } from '@/lib/api';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Зөвхөн SUPERADMIN-д харагдах цэс (site-level / тохиргоо / staff). */
  superadminOnly?: boolean;
  /** Granular permission resource — ADMIN-д энэ resource-д canView=false бол цэс
   *  НУУГДАНА (өөрт хэрэггүй хэсгийг харахгүй). SUPERADMIN бүгдийг харна.
   *  resource заагаагүй цэс (Хяналтын самбар, Суралцагчийн асуулт) бүгдэд харагдана. */
  resource?: string;
}

interface NavSection {
  title: string;
  items: readonly NavItem[];
}

/**
 * Sidebar-ийн цэсүүдийг логик бүлгээр ангилав (Vercel/Stripe маягийн
 * enterprise бүтэц). Бүлэг тус бүр жижиг uppercase гарчигтай.
 */
const navSections: readonly NavSection[] = [
  {
    title: 'Үндсэн',
    items: [
      { href: '/', label: 'Хяналтын самбар', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Худалдаа',
    items: [
      { href: '/products', label: 'Бүтээгдэхүүн', icon: Package, resource: 'products' },
      { href: '/product-types', label: 'Бүтээгдэхүүний төрөл', icon: Layers, resource: 'product-types' },
      { href: '/categories', label: 'Ангилал', icon: FolderTree, resource: 'categories' },
      { href: '/orders', label: 'Захиалга', icon: ShoppingCart, resource: 'orders' },
      { href: '/payments', label: 'Төлбөр', icon: CreditCard, resource: 'orders' },
      // Таталт нь site-level — зөвхөн SUPERADMIN.
      { href: '/downloads', label: 'Таталт', icon: Download, superadminOnly: true },
      { href: '/coupons', label: 'Купон', icon: Tag, resource: 'coupons' },
    ],
  },
  {
    title: 'Хэрэглэгч',
    items: [
      // Staff management — зөвхөн SUPERADMIN.
      { href: '/users', label: 'Хэрэглэгч', icon: Users, superadminOnly: true },
      // Site-level marketing subscriber жагсаалт — зөвхөн SUPERADMIN.
      { href: '/subscribers', label: 'Subscriber', icon: Mail, superadminOnly: true },
      { href: '/reviews', label: 'Review', icon: Star, resource: 'reviews' },
      { href: '/testimonials', label: 'Testimonial', icon: MessageSquare, resource: 'testimonials' },
      // Суралцагчийн асуулт нь product-той холбоотой — бүгдэд (resource заахгүй).
      { href: '/lessons-questions', label: 'Суралцагчийн асуулт', icon: MessagesSquare },
    ],
  },
  {
    title: 'Контент',
    items: [
      { href: '/banners', label: 'Баннер', icon: Images, resource: 'banners' },
      { href: '/faqs', label: 'FAQ', icon: HelpCircle, resource: 'faqs' },
      { href: '/blog', label: 'Нийтлэл', icon: FileText, resource: 'blog' },
      { href: '/pages', label: 'Хуудас', icon: FileEdit, resource: 'pages' },
      { href: '/menu', label: 'Навигац', icon: Navigation, resource: 'menu' },
    ],
  },
  {
    title: 'Тохиргоо',
    items: [
      // Багийн админ (staff management + granular permission) — зөвхөн SUPERADMIN.
      { href: '/staff', label: 'Багийн админ', icon: Shield, superadminOnly: true },
      // Site-level тохиргоо / SEO / queue — зөвхөн SUPERADMIN.
      { href: '/settings', label: 'Тохиргоо', icon: Settings, superadminOnly: true },
      { href: '/seo', label: 'SEO', icon: Globe, superadminOnly: true },
      { href: '/queue', label: 'Дараалал', icon: Activity, superadminOnly: true },
    ],
  },
] as const;

interface PublicSettings {
  siteName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
}

function usePublicSettings() {
  return useQuery<PublicSettings>({
    queryKey: ['public', 'settings'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/settings/public`);
      if (!res.ok) throw new Error('settings fetch failed');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

interface ProfileData { name: string | null; email: string; image: string | null; role: string }

function useAdminProfile() {
  return useQuery<ProfileData>({
    queryKey: ['admin', 'profile'],
    queryFn: () => adminApi.profile.get().catch(() => ({ name: null, email: 'admin@digitalger.mn', image: null, role: 'ADMIN', id: '', emailVerified: null, createdAt: '', updatedAt: '' })),
    staleTime: 5 * 60 * 1000,
  });
}

function SiteLogo({ logoUrl, siteName, collapsed }: { logoUrl: string | null; siteName: string; collapsed: boolean }) {
  if (logoUrl) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg">
          <Image src={logoUrl} alt={siteName} fill className="object-contain" unoptimized />
        </div>
        {!collapsed && (
          <span className="truncate font-bold text-primary text-base">{siteName}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg">
        <Image src="/brand/logo.svg" alt={siteName} fill className="object-contain" unoptimized />
      </div>
      {!collapsed && (
        <span className="truncate font-bold text-primary text-base">{siteName}</span>
      )}
    </div>
  );
}

/** Active эсэхийг тооцох — root зөвхөн яг таарвал, бусад нь prefix-ээр. */
function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/**
 * Бүлэглэсэн навигацийн жагсаалт — desktop sidebar болон mobile drawer
 * хоёуланд хуваалцаж ашиглана. Collapse үед бүлгийн гарчиг нуугдаж зөвхөн
 * icon үлдэнэ; бүлэг хооронд нимгэн зураас гарч ирнэ.
 */
function NavSections({
  pathname,
  collapsed,
  onNavigate,
  isSuperadmin,
}: {
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
  /** SUPERADMIN эсэх — superadminOnly цэсүүдийг харуулах эсэхийг шийднэ. */
  isSuperadmin: boolean;
}) {
  const queryClient = useQueryClient();
  // ── УНШААГҮЙ суралцагчийн асуултын тоо (sidebar badge мэдэгдэл) ──
  const { data: qStats } = useQuery({
    queryKey: ['admin', 'lessons-questions', 'unread-count'],
    queryFn: () => adminApi.products.questions.list({ pageSize: 1 }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
  const unansweredCount = qStats?.unreadTotal ?? 0;

  // ── Бусад хэсгийн "шинэ" badge (Захиалга/Хэрэглэгч/Subscriber/Review/Төлбөр) ──
  // admin сүүлд харснаас хойш үүссэн шинэ бичлэгийн тоо. 30 сек poll + focus.
  const { data: sidebarBadges } = useQuery({
    queryKey: ['admin', 'sidebar-badges'],
    queryFn: () => adminApi.sidebar.getBadges(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });

  // ── Нэвтэрсэн админы permission (resource бүрд canView) — цэс шүүхэд ──
  // ADMIN-д өөрт олгогдсон resource л харна. SUPERADMIN бол шаардлагагүй (бүгд).
  const { data: myPerms } = useQuery({
    queryKey: ['admin', 'my-permissions'],
    queryFn: () => adminApi.staff.myPermissions(),
    staleTime: 5 * 60_000,
    enabled: !isSuperadmin,
  });
  // resource-д canView эрхтэй эсэх. SUPERADMIN бүгдэд true; perm ачаалж дуустал
  // (myPerms undefined) НУУНА (анивчиж гарч ирэхээс сэргийлж — аюулгүй default).
  const canViewResource = (resource?: string): boolean => {
    if (!resource) return true; // resource заагаагүй цэс бүгдэд (dashboard, асуулт)
    if (isSuperadmin) return true;
    if (!myPerms) return false; // ачаалж байх хооронд нуух
    return myPerms[resource]?.view === true;
  };

  // href → (section нэр, шинэ тоо). lessons-questions нь өөрийн unanswered-аас.
  const badgeFor = (href: string): { section: string | null; count: number } => {
    switch (href) {
      case '/orders': return { section: 'orders', count: sidebarBadges?.orders ?? 0 };
      case '/users': return { section: 'users', count: sidebarBadges?.users ?? 0 };
      case '/subscribers': return { section: 'subscribers', count: sidebarBadges?.subscribers ?? 0 };
      case '/reviews': return { section: 'reviews', count: sidebarBadges?.reviews ?? 0 };
      case '/payments': return { section: 'payments', count: sidebarBadges?.payments ?? 0 };
      case '/lessons-questions': return { section: null, count: unansweredCount };
      default: return { section: null, count: 0 };
    }
  };

  // Хэсэг дарахад тэр хэсгийг "харсан" болгоно → badge цэвэрлэнэ (optimistic refetch).
  const markSectionSeen = (section: string | null) => {
    if (!section) return; // lessons-questions нь dialog нээхэд өөрөө цэвэрлэгддэг
    adminApi.sidebar
      .markSeen(section)
      .then(() => queryClient.invalidateQueries({ queryKey: ['admin', 'sidebar-badges'] }))
      .catch(() => {});
  };

  // Цэс шүүх: (1) superadminOnly → зөвхөн SUPERADMIN, (2) resource permission →
  // ADMIN-д canView=false resource НУУГДАНА (өөрт хэрэггүй хэсгийг харахгүй).
  // Бүх цэс нуугдвал тухайн бүлгийг бүхэлд нь хасна.
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          (isSuperadmin || !item.superadminOnly) && canViewResource(item.resource),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <nav className="flex-1 overflow-y-auto p-2">
      {visibleSections.map((section, sectionIdx) => (
        <div
          key={section.title}
          className={cn(
            sectionIdx > 0 && (collapsed ? 'mt-2 border-t border-border pt-2' : 'mt-4'),
          )}
        >
          {/* Бүлгийн гарчиг — зөвхөн expanded үед */}
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70"
              >
                {section.title}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="space-y-0.5">
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              // Тухайн цэсний "шинэ" тоо (orders/users/subscribers/reviews/payments/
              // lessons-questions). 0 бол badge харагдахгүй.
              const { section: badgeSection, count } = badgeFor(href);
              const showBadge = count > 0;
              return (
                <Link
                  key={href}
                  href={href}
                  // Тухайн хэсгийг нээхэд "харсан" болгож badge цэвэрлэнэ.
                  onClick={() => {
                    markSectionSeen(badgeSection);
                    onNavigate?.();
                  }}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'relative flex items-center gap-3 rounded-r-lg py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary rounded-l-none'
                      : 'rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground',
                    collapsed ? 'justify-center px-2' : 'px-3',
                  )}
                  style={active ? { borderLeft: '3px solid oklch(0.847 0.178 85.87)' } : undefined}
                >
                  <span className="relative shrink-0">
                    <Icon className="h-4 w-4" />
                    {/* Collapsed үед icon дээр улаан цэг (тоо багтахгүй) */}
                    {showBadge && collapsed && (
                      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-card" />
                    )}
                  </span>
                  {!collapsed && <span className="truncate">{label}</span>}
                  {/* Expanded үед тоо badge (баруун талд, 99+ хязгаар) */}
                  {showBadge && !collapsed && (
                    <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-bold tabular-nums text-white">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Замбараа солигдоход mobile drawer хаах
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  }

  const { data: publicSettings } = usePublicSettings();
  const { data: profile } = useAdminProfile();

  // SUPERADMIN бол site-level цэсүүд (Хэрэглэгч/Тохиргоо/SEO/Дараалал/
  // Subscriber/Таталт) харагдана. EDITOR/ADMIN-д зөвхөн контент+scope цэс.
  const isSuperadmin = profile?.role === 'SUPERADMIN';

  // ── PAGE-LEVEL GUARD: ADMIN эрхгүй page-д шууд URL-аар орвол → /(dashboard) redirect ──
  // sidebar нуусан ч URL шууд бичих/bookmark-аас хамгаална (backend ч 403 хийнэ).
  const { data: guardPerms } = useQuery({
    queryKey: ['admin', 'my-permissions'],
    queryFn: () => adminApi.staff.myPermissions(),
    staleTime: 5 * 60_000,
    enabled: !!profile && !isSuperadmin, // SUPERADMIN бол guard хэрэггүй
  });
  useEffect(() => {
    if (!profile || isSuperadmin) return; // SUPERADMIN бүх хуудсанд хандана
    // Route → шалгах төрөл. SUPERADMIN-only route эсвэл resource permission.
    const SUPERADMIN_ROUTES = ['/users', '/subscribers', '/downloads', '/staff', '/settings', '/seo', '/queue', '/theme', '/media'];
    const ROUTE_RESOURCE: { prefix: string; resource: string }[] = [
      { prefix: '/products', resource: 'products' },
      { prefix: '/product-types', resource: 'product-types' },
      { prefix: '/categories', resource: 'categories' },
      { prefix: '/orders', resource: 'orders' },
      { prefix: '/payments', resource: 'orders' },
      { prefix: '/coupons', resource: 'coupons' },
      { prefix: '/banners', resource: 'banners' },
      { prefix: '/faqs', resource: 'faqs' },
      { prefix: '/blog', resource: 'blog' },
      { prefix: '/pages', resource: 'pages' },
      { prefix: '/menu', resource: 'menu' },
      { prefix: '/reviews', resource: 'reviews' },
      { prefix: '/testimonials', resource: 'testimonials' },
    ];
    // SUPERADMIN-only route → ADMIN хандах эрхгүй.
    if (SUPERADMIN_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
      router.replace('/');
      return;
    }
    // Resource route → permission ачаалсны дараа canView шалгах.
    const match = ROUTE_RESOURCE.find(
      (r) => pathname === r.prefix || pathname.startsWith(r.prefix + '/'),
    );
    if (match && guardPerms && guardPerms[match.resource]?.view !== true) {
      router.replace('/'); // эрхгүй resource → dashboard
    }
  }, [pathname, profile, isSuperadmin, guardPerms, router]);

  const siteName = publicSettings?.siteName ?? 'DigitalGer';
  const logoUrl = publicSettings?.logoUrl ?? null;
  const userName = profile?.name ?? 'Admin';
  const userInitial = (profile?.name ?? profile?.email ?? 'A').charAt(0).toUpperCase();
  const userImage = profile?.image ?? null;

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          'sticky top-0 hidden h-screen flex-col border-r border-border bg-card transition-all duration-300 md:flex',
          collapsed ? 'w-18' : 'w-64',
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          {collapsed ? (
            /* Collapsed: show only expand button, centered */
            <Button
              variant="ghost"
              size="icon"
              className="mx-auto shrink-0"
              onClick={() => setCollapsed(false)}
              aria-label="Нээх"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            /* Expanded: logo + collapse button */
            <>
              <Link href="/" className="min-w-0 flex-1">
                <SiteLogo logoUrl={logoUrl} siteName={siteName} collapsed={false} />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto shrink-0"
                onClick={() => setCollapsed(true)}
                aria-label="Хураах"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <NavSections pathname={pathname} collapsed={collapsed} isSuperadmin={isSuperadmin} />

        <div className="border-t border-border p-2">
          <Link
            href="/account"
            title={collapsed ? 'Профайл' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-r-lg py-2 text-sm font-medium transition-colors',
              pathname === '/account'
                ? 'bg-primary/10 text-primary rounded-l-none'
                : 'rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground',
              collapsed ? 'justify-center px-2' : 'px-3',
            )}
            style={pathname === '/account' ? { borderLeft: '3px solid oklch(0.847 0.178 85.87)' } : undefined}
          >
            {userImage ? (
              <Image
                src={userImage}
                alt={userName}
                width={24}
                height={24}
                className="h-6 w-6 shrink-0 rounded-full object-cover ring-2 ring-primary/20"
                unoptimized
              />
            ) : (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                {userInitial}
              </div>
            )}
            {!collapsed && (
              <span className="truncate">Профайл</span>
            )}
          </Link>
        </div>
      </aside>

      {/* ─── Mobile drawer ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            {/* Panel */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-border bg-card shadow-xl"
            >
              <div className="flex h-14 items-center gap-2 border-b border-border px-4">
                <Link href="/" className="min-w-0 flex-1" onClick={() => setMobileOpen(false)}>
                  <SiteLogo logoUrl={logoUrl} siteName={siteName} collapsed={false} />
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Хаах"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <NavSections
                pathname={pathname}
                collapsed={false}
                onNavigate={() => setMobileOpen(false)}
                isSuperadmin={isSuperadmin}
              />

              <div className="border-t border-border p-2">
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-r-lg px-3 py-2 text-sm font-medium transition-colors',
                    pathname === '/account'
                      ? 'bg-primary/10 text-primary rounded-l-none'
                      : 'rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  style={pathname === '/account' ? { borderLeft: '3px solid oklch(0.847 0.178 85.87)' } : undefined}
                >
                  {userImage ? (
                    <Image
                      src={userImage}
                      alt={userName}
                      width={24}
                      height={24}
                      className="h-6 w-6 shrink-0 rounded-full object-cover ring-2 ring-primary/20"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                      {userInitial}
                    </div>
                  )}
                  <span className="truncate">Профайл</span>
                </Link>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Цэс нээх"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          <Button variant="ghost" size="icon" aria-label="Мэдэгдэл">
            <Bell className="h-4 w-4" />
          </Button>

          <ThemeToggle />

          <Separator orientation="vertical" className="h-6" />

          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMenuOpen((o) => !o)}
              className="gap-2"
            >
              {userImage ? (
                <Image src={userImage} alt={userName} width={20} height={20} className="h-5 w-5 rounded-full object-cover shrink-0" unoptimized />
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary shrink-0">
                  {userInitial}
                </div>
              )}
              <span className="hidden max-w-30 truncate sm:inline text-sm">{userName}</span>
            </Button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden
                />
                <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-border bg-popover p-1 shadow-lg">
                  <div className="flex items-center gap-2.5 px-3 py-2">
                    {userImage ? (
                      <Image src={userImage} alt={userName} width={32} height={32} className="h-8 w-8 rounded-full object-cover shrink-0" unoptimized />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                        {userInitial}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{userName}</p>
                      <p className="text-xs text-muted-foreground truncate">{profile?.email ?? 'admin@digitalger.mn'}</p>
                    </div>
                  </div>
                  <Separator className="my-1" />
                  <Link
                    href="/account"
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => setMenuOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    Миний бүртгэл
                  </Link>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                    onClick={() => { setMenuOpen(false); void handleSignOut(); }}
                  >
                    <LogOut className="h-4 w-4" />
                    Гарах
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
