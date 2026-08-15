'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Gift,
  Building2, Clapperboard, CreditCard, FileText, GalleryHorizontalEnd, HelpCircle, Instagram, LayoutDashboard, LineChart, LogOut, Mail, Menu, MessageSquare, MessagesSquare, Palette, ScrollText, Search, Tags, Ticket, Users, Wallet, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@besttv/shared';
import { BrandLogo } from '@besttv/shared/ui';
import { useAdminAuth } from '@/lib/auth-store';
import { api } from '@/lib/api';
import { useBrand } from '@/lib/queries';

const NAV_GROUPS = [
  {
    label: 'Тойм',
    items: [
      // ⚠️ "Шинжилгээ" нь Хянах самбарын "Зан төлөв" таб болж НЭГТГЭГДСЭН
      // (хоёр хуудас тус бүр өөрийн range-тэй байсан тул давхар тохируулах
      //  шаардлагатай, ижил асуултад хариулахад хооронд нь үсэрдэг байв).
      { href: '/', label: 'Хянах самбар', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Контент',
    items: [
      { href: '/movies', label: 'Кино', icon: Clapperboard },
      { href: '/genres', label: 'Жанр', icon: Tags },
      { href: '/reviews', label: 'Сэтгэгдэл', icon: MessageSquare, section: 'reviews' },
      { href: '/blog', label: 'Блог', icon: FileText },
      { href: '/faqs', label: 'Түгээмэл асуулт', icon: HelpCircle },
      { href: '/pages', label: 'Хуудсууд', icon: ScrollText },
      /* ⚠️ Нүүрний ДУНД баннер — киноны hero carousel-ЭЭС ТУСДАА
         (тэр нь `/movies` дотор "Нүүрний баннер" тэмдэглэгээгээр) */
      { href: '/banners', label: 'Нүүрний баннер', icon: GalleryHorizontalEnd },
    ],
  },
  {
    label: 'Харилцаа',
    items: [
      { href: '/chat', label: 'Чат', icon: MessagesSquare, section: 'chat' },
      { href: '/email', label: 'Имэйл', icon: Mail, section: 'subscribers' },
      /* ⚠️ FB→IG хөндлөн нийтлэл — Meta нь хоёр сүлжээг холбосон ч
         автомат хуваалцахыг зөвшөөрдөггүй тул гараар хийдэг байсныг
         бөөнөөр хийх хэрэгсэл */
      { href: '/crosspost', label: 'FB → Instagram', icon: Instagram },
    ],
  },
  {
    label: 'Бизнес',
    items: [
      { href: '/plans', label: 'Багц', icon: Wallet },
      { href: '/coupons', label: 'Купон', icon: Ticket },
      /* ⚠️ Урамшуулал нь купоноос ТУСДАА — купон нь код бичдэг,
         урамшуулал нь автоматаар үйлчилдэг маркетингийн хэрэгсэл */
      { href: '/promotions', label: 'Урамшуулал', icon: Gift },
      { href: '/bank', label: 'Дансны төлбөр', icon: Building2 },
      { href: '/users', label: 'Хэрэглэгчид', icon: Users, section: 'users' },
      { href: '/payments', label: 'Төлбөр', icon: CreditCard, section: 'payments' },
    ],
  },
  {
    label: 'Тохиргоо',
    items: [
      { href: '/brand', label: 'Тохиргоо', icon: Palette },
      { href: '/seo', label: 'SEO', icon: Search },
    ],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { data: brand } = useBrand();
  const logoUrl = brand?.logoUrl ?? null;
  const siteName = brand?.siteName ?? 'BestTV';

  /**
   * Sidebar-ийн "уншаагүй" badge-ууд — 30 сек тутам шинэчилнэ.
   *
   * ⚠️ Хэсэг бүрийн тоо = тухайн хэсгийн `createdAt > lastSeenAt`. Админ
   * тэр хуудас руу орж харахад `markSeen` дуудагдаж badge цэвэрлэгдэнэ
   * (Gmail/Facebook загвар).
   */
  const { data: badges } = useQuery({
    queryKey: ['admin-badges'],
    queryFn: () => api<Record<string, number>>('/admin/notifications/badges'),
    enabled: !!user,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const qc = useQueryClient();
  const seenRef = useRef<string | null>(null);
  /** ⚠️ Мобайлд sidebar нь drawer — 264px хатуу эзэлбэл контент шахагдана */
  const [navOpen, setNavOpen] = useState(false);

  /**
   * Хуудас солигдоход тухайн хэсгийг "харсан" гэж тэмдэглэнэ.
   * ⚠️ `seenRef` — нэг хуудсанд НЭГ л удаа дуудна (re-render бүрд биш).
   */
  useEffect(() => {
    if (!user) return;
    const item = NAV_GROUPS.flatMap((g) => g.items).find(
      (i) => 'section' in i && i.section && pathname.startsWith(i.href),
    ) as { section?: string } | undefined;
    const section = item?.section;
    if (!section || seenRef.current === section) return;

    seenRef.current = section;
    api(`/admin/notifications/seen/${section}`, { method: 'POST' })
      .then(() => qc.invalidateQueries({ queryKey: ['admin-badges'] }))
      .catch(() => null);
  }, [pathname, user, qc]);

  // Хуудас солигдоход мобайл drawer хаагдана
  useEffect(() => setNavOpen(false), [pathname]);

  // Drawer нээлттэй үед арын гүйлт зогсоно (iOS-д ч ажиллана)
  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [navOpen]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return null;

  const initial = (user.name?.[0] ?? user.email[0]).toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      {/* ⚠️ Мобайл — drawer нээлттэй үеийн бүрхүүл (дарахад хаагдана) */}
      {navOpen && (
        <button
          onClick={() => setNavOpen(false)}
          aria-label="Цэс хаах"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}
      {/*
        ⚠️ `sticky top-0 h-dvh` — цэс урт болоход (Тохиргоо/SEO хүртэл) доод
        талын профайл/гарах хайрцаг дэлгэцээс ХАЛИАД алга болдог байсан.
        Одоо sidebar нь дэлгэцийн өндөрт тогтож, зөвхөн ЦЭС нь гүйнэ.
      */}
      <aside
        className={cn(
          // ⚠️ Мобайл: fixed drawer (гулсаж гарна). Десктоп (lg+): ХЭВЭЭР sticky.
          'fixed inset-y-0 left-0 z-50 flex h-dvh w-64 shrink-0 flex-col border-r border-border bg-card px-3 py-5 transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-7 flex items-center gap-2 px-2">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2">
            <BrandLogo
              logoUrl={logoUrl}
              siteName={siteName}
              imgClassName="h-8 w-auto"
              textSize="text-lg"
            />
            <span className="text-sm font-normal text-muted-foreground">Admin</span>
          </Link>
          <button
            onClick={() => setNavOpen(false)}
            aria-label="Цэс хаах"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto overscroll-contain pr-1">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'nav-active bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <Icon size={17} strokeWidth={active ? 2.4 : 2} /> {item.label}
                      {'section' in item &&
                        item.section &&
                        (badges?.[item.section] ?? 0) > 0 && (
                          <span
                            className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground"
                            title={`${badges![item.section!]} шинэ`}
                          >
                            {badges![item.section!] > 99 ? '99+' : badges![item.section!]}
                          </span>
                        )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer card */}
        <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-border bg-accent/40 p-2.5">
          {/* Дарж профайл засах руу шилжинэ */}
          <Link
            href="/profile"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md transition-opacity hover:opacity-80"
            title="Профайл засах"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{user.name ?? 'Админ'}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
            </div>
          </Link>
          <button
            onClick={() => {
              logout();
              router.push('/login');
            }}
            aria-label="Гарах"
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-x-hidden">
        {/* ⚠️ Мобайл толгой — цэс нээх товч (десктопд харагдахгүй) */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md lg:hidden">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Цэс нээх"
            className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Menu size={20} />
            {/* Аль нэг хэсэгт шинэ зүйл байвал цэг */}
            {Object.values(badges ?? {}).some((n) => n > 0) && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
            )}
          </button>
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2">
            <BrandLogo
              logoUrl={logoUrl}
              siteName={siteName}
              imgClassName="h-7 w-auto"
              textSize="text-base"
            />
          </Link>
        </div>

        {children}
      </div>
    </div>
  );
}
