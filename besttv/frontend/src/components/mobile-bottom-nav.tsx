'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, Home, LayoutGrid, LogIn, Search, User } from 'lucide-react';
import { cn } from '@besttv/shared';
import { useAuth } from '@/lib/auth-store';
import { loginUrl } from '@/lib/auth-intent';

/**
 * Мобайл доод цэс (bottom navigation) — бүтэн брэндийн дэвсгэртэй 5 таб.
 *
 * ⚠️ ЗӨВХӨН МОБАЙЛД (`md:hidden`) — desktop дээр navbar хангалттай.
 * ⚠️ Энэ нь `layout/mobile-nav.tsx`-ыг ОРЛОНО (site-chrome-д нэг л
 *    доод цэс байх ёстой, эс бөгөөс хоёр мөр давхарлана).
 */

interface Tab {
  href: string;
  label: string;
  icon: typeof Home;
  /** Идэвхтэй эсэхийг зам дээр үндэслэн шийдэх (query-тай таб-д хэрэгтэй) */
  isActive: (pathname: string, search: string) => boolean;
}

/**
 * ⚠️ ЗАМУУДЫГ БОДИТ ROUTE-Д ТААРУУЛСАН:
 *   - `/series` нь `/movies` руу redirect хийдэг (тусдаа "Цуврал" хуудас
 *     ЗОРИУДААР хасагдсан — "кино" нь нэг ангит + олон ангит хоёуланг
 *     агуулна). Тиймээс "ЦУВРАЛ" таб оронд "ХАЙХ" таб авав — эс бөгөөс
 *     3 таб ижил хуудас руу заана.
 *   - "ТӨРӨЛ" = жанрын шүүлт. Тусдаа хуудас БАЙХГҮЙ тул `/movies` дээрх
 *     жанрын чипс рүү `?genre=` query-гүйгээр биш, `#genres` биш —
 *     `/movies` дээрх шүүлтийн хэсэг рүү заана.
 */
const TABS: Tab[] = [
  {
    href: '/',
    label: 'НҮҮР',
    icon: Home,
    isActive: (p) => p === '/',
  },
  {
    href: '/movies',
    label: 'КИНО',
    icon: Film,
    // ⚠️ Жанр сонгоогүй үед л "Кино" идэвхтэй — сонгосон бол "Төрөл" идэвхжинэ
    isActive: (p, s) => p === '/movies' && !s,
  },
  {
    href: '/movies?genre=',
    label: 'ТӨРӨЛ',
    icon: LayoutGrid,
    isActive: (p, s) => p === '/movies' && !!s,
  },
  {
    href: '/search',
    label: 'ХАЙХ',
    icon: Search,
    isActive: (p) => p.startsWith('/search'),
  },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Player хуудсанд бүтэн дэлгэц — доод цэс саад болно
  if (pathname.startsWith('/watch')) return null;

  /**
   * ⚠️ `useSearchParams` ХЭРЭГЛЭХГҮЙ: тэр нь бүх хуудсыг Suspense/CSR
   * bailout руу түлхдэг (static хуудсуудын хурд алдагдана). Доод цэсэнд
   * жанр сонгосон эсэхийг мэдэхэд `window.location.search` хангалттай —
   * hydration-ы дараа зөв утга авна.
   */
  const search = typeof window === 'undefined' ? '' : window.location.search;

  // Нэвтэрсэн бол "ПРОФАЙЛ", эс бөгөөс "НЭВТРЭХ" (буцах замыг санана)
  const authTab: Tab = user
    ? {
        href: '/profile',
        label: 'ПРОФАЙЛ',
        icon: User,
        isActive: (p) => p.startsWith('/profile'),
      }
    : {
        href: loginUrl(pathname),
        label: 'НЭВТРЭХ',
        icon: LogIn,
        isActive: (p) => p.startsWith('/login'),
      };

  const tabs = [...TABS, authTab];

  return (
    <nav
      aria-label="Мобайл доод цэс"
      className="fixed inset-x-0 bottom-0 z-50 flex bg-primary text-primary-foreground pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(0,0,0,0.18)] md:hidden"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.isActive(pathname, search);
        return (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              /* ⚠️ `min-h-14` (56px) — хуруугаар хүрэх талбарын доод хязгаар */
              'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold leading-tight transition-opacity',
              active ? 'opacity-100' : 'opacity-70 hover:opacity-100',
            )}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 2} aria-hidden />
            <span className="truncate">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
