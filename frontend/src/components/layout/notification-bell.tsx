'use client';

// ─── Notification Bell (navbar 🔔) ────────────────────────────────────────
// Зөвхөн нэвтэрсэн хэрэглэгчид харагдана. unreadCount-ийг 30с тутам polling-оор
// шинэчилнэ. Дарахад сүүлийн мэдэгдлүүдийг dropdown-д харуулна (cart/wishlist
// icon-той ижил стиль). Анимаци зөөлөн (CSS fade/scale).
//
// ⚠️ shadcn-д Popover/DropdownMenu shared package-д байхгүй тул navbar-ийн
// account dropdown-той ИЖИЛ pattern (useRef + outside-click) ашиглав — нэгдсэн
// стиль, нэмэлт dependency-гүй.

import { cn } from '@digitalger/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Bell,
  BookOpen,
  CheckCheck,
  Megaphone,
  Shield,
  Ticket,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { notificationsApi, type NotificationItem } from '@/lib/api';

// type → icon (UI-д ялгахад)
function NotifIcon({ type }: { type: string }) {
  const cls = 'h-4 w-4';
  switch (type) {
    case 'order':
      return <ShoppingCart className={cls} />;
    case 'certificate':
      return <Award className={cls} />;
    case 'lesson':
      return <BookOpen className={cls} />;
    case 'coupon':
      return <Ticket className={cls} />;
    case 'security':
      return <Shield className={cls} />;
    case 'marketing':
      return <Megaphone className={cls} />;
    default:
      return <Sparkles className={cls} />;
  }
}

// Энгийн харьцангуй хугацаа (Монгол)
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'дөнгөж сая';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} цаг`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} өдөр`;
  return new Date(iso).toLocaleDateString('mn-MN');
}

export function NotificationBell() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const enabled = !!token;
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Уншаагүй тоо — 30с тутам polling (зөвхөн нэвтэрсэн үед)
  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.unreadCount(token!),
    enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
  const unreadCount = unread?.count ?? 0;

  // Жагсаалт — dropdown нээгдсэн үед л татна
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list(token!, 10),
    enabled: enabled && open,
    staleTime: 5_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(token!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });

  // Гадуур дарахад хаах
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleClick(n: NotificationItem) {
    if (!n.read) markRead.mutate(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  // Нэвтрээгүй бол bell огт харагдахгүй
  if (!enabled) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
        aria-label="Мэдэгдэл"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
            style={{ backgroundColor: '#ffbe00', color: '#07101f' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 origin-top-right rounded-xl border border-border bg-popover shadow-lg animate-notif-dropdown">
          {/* Толгой */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold">Мэдэгдэл</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Бүгдийг уншсан
              </button>
            )}
          </div>

          {/* Жагсаалт */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Уншиж байна...
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Мэдэгдэл алга</p>
              </div>
            ) : (
              <ul className="py-1">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted',
                        !n.read && 'bg-primary/5',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          n.read ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary',
                        )}
                      >
                        <NotifIcon type={n.type} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'truncate text-sm',
                              n.read ? 'font-medium text-foreground' : 'font-semibold text-foreground',
                            )}
                          >
                            {n.title}
                          </span>
                          {!n.read && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="уншаагүй" />
                          )}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                          {n.body}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground/70">
                          {timeAgo(n.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
