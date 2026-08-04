'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Crown, LogOut, Search, User } from 'lucide-react';
import { cn } from '@besttv/shared';
import { BrandLogo } from '@besttv/shared/ui';
import { useAuth, hasPremium } from '@/lib/auth-store';
import { useBrand } from '@/lib/queries';
import { loginUrl } from '@/lib/auth-intent';

const NAV_LINKS = [
  { href: '/', label: 'Нүүр' },
  { href: '/movies', label: 'Кино' },
  { href: '/my-list', label: 'Миний дуртай' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { data: brand } = useBrand();
  const logoUrl = brand?.logoUrl ?? null;
  const siteName = brand?.siteName ?? 'BestTV';
  const router = useRouter();
  const { user, logout, loading: authLoading } = useAuth();
  const premium = hasPremium(user);
  /** Идэвхтэй багцууд — VIP байвал бусад нь илүүдэл тул нуугдана */
  const activePlans = (user?.subscriptions ?? []).filter((s) => !s.supersededByVip);
  const vip = activePlans.some((s) => s.isVip);
  /** Хамгийн ойр дуусах огноо — "9/29" хэлбэрээр */
  const planExpiry = (() => {
    const dates = activePlans.map((s) => new Date(s.expiresAt).getTime()).filter(Boolean);
    if (!dates.length) return null;
    const d = new Date(Math.min(...dates));
    return `${d.getMonth() + 1}/${d.getDate()}`;
  })();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  // Dropdown гадуур дарахад/Esc-д хаагдана (UX стандарт)
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const initial = (user?.name?.[0] ?? user?.email?.[0] ?? 'Х').toUpperCase();

  return (
    <header
      className={cn(
        'fixed top-0 inset-x-0 z-50 transition-all duration-300',
        scrolled ? 'navbar-solid' : 'navbar-transparent',
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-60 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        Үндсэн контент руу шилжих
      </a>
      {/*
        ⚠️ МОБАЙЛД БАГТААХ: gap-6 нь утсан дээр хэт өргөн байсан тул логоны
        баруун тал (хайх + багц + профайл) дэлгэцнээс хальж байв.
        Мобайлд gap-2 + px-3, лого арай жижиг.
      */}
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-2 px-3 sm:gap-4 md:gap-6 md:px-8">
        <Link href="/" className="flex shrink-0 items-center" aria-label={`${siteName} нүүр`}>
          <BrandLogo logoUrl={logoUrl} siteName={siteName} imgClassName="h-7 w-auto sm:h-9" />
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm" aria-label="Үндсэн цэс">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? 'page' : undefined}
              className={cn(
                'rounded-full px-3.5 py-1.5 transition-colors',
                pathname === l.href
                  ? 'bg-white/12 text-white font-semibold'
                  : 'text-white/65 hover:text-white hover:bg-white/6',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Desktop search */}
        <div className="hidden md:flex items-center">
          <AnimatePresence initial={false} mode="wait">
            {searchOpen ? (
              <motion.form
                key="search-open"
                onSubmit={submitSearch}
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 260, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onBlur={() => !query && setSearchOpen(false)}
                  placeholder="Кино хайх..."
                  aria-label="Хайх"
                  className="w-full rounded-full border border-white/20 bg-black/60 px-4 py-1.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-primary"
                />
              </motion.form>
            ) : (
              <motion.button
                key="search-icon"
                onClick={() => setSearchOpen(true)}
                className="rounded-full p-2 text-white/75 hover:bg-white/8 hover:text-white"
                aria-label="Хайх"
              >
                <Search size={19} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Мобайл search icon (bottom nav-д Хайх таб байгаа ч navbar-аас хурдан хандалт) */}
        <Link href="/search" className="rounded-full p-2 text-white/75 md:hidden" aria-label="Хайх">
          <Search size={19} />
        </Link>

        {/*
          ⚠️ ЭХНИЙ АЧААЛАЛТ — `authLoading` үед skeleton.

          Өмнө нь `user` нь эхлээд `null` байдаг тул "Нэвтрэх" товч гарч
          ирээд, сервер хариулмагц гэнэт "Профайл + Багц" болж СОЛИГДДОГ
          байсан. Удаан интернетэд энэ нь хэдэн секунд үргэлжилж, хэрэглэгч
          "эвдэрсэн" гэж боддог.

          Одоо: (1) localStorage кэшнээс шууд сэргээнэ (ихэнх тохиолдолд
          skeleton огт харагдахгүй), (2) кэшгүй бол skeleton — хуурамч
          товч ХАРУУЛАХГҮЙ.
        */}
        {authLoading ? (
          <div className="flex items-center gap-2 sm:gap-3" aria-hidden>
            <span className="skeleton-shimmer h-7 w-20 rounded-full sm:w-24" />
            <span className="skeleton-shimmer h-8 w-8 rounded-full sm:h-9 sm:w-9" />
          </div>
        ) : user ? (
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {/*
              ⚠️ МОБАЙЛД ч харагдана (өмнө нь `hidden sm:inline-flex` байсан).
                - Багцгүй → "Багц авах" товч
                - Багцтай → идэвхтэй багцын нэр + дуусах огноо
            */}
            {premium ? (
              <Link
                href="/profile"
                title={
                  activePlans.length > 1
                    ? activePlans.map((p) => p.planName).join(', ')
                    : undefined
                }
                className={cn(
                  // ⚠️ 46vw нь мобайлд хэт өргөн — header дэлгэцнээс хальж байв
                  'inline-flex min-w-0 max-w-[30vw] items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-all sm:max-w-none sm:gap-1.5 sm:px-3.5 sm:text-xs',
                  vip
                    ? 'bg-premium text-premium-foreground hover:brightness-110'
                    : 'bg-white/10 text-white hover:bg-white/16',
                )}
              >
                <Crown size={13} className="shrink-0" />
                <span className="truncate">
                  {vip ? 'VIP' : (activePlans[0]?.planName ?? 'Багц')}
                  {activePlans.length > 1 && ` +${activePlans.length - 1}`}
                </span>
                {planExpiry && (
                  <span className="hidden shrink-0 font-medium opacity-70 sm:inline">
                    · {planExpiry}
                  </span>
                )}
              </Link>
            ) : (
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 rounded-full bg-premium px-3 py-1.5 text-xs font-bold text-premium-foreground transition-all hover:brightness-110 hover:shadow-lg hover:shadow-premium/25 sm:px-3.5"
              >
                <Crown size={13} /> Багц авах
              </Link>
            )}

            {/* Avatar dropdown */}
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Хэрэглэгчийн цэс"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className={cn(
                  'relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white ring-2 transition-all',
                  premium ? 'bg-premium/90 text-premium-foreground ring-premium/40' : 'bg-primary ring-white/15',
                  menuOpen && 'ring-white/40',
                )}
              >
                {user.avatarUrl ? (
                  <Image src={user.avatarUrl} alt="" fill sizes="36px" className="object-cover" />
                ) : (
                  initial
                )}
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="glass absolute right-0 top-12 w-60 overflow-hidden rounded-xl shadow-2xl"
                  >
                    <div className="border-b border-white/8 px-4 py-3">
                      <p className="truncate text-sm font-semibold text-white">
                        {user.name ?? 'Хэрэглэгч'}
                      </p>
                      <p className="truncate text-xs text-white/50">{user.email}</p>
                      {premium && (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-premium/15 px-2 py-0.5 text-[10px] font-bold text-premium">
                          <Crown size={10} /> {user.subscription!.planName}
                        </span>
                      )}
                    </div>
                    <div className="py-1.5">
                      <MenuItem href="/profile" icon={<User size={15} />} label="Миний профайл" />
                      <MenuItem href="/my-list" icon={<Heart size={15} />} label="Дуртай кино" />
                      {/*
                        ⚠️ VIP бол бүх ангилал нээлттэй тул нуухаас БУСАД
                        тохиолдолд ҮРГЭЛЖ харуулна. Өмнө нь `!premium` байсан
                        тул нэг багцтай хэрэглэгч НЭМЭЛТ багц авах гарцгүй
                        болж, зөвхөн footer-ийн линк үлддэг байв.
                      */}
                      {!vip && (
                        <MenuItem
                          href="/pricing"
                          icon={<Crown size={15} />}
                          label={premium ? 'Багц нэмэх / сунгах' : 'Багц авах'}
                        />
                      )}
                      <button
                        role="menuitem"
                        onClick={() => {
                          logout();
                          setMenuOpen(false);
                          router.push('/');
                        }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-white/70 hover:bg-white/8 hover:text-white"
                      >
                        <LogOut size={15} /> Гарах
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <Link
            // ⚠️ Одоогийн хуудсыг санаж, нэвтэрсний дараа буцаана
            href={loginUrl(pathname)}
            className="rounded-full bg-primary px-5 py-1.5 text-sm font-semibold text-white transition-all hover:brightness-110 hover:shadow-lg hover:shadow-primary/30"
          >
            Нэвтрэх
          </Link>
        )}
      </div>
    </header>
  );
}

function MenuItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      role="menuitem"
      href={href}
      className="flex items-center gap-2.5 px-4 py-2 text-sm text-white/70 hover:bg-white/8 hover:text-white"
    >
      {icon} {label}
    </Link>
  );
}
