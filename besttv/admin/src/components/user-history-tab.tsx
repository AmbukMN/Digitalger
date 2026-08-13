'use client';

import {
  Bell,
  Building2,
  Gift,
  History,
  KeyRound,
  LogIn,
  Monitor,
  Search,
  Shield,
  Smartphone,
  UserCog,
  Wallet,
} from 'lucide-react';
import { cn, formatPrice } from '@besttv/shared';
import type { AdminUserDetail } from '@/lib/queries';

/**
 * ХЭРЭГЛЭГЧИЙН ТҮҮХ — аудит лог, төхөөрөмж, мэдэгдэл, дансны төлбөр.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: гомдол шийдэхэд «хэзээ юу болсон» гэдгийг
 * мэдэх ёстой. Өмнө нь `UserAuditLog` хүснэгтэд БҮГД бүртгэгддэг
 * атлаа админ панелд ОГТ харагддаггүй байв.
 */

/** Аудит логийн талбарыг хүнд ойлгомжтой болгоно */
const FIELD_META: Record<string, { label: string; icon: typeof History; tone: string }> = {
  login: { label: 'Нэвтэрсэн', icon: LogIn, tone: 'text-foreground/50' },
  oauth_login: { label: 'Google/FB-ээр нэвтэрсэн', icon: LogIn, tone: 'text-foreground/50' },
  register: { label: 'Бүртгүүлсэн', icon: UserCog, tone: 'text-success' },
  logout: { label: 'Гарсан', icon: LogIn, tone: 'text-foreground/40' },
  password: { label: 'Нууц үг солисон', icon: KeyRound, tone: 'text-premium' },
  email: { label: 'Имэйл солисон', icon: UserCog, tone: 'text-premium' },
  name: { label: 'Нэр солисон', icon: UserCog, tone: 'text-foreground/50' },
  avatar: { label: 'Зураг солисон', icon: UserCog, tone: 'text-foreground/50' },
  role: { label: 'ЭРХ ӨӨРЧЛӨГДСӨН', icon: Shield, tone: 'text-destructive' },
  blocked: { label: 'ХААГДСАН/НЭЭГДСЭН', icon: Shield, tone: 'text-destructive' },
  wallet_credit: { label: 'Хэтэвч нэмэгдсэн', icon: Wallet, tone: 'text-success' },
  wallet_debit: { label: 'Хэтэвчнээс хасагдсан', icon: Wallet, tone: 'text-destructive' },
  plan_granted: { label: 'Багц олгогдсон', icon: Gift, tone: 'text-success' },
};

const ACTOR_LABEL: Record<string, string> = {
  self: 'Өөрөө',
  admin: 'Админ',
  system: 'Систем',
};

