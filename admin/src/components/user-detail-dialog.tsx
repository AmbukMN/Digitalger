'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@digitalger/shared/ui';
import {
  Ban,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Gift,
  History,
  Link2,
  Mail,
  MonitorSmartphone,
  MousePointerClick,
  Package,
  Phone,
  ShoppingCart,
  Shield,
  Smartphone,
  Tablet,
  User as UserIcon,
  X,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import type {
  AdminUser,
  AdminUserFullDetail,
  UserDetailOrder,
} from '@/types/admin';

// ─── Туслах: огноо/мөнгө формат ───────────────────────────────────────────
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' })} ${d.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}`;
}
function fmtPrice(v: string | number): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return `${(n ?? 0).toLocaleString('mn-MN')}₮`;
}

// Захиалгын статус → Badge өнгө + Монгол нэр
const ORDER_STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'info' }> = {
  PAID: { label: 'Төлсөн', variant: 'success' },
  PENDING: { label: 'Хүлээгдэж буй', variant: 'warning' },
  CANCELLED: { label: 'Цуцалсан', variant: 'destructive' },
  FAILED: { label: 'Амжилтгүй', variant: 'destructive' },
  REFUNDED: { label: 'Буцаасан', variant: 'secondary' },
};

// Аккаунт өөрчлөлтийн талбар → Монгол нэр + icon
const AUDIT_FIELD: Record<string, { label: string; icon: typeof Mail }> = {
  email: { label: 'И-мэйл', icon: Mail },
  phone: { label: 'Утас', icon: Phone },
  name: { label: 'Нэр', icon: UserIcon },
  password: { label: 'Нууц үг', icon: Shield },
  role: { label: 'Эрх', icon: Shield },
  blocked: { label: 'Хаалт', icon: Ban },
};

function DeviceIcon({ device }: { device: string }) {
  if (device === 'mobile') return <Smartphone className="h-4 w-4" />;
  if (device === 'tablet') return <Tablet className="h-4 w-4" />;
  return <MonitorSmartphone className="h-4 w-4" />;
}

function StatCard({ icon: Icon, label, value, tone }: {
  icon: typeof ShoppingCart;
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-none tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
      </div>
    </div>
  );
}

