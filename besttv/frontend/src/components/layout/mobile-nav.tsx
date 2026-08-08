'use client';

/**
 * ⚠️⚠️ ХЭРЭГЛЭГДЭХГҮЙ ФАЙЛ — `components/mobile-bottom-nav.tsx` ОРЛОСОН.
 *
 * `site-chrome.tsx` нь ЗӨВХӨН `MobileBottomNav`-ыг рендерлэдэг; энэ
 * компонентыг импортолсон газар НЭГ Ч БАЙХГҮЙ (grep-ээр шалгасан).
 *
 * ⚠️ ЗАСВАР ХИЙХ БОЛ `mobile-bottom-nav.tsx`-Д ХИЙНЭ — энд хийсэн
 * өөрчлөлт сайт дээр ОГТ гарахгүй. Энэ файл нь `--safe-bottom`,
 * `glass`, `min-h-12` гэсэн ӨӨР шийдэл агуулж байгаа тул андуурч
 * засах эрсдэлтэй.
 *
 * ⚠️ УСТГААГҮЙ — хэрэглэгчийн зөвшөөрөл шаардлагатай (төслийн дүрэм).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Clapperboard, Home, Search } from 'lucide-react';
import { cn } from '@besttv/shared';

const TABS = [
  { href: '/', label: 'Нүүр', icon: Home },
  { href: '/movies', label: 'Кино', icon: Clapperboard },
  { href: '/search', label: 'Хайх', icon: Search },
];

/** Мобайл bottom-tab navigation — стриминг апп-ын стандарт (hamburger-ээс илүү) */
export function MobileNav() {
  const pathname = usePathname();

  // Watch хуудсанд player бүтэн дэлгэц тул nav нуана
  if (pathname.startsWith('/watch/')) return null;

  // ⚠️ 4 таб — "Цуврал"-ыг цэснээс хассан (navbar-ын "Олон ангит"-тай хамт).
  // ⚠️ Шошго нь "Дуртай" (богино) — доод таб нарийн тул "Миний дуртай" 2 мөр
  // болж эвдэрнэ. Navbar/footer-т бүтэн нэр харагдана.
  // "Дуртай" нь ЗОЧИНД ч ажиллана (localStorage) тул үргэлж харагдана;
  // нэвтрэлт navbar-ын "Нэвтрэх" товчоор хийгдэнэ.
  const tabs = [...TABS, { href: '/my-list', label: 'Дуртай', icon: Heart }];

  return (
    <nav
      aria-label="Мобайл цэс"
      className="glass fixed inset-x-0 bottom-0 z-50 flex justify-around border-t border-foreground/10 pb-[var(--safe-bottom)] md:hidden"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              /* ⚠️ `min-h-12` — хүрэх талбар. Хэмжилтээр ердөө 18px байсан нь
                 хуруугаар оносон дарахад хэцүү (WCAG зөвлөмж ≥44px). */
              'flex min-h-12 flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors',
              active ? 'text-primary' : 'text-foreground/55',
            )}
          >
            <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
