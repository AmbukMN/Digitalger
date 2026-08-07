'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowDownLeft, ArrowUpRight, Bookmark, Crown, KeyRound, Loader2, Minus, PlayCircle, Plus, Receipt, Ticket, User as UserIcon, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatPrice } from '@besttv/shared';
import {
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@besttv/shared/ui';
import { api } from '@/lib/api';
import { UserInsightTab } from '@/components/user-insight-tab';
import { useAdminUser, useAdminPlans, useAdminWalletTxs, type AdminUser, type AdminWalletTx } from '@/lib/queries';

const STATUS_LABEL: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  PAID: { label: 'Төлсөн', variant: 'success' },
  PENDING: { label: 'Хүлээгдэж буй', variant: 'warning' },
  FAILED: { label: 'Амжилтгүй', variant: 'destructive' },
  EXPIRED: { label: 'Хугацаа дууссан', variant: 'secondary' },
  CANCELLED: { label: 'Цуцалсан', variant: 'secondary' },
};

const TX_META: Record<AdminWalletTx['type'], { label: string; positive: boolean }> = {
  TOPUP: { label: 'QPay цэнэглэлт', positive: true },
  ADMIN_CREDIT: { label: 'Админ нэмсэн', positive: true },
  ADMIN_DEBIT: { label: 'Админ хассан', positive: false },
  PURCHASE: { label: 'Багц худалдан авалт', positive: false },
  REFUND: { label: 'Буцаалт', positive: true },
};

