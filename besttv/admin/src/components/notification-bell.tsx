'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Check,
  CreditCard,
  MessageSquare,
  Star,
  Ticket,
  UserPlus,
} from 'lucide-react';
import { cn, formatDate } from '@besttv/shared';
import { api } from '@/lib/api';

interface FeedItem {
  id: string;
  section: string;
  title: string;
  detail: string;
  at: string;
  href: string;
  unread: boolean;
}

const ICONS: Record<string, React.ReactNode> = {
  users: <UserPlus size={14} />,
  payments: <CreditCard size={14} />,
  reviews: <Star size={14} />,
  rentals: <Ticket size={14} />,
  chat: <MessageSquare size={14} />,
};

/** "5 мин өмнө" хэлбэрээр */
function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'дөнгөж сая';
  if (m < 60) return `${m} мин өмнө`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} цаг өмнө`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} хоног өмнө`;
  return formatDate(iso);
}

/**
 * Мэдэгдлийн хонх (topbar).
 *
 * ⚠️ Уншаагүй нь ТОДРУУЛЖ харагдана (цэнхэр цэг + өнгөт дэвсгэр), харсны
 * дараа энгийн болно — Gmail/Facebook загвар. "Бүгдийг уншсан" товч нь бүх
 * хэсгийн `lastSeenAt`-ыг шинэчилнэ.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['admin-feed'],
    queryFn: () => api<{ items: FeedItem[]; unreadTotal: number }>('/admin/notifications/feed'),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // Гадуур дарах / Esc — UX стандарт
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unread = data?.unreadTotal ?? 0;

  const markAll = async () => {
    const sections = [...new Set((data?.items ?? []).map((i) => i.section))];
    await Promise.all(
      sections.map((s) =>
        api(`/admin/notifications/seen/${s}`, { method: 'POST' }).catch(() => null),
      ),
    );
    qc.invalidateQueries({ queryKey: ['admin-feed'] });
    qc.invalidateQueries({ queryKey: ['admin-badges'] });
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `${unread} шинэ мэдэгдэл` : 'Мэдэгдэл'}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
          open ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="admin-card admin-dropdown absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl shadow-2xl"
        >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                Мэдэгдэл
                {unread > 0 && <span className="ml-1.5 text-primary">({unread} шинэ)</span>}
              </p>
              {unread > 0 && (
                <button
                  onClick={markAll}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Check size={12} /> Бүгдийг уншсан
                </button>
              )}
            </div>

            <div className="max-h-[420px] overflow-y-auto overscroll-contain">
              {data?.items.length ? (
                data.items.map((n) => (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-start gap-2.5 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-accent/50',
                      n.unread && 'bg-primary/6',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                        n.unread ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {ICONS[n.section] ?? <Bell size={14} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'truncate text-sm',
                          n.unread ? 'font-semibold text-foreground' : 'text-foreground/80',
                        )}
                      >
                        {n.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{n.detail}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{ago(n.at)}</p>
                    </div>
                    {n.unread && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="уншаагүй" />
                    )}
                  </Link>
                ))
              ) : (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Мэдэгдэл байхгүй байна
                </p>
              )}
            </div>
        </div>
      )}
    </div>
  );
}