function when(iso: string): string {
  return new Date(iso).toLocaleString('mn-MN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Хэсгийн толгой — хоосон бол огт харуулахгүй */
function Section({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof History;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="rounded-xl border border-foreground/10 bg-card">
      <div className="flex items-center gap-2 border-b border-foreground/8 px-3.5 py-2.5">
        <Icon size={14} className="text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wide text-foreground/70">
          {title}
        </span>
        <span className="ml-auto rounded-full bg-foreground/8 px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

export function UserHistoryTab({ user }: { user: AdminUserDetail }) {
  const {
    auditLog = [],
    sessions = [],
    notifications = [],
    bankPayments = [],
    promotionRedemptions = [],
    recentSearches = [],
  } = user;

  const nothing =
    auditLog.length === 0 &&
    sessions.length === 0 &&
    notifications.length === 0 &&
    bankPayments.length === 0;

  if (nothing) {
    return (
      <div className="py-12 text-center">
        <History size={26} className="mx-auto text-foreground/20" />
        <p className="mt-2 text-sm text-muted-foreground">Түүх байхгүй байна</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ─── Нэвтэрсэн төхөөрөмж ─── */}
      <Section icon={Monitor} title="Нэвтэрсэн төхөөрөмж" count={sessions.length}>
        <div className="divide-y divide-foreground/6">
          {sessions.map((s) => {
            const name = s.deviceName ?? 'Тодорхойгүй';
            const Icon = /iphone|android|ipad/i.test(name) ? Smartphone : Monitor;
            return (
              <div key={s.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                <Icon size={14} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground/85">{name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {when(s.lastUsedAt)}
                    {s.ip && ` · ${s.ip}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ─── Дансаар төлсөн ─── */}
      <Section icon={Building2} title="Дансаар төлсөн" count={bankPayments.length}>
        <div className="divide-y divide-foreground/6">
          {bankPayments.map((p) => (
            <div key={p.id} className="flex items-start gap-2.5 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm">
                  <span className="font-mono font-bold tabular-nums text-foreground">
                    {p.bankReference}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground/70">
                    {formatPrice(p.amount)}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {when(p.createdAt)}
                  {p.bankClaimedAt && ' · мэдэгдсэн'}
                  {p.bankReviewedAt && ' · шалгасан'}
                </p>
                {p.bankRejectReason && (
                  <p className="mt-0.5 text-[11px] text-destructive">{p.bankRejectReason}</p>
                )}
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                  p.status === 'PAID'
                    ? 'bg-success/15 text-success'
                    : p.status === 'PENDING'
                      ? 'bg-premium/15 text-premium'
                      : 'bg-destructive/12 text-destructive',
                )}
              >
                {p.status === 'PAID'
                  ? 'Баталсан'
                  : p.status === 'PENDING'
                    ? 'Хүлээгдэж буй'
                    : 'Татгалзсан'}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Урамшуулал ─── */}
      <Section icon={Gift} title="Ашигласан урамшуулал" count={promotionRedemptions.length}>
        <div className="divide-y divide-foreground/6">
          {promotionRedemptions.map((r) => (
            <div key={r.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground/85">
                  {r.promotion?.name ?? 'Устгагдсан урамшуулал'}
                </p>
                <p className="text-[11px] text-muted-foreground">{when(r.createdAt)}</p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-premium">
                {r.daysGiven > 0 && `+${r.daysGiven} хоног`}
                {r.daysGiven > 0 && r.valueGiven > 0 && ' · '}
                {r.valueGiven > 0 && formatPrice(r.valueGiven)}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Мэдэгдэл ─── */}
      <Section icon={Bell} title="Илгээсэн мэдэгдэл" count={notifications.length}>
        <div className="max-h-64 divide-y divide-foreground/6 overflow-y-auto">
          {notifications.map((n) => (
            <div key={n.id} className="px-3.5 py-2.5">
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    'mt-1.5 size-1.5 shrink-0 rounded-full',
                    /* ⚠️ Уншсан эсэхийг ЯЛГАНА — «мэдэгдэл аваагүй»
                       гэсэн гомдлыг шалгах гол мэдээлэл */
                    n.readAt ? 'bg-foreground/20' : 'bg-primary',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground/85">{n.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {n.body}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {when(n.createdAt)}
                    {n.readAt ? ` · уншсан ${when(n.readAt)}` : ' · уншаагүй'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Хайсан үгс ─── */}
      <Section icon={Search} title="Хайсан үгс" count={recentSearches.length}>
        <div className="flex flex-wrap gap-1.5 p-3">
          {recentSearches.map((s, i) => (
            <span
              key={`${s.query}-${i}`}
              title={`${when(s.createdAt)} · ${s.results} үр дүн`}
              className={cn(
                'rounded-lg px-2 py-1 text-xs',
                /* ⚠️ ҮР ДҮНГҮЙ хайлтыг ТОДРУУЛНА — тэр нь «энэ
                   контентыг нэмэх хэрэгтэй» гэсэн шууд дохио */
                s.results === 0
                  ? 'bg-destructive/12 text-destructive'
                  : 'bg-foreground/8 text-foreground/60',
              )}
            >
              {s.query}
              {s.results === 0 && ' (0)'}
            </span>
          ))}
        </div>
      </Section>

      {/* ─── Аудит лог ─── */}
      <Section icon={History} title="Үйлдлийн түүх" count={auditLog.length}>
        <div className="max-h-80 divide-y divide-foreground/6 overflow-y-auto">
          {auditLog.map((a) => {
            const meta = FIELD_META[a.field] ?? {
              label: a.field,
              icon: History,
              tone: 'text-foreground/50',
            };
            const Icon = meta.icon;
            return (
              <div key={a.id} className="flex items-start gap-2.5 px-3.5 py-2">
                <Icon size={13} className={cn('mt-0.5 shrink-0', meta.tone)} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground/80">{meta.label}</p>
                  {/* ⚠️ Хуучин→шинэ утга — «хэн юуг юу болгосон» */}
                  {(a.oldValue || a.newValue) && (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {a.oldValue && <span className="line-through">{a.oldValue}</span>}
                      {a.oldValue && a.newValue && ' → '}
                      {a.newValue}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-muted-foreground">{when(a.createdAt)}</p>
                  <p
                    className={cn(
                      'text-[10px] font-semibold',
                      a.actor === 'admin' ? 'text-premium' : 'text-muted-foreground',
                    )}
                  >
                    {ACTOR_LABEL[a.actor] ?? a.actor}
                    {a.ip && ` · ${a.ip}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
