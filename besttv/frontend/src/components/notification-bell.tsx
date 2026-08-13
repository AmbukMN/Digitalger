'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Check,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  Gift,
  Info,
  Wallet,
} from 'lucide-react';
import { cn } from '@besttv/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import {
  useNotifications,
  useUnreadCount,
  type AppNotification,
  type NotificationType,
} from '@/lib/queries';

/**
 * МЭДЭГДЛИЙН ХОНХ.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: дансаар төлсөн хэрэглэгч «баталгаажсан уу?»
 * гэдгээ мэдэхгүй хүлээнэ. Имэйл хоцордог/спамд ордог. Сайт дээр
 * шууд харагдах мэдэгдэл нь дэмжлэгийн дуудлагыг эрс багасгана.
 *
 * ⚠️ Уншаагүйн тоог 60 секунд тутам ХӨНГӨН query-ээр авна (бүтэн
 * жагсаалт биш) — эс бөгөөс хэрэггүй өгөгдөл байнга дамжина.
 */

const ICON: Record<NotificationType, typeof Bell> = {
  PAYMENT_APPROVED: CircleCheck,
  PAYMENT_REJECTED: CircleAlert,
  PLAN_ACTIVATED: CircleCheck,
  PLAN_EXPIRING: CircleAlert,
  WALLET_TOPUP: Wallet,
  PROMOTION_APPLIED: Gift,
  INFO: Info,
};

const TONE: Record<NotificationType, string> = {
  PAYMENT_APPROVED: 'text-success',
  PAYMENT_REJECTED: 'text-destructive',
  PLAN_ACTIVATED: 'text-success',
  PLAN_EXPIRING: 'text-premium',
  WALLET_TOPUP: 'text-primary',
  PROMOTION_APPLIED: 'text-premium',
  INFO: 'text-foreground/50',
};

/** Хэдэн хугацааны өмнө — «2 цагийн өмнө» нь огнооноос ойлгомжтой */
function ago(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'Яг одоо';
  if (m < 60) return `${m} минутын өмнө`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} цагийн өмнө`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} өдрийн өмнө`;
  return new Date(iso).toLocaleDateString('mn-MN');
}

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* ⚠️ Нэвтрээгүй бол query огт явуулахгүй (401 spam) */
  const { data: count } = useUnreadCount(!!user);
  const { data, isLoading } = useNotifications(!!user && open);

  const unread = count?.unread ?? 0;

  /**
   * ⚠️ Гадуур дарахад + Esc-ээр хаах — UX дүрэм.
   * Dropdown нээлттэй үлдвэл хэрэглэгч хуудсаар явж чадахгүй.
   */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const openItem = async (n: AppNotification) => {
    if (!n.readAt) {
      await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => null);
      refresh();
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const markAll = async () => {
    await api('/notifications/read-all', { method: 'POST' }).catch(() => null);
    refresh();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `${unread} шинэ мэдэгдэл` : 'Мэдэгдэл'}
        className="relative rounded-lg p-2 text-foreground/60 transition-colors hover:bg-foreground/8 hover:text-foreground"
      >
        <Bell size={19} />
        {/*
          ⚠️ Тоо нь 9-өөс их бол «9+» — 2 оронтой тоо нь хонхны
          дүрсийг дараад замбараагүй харагдана.
        */}
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black tabular-nums text-primary-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-in absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-foreground/12 bg-background shadow-2xl sm:w-96">
          <div className="flex items-center justify-between border-b border-foreground/8 px-4 py-2.5">
            <span className="text-sm font-bold text-foreground">Мэдэгдэл</span>
            {unread > 0 && (
              <button
                onClick={() => void markAll()}
                className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                <CheckCheck size={12} />
                Бүгдийг уншсан
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-foreground/6" />
                ))}
              </div>
            ) : !data?.items.length ? (
              <div className="px-4 py-10 text-center">
                <Bell size={26} className="mx-auto text-foreground/20" />
                <p className="mt-2 text-sm text-foreground/45">Мэдэгдэл байхгүй байна</p>
              </div>
            ) : (
              data.items.map((n) => {
                const Icon = ICON[n.type] ?? Info;
                return (
                  <button
                    key={n.id}
                    onClick={() => void openItem(n)}
                    className={cn(
                      'flex w-full items-start gap-2.5 border-b border-foreground/6 px-4 py-3 text-left transition-colors last:border-0 hover:bg-foreground/4',
                      /* ⚠️ Уншаагүйг ЯЛГАНА — хэрэглэгч юуг харах ёстойгоо
                         нэг харцаар мэднэ */
                      !n.readAt && 'bg-primary/5',
                    )}
                  >
                    <Icon size={16} className={cn('mt-0.5 shrink-0', TONE[n.type])} />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm leading-snug',
                          n.readAt ? 'text-foreground/70' : 'font-semibold text-foreground',
                        )}
                      >
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-foreground/50">{n.body}</p>
                      <p className="mt-1 text-[10px] text-foreground/35">{ago(n.createdAt)}</p>
                    </div>
                    {!n.readAt && (
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