// Хоосон төлөв
function Empty({ icon: Icon, text }: { icon: typeof Package; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

// ─── Захиалгын карт ────────────────────────────────────────────────────────
function OrderRow({ order }: { order: UserDetailOrder }) {
  const st = ORDER_STATUS[order.status] ?? { label: order.status, variant: 'secondary' as const };
  const isGrant = order.source === 'ADMIN_GRANT';
  const lastPayment = order.payments[0];
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={st.variant}>{st.label}</Badge>
            {isGrant && <Badge variant="info"><Gift className="mr-1 h-3 w-3" />Админ бэлэглэсэн</Badge>}
            {order.couponCode && <Badge variant="outline">Купон: {order.couponCode}</Badge>}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Үүсгэсэн: {fmtDateTime(order.createdAt)}
          </p>
          {order.status === 'PAID' && lastPayment?.status === 'SUCCESS' && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Төлбөр амжилттай: {fmtDateTime(lastPayment.createdAt)}
            </p>
          )}
        </div>
        <p className="shrink-0 text-base font-bold tabular-nums">{fmtPrice(order.total)}</p>
      </div>
      {/* Захиалгын бүтээгдэхүүнүүд */}
      <div className="space-y-1.5 border-t border-border/60 pt-2.5">
        {order.items.map((it) => (
          <div key={it.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{it.product?.title ?? '(устсан бүтээгдэхүүн)'}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{fmtPrice(it.price)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  user: AdminUser | null;
  onClose: () => void;
}

export function UserDetailDialog({ user, onClose }: Props) {
  const { data, isLoading, isError } = useQuery<AdminUserFullDetail>({
    queryKey: ['admin', 'user-detail', user?.id],
    queryFn: () => adminApi.users.detail(user!.id),
    enabled: !!user,
    staleTime: 0,
  });

  const u = data?.user;
  const s = data?.summary;

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[88vh] max-h-[88vh] w-[95vw] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        {/* ─── Толгой: хэрэглэгчийн профайл ─── */}
        <div className="relative shrink-0 border-b border-border bg-gradient-to-br from-primary/8 via-card to-card px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-4">
            {/* Avatar */}
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-border" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary ring-2 ring-primary/20">
                {(user?.name ?? user?.email ?? '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold leading-tight">{u?.name ?? user?.name ?? 'Нэргүй хэрэглэгч'}</h2>
                {(u?.role ?? user?.role) === 'ADMIN' && <Badge variant="default"><Shield className="mr-1 h-3 w-3" />Админ</Badge>}
                {(u?.isGuest ?? user?.isGuest) && <Badge variant="secondary">Зочин</Badge>}
                {(u?.blocked ?? user?.blocked) && <Badge variant="destructive"><Ban className="mr-1 h-3 w-3" />Хаагдсан</Badge>}
                {u?.oauthProvider && <Badge variant="info" className="capitalize">{u.oauthProvider}</Badge>}
              </div>
              <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{u?.email ?? user?.email}</span>
                  {u?.emailVerified
                    ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    : <span className="text-[10px] text-amber-600 dark:text-amber-400">(баталгаажаагүй)</span>}
                </span>
                {(u?.phone ?? user?.phone) && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {u?.phone ?? user?.phone}
                  </span>
                )}
                {u?.pendingEmail && (
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    Солих хүсэлт: {u.pendingEmail}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : isError || !data ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Мэдээлэл ачаалахад алдаа гарлаа</p>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
            {/* Tab сонголтууд */}
            <div className="shrink-0 border-b border-border px-4 pt-3">
              <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                <TabsTrigger value="overview" className="data-[state=active]:bg-primary/10">Тойм</TabsTrigger>
                <TabsTrigger value="orders" className="data-[state=active]:bg-primary/10">
                  Захиалга {s ? `(${s.ordersTotal})` : ''}
                </TabsTrigger>
                <TabsTrigger value="downloads" className="data-[state=active]:bg-primary/10">
                  Татсан {s ? `(${s.downloadsTotal})` : ''}
                </TabsTrigger>
                <TabsTrigger value="activity" className="data-[state=active]:bg-primary/10">
                  Үзсэн/Дарсан
                </TabsTrigger>
                <TabsTrigger value="account" className="data-[state=active]:bg-primary/10">Аккаунт түүх</TabsTrigger>
              </TabsList>
            </div>

            {/* ─── ТОЙМ ─── */}
            <TabsContent value="overview" className="m-0 flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard icon={ShoppingCart} label="Нийт захиалга" value={s?.ordersTotal ?? 0} tone="bg-primary/10 text-primary" />
                <StatCard icon={CheckCircle2} label="Төлсөн" value={s?.paidOrders ?? 0} tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400" />
                <StatCard icon={Clock} label="Хүлээгдэж буй" value={s?.pendingOrders ?? 0} tone="bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400" />
                <StatCard icon={Download} label="Татсан файл" value={s?.downloadsTotal ?? 0} tone="bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400" />
                <StatCard icon={Eye} label="Үзсэн бүтээгдэхүүн" value={s?.viewsTotal ?? 0} tone="bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400" />
                <StatCard icon={MousePointerClick} label="Дарсан линк" value={s?.clicksTotal ?? 0} tone="bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400" />
              </div>

              {/* Төхөөрөмж */}
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
                  Төхөөрөмж
                </p>
                {data.devices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Бүртгэл алга</p>
                ) : (
                  <div className="space-y-2">
                    {data.devices.map((d) => {
                      const total = data.devices.reduce((sum, x) => sum + x.count, 0);
                      const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
                      return (
                        <div key={d.device} className="flex items-center gap-3">
                          <span className="flex w-20 shrink-0 items-center gap-1.5 text-sm capitalize">
                            <DeviceIcon device={d.device} />
                            {d.device}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                            {d.count} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Бүртгэл огноо */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Бүртгүүлсэн</p>
                  <p className="mt-1 text-sm font-semibold">{fmtDateTime(u?.createdAt)}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Сүүлд шинэчилсэн</p>
                  <p className="mt-1 text-sm font-semibold">{fmtDateTime(u?.updatedAt)}</p>
                </div>
              </div>
            </TabsContent>

            {/* ─── ЗАХИАЛГА ─── */}
            <TabsContent value="orders" className="m-0 flex-1 overflow-y-auto p-5">
              {data.orders.length === 0 ? (
                <Empty icon={ShoppingCart} text="Захиалга алга" />
              ) : (
                <div className="space-y-3">
                  {data.orders.map((o) => <OrderRow key={o.id} order={o} />)}
                </div>
              )}
            </TabsContent>

            {/* ─── ТАТСАН ФАЙЛУУД ─── */}
            <TabsContent value="downloads" className="m-0 flex-1 overflow-y-auto p-5">
              {data.downloads.length === 0 ? (
                <Empty icon={Download} text="Татсан файл алга" />
              ) : (
                <div className="space-y-2">
                  {data.downloads.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                        <Download className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{d.fileName}</p>
                        {d.productTitle && <p className="truncate text-xs text-muted-foreground">{d.productTitle}</p>}
                      </div>
                      <p className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(d.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ─── ҮЗСЭН / ДАРСАН ─── */}
            <TabsContent value="activity" className="m-0 flex-1 overflow-y-auto p-5 space-y-5">
              {/* Үзсэн бүтээгдэхүүн */}
              <div>
                <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
                  <Eye className="h-4 w-4 text-violet-500" />
                  Үзсэн бүтээгдэхүүн ({data.viewedProducts.length})
                </p>
                {data.viewedProducts.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">Бүртгэл алга</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.viewedProducts.slice(0, 50).map((e) => (
                      <div key={e.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                        <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{e.productTitle}</span>
                        {e.device && (
                          <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
                            <DeviceIcon device={e.device} />
                          </span>
                        )}
                        <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(e.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Дарсан линк */}
              <div>
                <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
                  <Link2 className="h-4 w-4 text-orange-500" />
                  Дарсан линк ({data.clickedLinks.length})
                </p>
                {data.clickedLinks.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">Бүртгэл алга</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.clickedLinks.slice(0, 50).map((e) => (
                      <div key={e.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                        <MousePointerClick className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{e.productTitle}</span>
                        <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(e.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ─── АККАУНТ ТҮҮХ ─── */}
            <TabsContent value="account" className="m-0 flex-1 overflow-y-auto p-5">
              {data.auditLogs.length === 0 ? (
                <Empty icon={History} text="Өөрчлөлтийн түүх алга" />
              ) : (
                <div className="relative space-y-0 pl-2">
                  {data.auditLogs.map((log) => {
                    const meta = AUDIT_FIELD[log.field] ?? { label: log.field, icon: History };
                    const Icon = meta.icon;
                    return (
                      <div key={log.id} className="relative flex gap-3 pb-5 last:pb-0">
                        {/* Timeline шугам + цэг */}
                        <div className="flex flex-col items-center">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="w-px flex-1 bg-border" />
                        </div>
                        <div className="min-w-0 flex-1 pt-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{meta.label}</p>
                            <Badge variant={log.actor === 'admin' ? 'info' : 'outline'}>
                              {log.actor === 'admin' ? 'Админ' : 'Хэрэглэгч өөрөө'}
                            </Badge>
                          </div>
                          {log.field !== 'password' && (log.oldValue || log.newValue) && (
                            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              {log.oldValue && <span className="rounded bg-muted px-1.5 py-0.5 line-through">{log.oldValue}</span>}
                              {log.oldValue && log.newValue && <span>→</span>}
                              {log.newValue && <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-foreground">{log.newValue}</span>}
                            </p>
                          )}
                          {log.field === 'password' && (
                            <p className="mt-1 text-xs text-muted-foreground">{log.newValue ?? 'Шинэчилсэн'}</p>
                          )}
                          <p className="mt-1 text-[11px] text-muted-foreground">{fmtDateTime(log.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Хаах товч (footer) */}
        <div className="shrink-0 border-t border-border px-5 py-3">
          <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>Хаах</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