export function UserDetailDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { data, isLoading, refetch } = useAdminUser(user.id);
  const { data: plans } = useAdminPlans();
  const { data: walletTxs, refetch: refetchTxs } = useAdminWalletTxs(user.id);
  const qc = useQueryClient();

  const [tab, setTab] = useState('overview');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [grantPlanId, setGrantPlanId] = useState('');
  const [granting, setGranting] = useState(false);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletNote, setWalletNote] = useState('');
  const [walletBusy, setWalletBusy] = useState(false);

  const adjustWallet = async (direction: 'credit' | 'debit') => {
    const amount = Number(walletAmount);
    if (!amount || amount < 1) {
      toast.error('Дүн оруулна уу');
      return;
    }
    setWalletBusy(true);
    try {
      await api(`/admin/wallet/${user.id}/${direction}`, {
        method: 'POST',
        body: JSON.stringify({ amount, description: walletNote || undefined }),
      });
      toast.success(direction === 'credit' ? 'Хэтэвч цэнэглэгдлээ' : 'Хэтэвчээс хасагдлаа');
      setWalletAmount('');
      setWalletNote('');
      await Promise.all([
        refetch(),
        refetchTxs(),
        qc.invalidateQueries({ queryKey: ['admin-users'] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setWalletBusy(false);
    }
  };

  const savePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('Нууц үг 8-с дээш тэмдэгттэй байх ёстой');
      return;
    }
    setSavingPassword(true);
    try {
      await api(`/admin/users/${user.id}/password`, {
        method: 'POST',
        body: JSON.stringify({ password: newPassword }),
      });
      toast.success('Нууц үг шинэчлэгдлээ');
      setNewPassword('');
    } catch {
      toast.error('Алдаа гарлаа');
    } finally {
      setSavingPassword(false);
    }
  };

  const grantSubscription = async () => {
    if (!grantPlanId) {
      toast.error('Багц сонгоно уу');
      return;
    }
    setGranting(true);
    try {
      await api(`/admin/users/${user.id}/grant-subscription`, {
        method: 'POST',
        body: JSON.stringify({ planId: grantPlanId }),
      });
      toast.success('Эрх идэвхжлээ');
      await Promise.all([
        refetch(),
        qc.invalidateQueries({ queryKey: ['admin-users'] }),
      ]);
      setGrantPlanId('');
    } catch {
      toast.error('Алдаа гарлаа');
    } finally {
      setGranting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/*
        ⚠️ ӨНДРИЙН ХЯЗГААР ЗААВАЛ — идэвхийн түүх/захиалга олон бол дэлгэцээс
        халиад доод хэсэг нь БҮРЭН уншигдахгүй болдог байсан. `max-h-[88dvh]`
        + `flex-col` + доторх `overflow-y-auto` нь толгойг байрандаа үлдээж,
        зөвхөн агуулгыг гүйлгэнэ.
      */}
      <DialogContent className="flex max-h-[88dvh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {(user.name?.[0] ?? user.email[0]).toUpperCase()}
            </span>
            {user.name ?? user.email}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="mt-2">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">
                <UserIcon size={13} className="mr-1" /> Тойм
              </TabsTrigger>
              <TabsTrigger value="insight">
                <Activity size={13} className="mr-1" /> Идэвх
              </TabsTrigger>
              <TabsTrigger value="wallet">
                <Wallet size={13} className="mr-1" /> Хэтэвч
              </TabsTrigger>
              <TabsTrigger value="orders">
                <Receipt size={13} className="mr-1" /> Захиалга
              </TabsTrigger>
              <TabsTrigger value="library">
                <Bookmark size={13} className="mr-1" /> Сан
              </TabsTrigger>
              <TabsTrigger value="access">
                <Ticket size={13} className="mr-1" /> Эрх
              </TabsTrigger>
            </TabsList>

            {/* ⚠️ Зөвхөн таб нээгдсэн үед л дуудна (insight query хүнд) */}
            <TabsContent value="insight">
              <UserInsightTab userId={user.id} active={tab === 'insight'} />
            </TabsContent>

            <TabsContent value="overview" className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow label="Имэйл" value={data.email} />
                <InfoRow label="Эрх" value={data.role === 'ADMIN' ? 'Админ' : 'Хэрэглэгч'} />
                <InfoRow label="Нэвтрэх төрөл" value={data.provider} />
                <InfoRow label="Имэйл баталгаажсан" value={data.emailVerified ? 'Тийм' : 'Үгүй'} />
                <InfoRow label="Зочин эсэх" value={data.isGuest ? 'Тийм' : 'Үгүй'} />
                <InfoRow label="Бүртгүүлсэн" value={new Date(data.createdAt).toLocaleDateString('mn-MN')} />
                <InfoRow label="Төлөв" value={data.isActive ? 'Идэвхтэй' : 'Хаагдсан'} />
                <InfoRow label="Хэтэвч" value={`${data.walletBalance.toLocaleString()}₮`} />
              </div>

              {/*
                ⚠️ ИДЭВХТЭЙ БАГЦУУД — өмнө нь зөвхөн нэг нэр харагддаг байсан
                тул "ямар багцтай вэ, юу нээгдэх вэ" мэдэгддэггүй байсан.
                Одоо: багц бүр, нээх жанрууд, дуусах огноо, үлдсэн хоног,
                админаас олгосон эсэх.
              */}
              {(() => {
                const now = Date.now();
                const active = (data.subscriptions ?? []).filter(
                  (s) => new Date(s.expiresAt).getTime() > now,
                );
                const expired = (data.subscriptions ?? []).filter(
                  (s) => new Date(s.expiresAt).getTime() <= now,
                );
                const hasVip = active.some((s) => s.plan.isVip);
                /**
                 * ⚠️ VIP нь БҮХ контентыг нээдэг тул VIP идэвхтэй үед бусад
                 * багцыг ОГТ харуулахгүй — эс бөгөөс "давхар багцтай" мэт
                 * ойлгомжгүй харагдана. (Backend ч VIP олгоход бусдыг
                 * хүчингүй болгодог.)
                 */
                const shown = hasVip ? active.filter((s) => s.plan.isVip) : active;

                return (
                  <div className="mt-4 rounded-lg border border-border p-4">
                    <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Crown size={13} className="text-premium" /> Идэвхтэй багц ({shown.length})
                    </p>

                    {shown.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Идэвхтэй багц байхгүй — зөвхөн үнэгүй контент үзнэ
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {shown.map((s) => {
                          const left = Math.ceil(
                            (new Date(s.expiresAt).getTime() - now) / 86400000,
                          );
                          // VIP байхад энгийн багц илүүдэл болно
                          const superseded = false;
                          return (
                            <div
                              key={s.id}
                              className={cn(
                                'rounded-lg border p-3',
                                s.plan.isVip
                                  ? 'border-premium/40 bg-premium/8'
                                  : 'border-border bg-accent/30',
                                superseded && 'opacity-60',
                              )}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                  {s.plan.isVip && <Crown size={13} className="text-premium" />}
                                  {s.plan.name}
                                  {!s.paymentId && (
                                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                      АДМИНААС
                                    </span>
                                  )}
                                  {superseded && (
                                    <span className="rounded bg-premium/15 px-1.5 py-0.5 text-[10px] font-bold text-premium">
                                      VIP-Д БАГТСАН
                                    </span>
                                  )}
                                </span>
                                <span
                                  className={cn(
                                    'text-xs font-medium',
                                    left <= 3 ? 'text-destructive' : 'text-muted-foreground',
                                  )}
                                >
                                  {new Date(s.expiresAt).toLocaleDateString('mn-MN')} · {left} хоног
                                </span>
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {s.plan.isVip ? (
                                  <span className="rounded bg-premium/15 px-1.5 py-0.5 text-[11px] text-premium">
                                    Бүх контент
                                  </span>
                                ) : s.plan.genres.length ? (
                                  s.plan.genres.map((g) => (
                                    <span
                                      key={g.genre.id}
                                      className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                                    >
                                      {g.genre.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">
                                    Жанр заагаагүй
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {expired.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                          Дууссан эрх ({expired.length})
                        </summary>
                        <div className="mt-2 space-y-1.5">
                          {expired.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between rounded-md bg-accent/20 px-2.5 py-1.5 text-xs"
                            >
                              <span className="text-muted-foreground">{s.plan.name}</span>
                              <span className="text-muted-foreground">
                                {new Date(s.expiresAt).toLocaleDateString('mn-MN')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })()}
            </TabsContent>

            {/* ── ХЭТЭВЧ ── */}
            <TabsContent value="wallet" className="space-y-4">
              <div className="rounded-lg border border-primary/25 bg-primary/8 p-4">
                <p className="text-xs text-muted-foreground">Одоогийн үлдэгдэл</p>
                <p className="mt-0.5 text-2xl font-black text-foreground">
                  {data.walletBalance.toLocaleString()}₮
                </p>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Хэтэвч засварлах
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={walletAmount}
                    onChange={(e) => setWalletAmount(e.target.value)}
                    placeholder="Дүн (₮)"
                    className="w-32 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                  <input
                    value={walletNote}
                    onChange={(e) => setWalletNote(e.target.value)}
                    placeholder="Тайлбар (заавал биш)"
                    className="flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => adjustWallet('credit')}
                    disabled={walletBusy}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-success/15 py-2 text-sm font-semibold text-success hover:bg-success/25 disabled:opacity-50"
                  >
                    {walletBusy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Цэнэглэх
                  </button>
                  <button
                    onClick={() => adjustWallet('debit')}
                    disabled={walletBusy}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-destructive/15 py-2 text-sm font-semibold text-destructive hover:bg-destructive/25 disabled:opacity-50"
                  >
                    <Minus size={14} /> Хасах
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Гүйлгээний түүх ({walletTxs?.length ?? 0})
                </p>
                <div className="max-h-64 space-y-1.5 overflow-y-auto">
                  {walletTxs?.length ? (
                    walletTxs.map((tx) => {
                      const meta = TX_META[tx.type];
                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between rounded-lg bg-accent/30 px-3 py-2 text-sm"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={cn(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                                meta.positive ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
                              )}
                            >
                              {meta.positive ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-foreground">{tx.planName ?? meta.label}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {new Date(tx.createdAt).toLocaleString('mn-MN')}
                                {tx.description && ` · ${tx.description}`}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={cn('font-semibold', meta.positive ? 'text-success' : 'text-foreground')}>
                              {meta.positive ? '+' : ''}
                              {tx.amount.toLocaleString()}₮
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              → {tx.balanceAfter.toLocaleString()}₮
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="py-4 text-center text-sm text-muted-foreground">Гүйлгээ байхгүй байна</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="orders" className="space-y-2">
              {data.payments.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">Захиалга байхгүй байна</p>
              )}
              {data.payments.map((p) => {
                const st = STATUS_LABEL[p.status] ?? { label: p.status, variant: 'secondary' as const };
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-accent/30 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {p.plan?.name ?? 'Хэтэвч цэнэглэлт'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleString('mn-MN')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{p.amount.toLocaleString()}₮</span>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="library" className="space-y-4">
              {/*
                ⚠️⚠️ ТҮРЭЭС — БАГЦААС ТУСДАА эрх (нэг кино, хугацаатай).
                Өмнө нь админд ОГТ харагддаггүй байсан тул "төлбөр төлсөн
                атлаа юу авсан нь мэдэгдэхгүй" гэсэн гомдол шийдэхэд хэцүү
                байв. Хамгийн ДЭЭД талд — хамгийн их асуудал үүсгэдэг зүйл.
              */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Ticket size={12} /> Түрээс ({data.rentals?.length ?? 0})
                </p>
                <div className="space-y-1.5">
                  {!data.rentals?.length && (
                    <p className="text-sm text-muted-foreground">Түрээс байхгүй</p>
                  )}
                  {(data.rentals ?? []).map((r) => {
                    const active = new Date(r.expiresAt) > new Date();
                    return (
                      <div
                        key={r.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          {r.title.title}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {formatPrice(r.amount)}
                        </span>
                        <Badge variant={active ? 'success' : 'secondary'} className="shrink-0 text-[10px]">
                          {active
                            ? `${new Date(r.expiresAt).toLocaleDateString('mn-MN')} хүртэл`
                            : 'Дууссан'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Жагсаалт ({data.myList.length})
                </p>
                <div className="space-y-1.5">
                  {data.myList.length === 0 && (
                    <p className="text-sm text-muted-foreground">Хоосон байна</p>
                  )}
                  {data.myList.map((item) => (
                    <div
                      key={item.title.id}
                      className="flex items-center justify-between rounded-md bg-accent/30 px-3 py-1.5 text-sm"
                    >
                      <span className="text-foreground">{item.title.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString('mn-MN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Сүүлд үзсэн
                </p>
                <div className="space-y-1.5">
                  {data.watchProgress.length === 0 && (
                    <p className="text-sm text-muted-foreground">Түүх байхгүй байна</p>
                  )}
                  {data.watchProgress.map((wp) => {
                    const pct = wp.durationSec > 0 ? Math.round((wp.positionSec / wp.durationSec) * 100) : 0;
                    return (
                      <div key={wp.title.id} className="rounded-md bg-accent/30 px-3 py-1.5 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-foreground">
                            <PlayCircle size={13} className="text-muted-foreground" /> {wp.title.title}
                          </span>
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-border">
                          <div className="h-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="access" className="space-y-5">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <KeyRound size={12} /> Нууц үг тохируулах
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Шинэ нууц үг (8+ тэмдэгт)"
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                  <button
                    onClick={savePassword}
                    disabled={savingPassword}
                    className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {savingPassword ? <Loader2 size={15} className="animate-spin" /> : 'Хадгалах'}
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Ticket size={12} /> Эрх (Subscription) олгох
                </p>
                <div className="flex gap-2">
                  <select
                    value={grantPlanId}
                    onChange={(e) => setGrantPlanId(e.target.value)}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  >
                    <option value="">Багц сонгох...</option>
                    {plans?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.durationDays} хоног)
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={grantSubscription}
                    disabled={granting}
                    className={cn(
                      'shrink-0 rounded-lg bg-premium px-3 py-2 text-sm font-medium text-premium-foreground disabled:opacity-50',
                    )}
                  >
                    {granting ? <Loader2 size={15} className="animate-spin" /> : 'Олгох'}
                  </button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}
