'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { SiteNavbar } from '@/components/layout/site-navbar';
import { AuthModal } from '@/components/auth/auth-modal';
import { cn } from '@digitalger/shared';
import { Bookmark, ClipboardList, Package, User } from 'lucide-react';

const DASH_LINKS = [
  { href: '/library', label: 'Миний сан', icon: Package },
  { href: '/orders', label: 'Захиалга', icon: ClipboardList },
  { href: '/wishlist', label: 'Хадгалсан', icon: Bookmark },
  { href: '/profile', label: 'Профайл', icon: User },
];

const PROTECTED_PATHS = ['/library', '/orders', '/profile'];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();

  const requiresAuth = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
  const authOpen = requiresAuth && status !== 'loading' && !session;

  return (
    <>
      <SiteNavbar />
      <div className="mx-auto flex max-w-7xl gap-8 px-4 pt-8 sm:px-6 lg:px-8 pb-[calc(6rem+env(safe-area-inset-bottom,0))] md:pb-8">
        {/* Desktop sidebar */}
        <aside className="hidden w-48 shrink-0 md:block">
          <nav className="sticky top-24 space-y-1">
            {DASH_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile bottom tab bar — pb accounts for iPhone home indicator */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 md:hidden"
        style={{
          background: 'color-mix(in oklch, var(--primary) 6%, var(--background))',
          borderTop: '1.5px solid color-mix(in oklch, var(--primary) 28%, transparent)',
          boxShadow: '0 -4px 24px color-mix(in oklch, var(--primary) 12%, transparent)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="mx-auto flex max-w-lg">
          {DASH_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors',
                  active ? 'text-primary' : 'text-foreground/50 hover:text-foreground/80',
                )}
              >
                <div className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                  active && 'bg-primary/15',
                )}>
                  <Icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-foreground/50')} />
                </div>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Auth overlay for protected routes — smooth modal, no blank /login redirect */}
      <AuthModal
        open={authOpen}
        onClose={() => router.push('/')}
        defaultTab="login"
        callbackUrl={pathname}
      />
    </>
  );
}
