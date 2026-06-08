'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CreditCard,
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
  MessageSquare,
  Navigation,
  Package,
  Settings,
  ShoppingCart,
  Star,
  Tag,
  User,
  Users,
  Activity,
} from 'lucide-react';
import { useState } from 'react';
import { Button, Separator, ThemeToggle } from '@digitalger/shared/ui';
import { cn } from '@digitalger/shared';
import { API_URL } from '@/lib/constants';
import { adminApi } from '@/lib/api';

const navItems = [
  { href: '/', label: 'Хяналтын самбар', icon: LayoutDashboard },
  { href: '/products', label: 'Бүтээгдэхүүн', icon: Package },
  { href: '/product-types', label: 'Бүтээгдэхүүний төрөл', icon: Layers },
  { href: '/categories', label: 'Ангилал', icon: FolderTree },
  { href: '/orders', label: 'Захиалга', icon: ShoppingCart },
  { href: '/users', label: 'Хэрэглэгч', icon: Users },
  { href: '/payments', label: 'Төлбөр', icon: CreditCard },
  { href: '/coupons', label: 'Купон', icon: Tag },
  { href: '/subscribers', label: 'Subscriber', icon: Mail },
  { href: '/banners', label: 'Баннер', icon: Images },
  { href: '/faqs', label: 'FAQ', icon: HelpCircle },
  { href: '/testimonials', label: 'Сэтгэгдэл', icon: MessageSquare },
  { href: '/reviews', label: 'Үнэлгээ', icon: Star },
  { href: '/menu', label: 'Навигац', icon: Navigation },
  { href: '/blog', label: 'Нийтлэл', icon: FileText },
  { href: '/pages', label: 'Хуудас', icon: FileEdit },
  { href: '/settings', label: 'Тохиргоо', icon: Settings },
  { href: '/seo', label: 'SEO', icon: Globe },
  { href: '/queue', label: 'Дараалал', icon: Activity },
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

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  }

  const { data: publicSettings } = usePublicSettings();
  const { data: profile } = useAdminProfile();

  const siteName = publicSettings?.siteName ?? 'DigitalGer';
  const logoUrl = publicSettings?.logoUrl ?? null;
  const userName = profile?.name ?? 'Admin';
  const userInitial = (profile?.name ?? profile?.email ?? 'A').charAt(0).toUpperCase();
  const userImage = profile?.image ?? null;

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          'sticky top-0 flex h-screen flex-col border-r border-border bg-card transition-all duration-300',
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

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active =
              href === '/'
                ? pathname === '/'
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-r-lg py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary rounded-l-none'
                    : 'rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground',
                  collapsed ? 'justify-center px-2' : 'px-3',
                )}
                style={active ? { borderLeft: '3px solid oklch(0.847 0.178 85.87)' } : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
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
