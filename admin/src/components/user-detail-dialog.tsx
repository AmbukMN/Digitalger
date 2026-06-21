'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
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
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Download,
  Eye,
  Globe,
  Heart,
  History,
  Library,
  Link2,
  FileStack,
  AlertTriangle,
  LogIn,
  Mail,
  MessageCircle,
  MessageSquare,
  MessagesSquare,
  MonitorSmartphone,
  MousePointerClick,
  Package,
  Phone,
  Search,
  ShoppingCart,
  Shield,
  Smartphone,
  Sparkles,
  Tablet,
  TrendingUp,
  User as UserIcon,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { OrderStatusBadge } from '@/components/order-status-badge';
import type {
  AdminUser,
  AdminUserFullDetail,
  AdminLibraryEntry,
  UserDetailChatConversation,
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
// Зөвхөн цаг:минут (chat bubble-д)
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });
}

// Аккаунт өөрчлөлтийн талбар → Монгол нэр + icon
const AUDIT_FIELD: Record<string, { label: string; icon: typeof Mail }> = {
  email: { label: 'И-мэйл', icon: Mail },
  phone: { label: 'Утас', icon: Phone },
  name: { label: 'Нэр', icon: UserIcon },
  password: { label: 'Нууц үг', icon: Shield },
  role: { label: 'Эрх', icon: Shield },
  blocked: { label: 'Хаалт', icon: Ban },
  // Нэвтрэлт/бүртгэл (auth event)
  login: { label: 'Нэвтэрсэн', icon: LogIn },
  register: { label: 'Бүртгүүлсэн', icon: UserPlus },
  guest_login: { label: 'Зочноор нэвтэрсэн', icon: LogIn },
  oauth_login: { label: 'Google-ээр нэвтэрсэн', icon: LogIn },
  password_reset: { label: 'Нууц үг сэргээсэн', icon: Shield },
};

// Имэйл маркетингийн campaign key → Монгол нэр. broadcast-* (бөөн имэйл) prefix-ээр.
// campaign=null → гүйлгээний (transactional) имэйл.
const EMAIL_CAMPAIGN_LABEL: Record<string, string> = {
  'cart-1h': 'Сагс сануулга',
  'discount-24h': 'Хөнгөлөлт',
  'coupon-expiring': 'Купон дуусах',
  'new-product': 'Шинэ бүтээгдэхүүн',
  reactivation: 'Эргэн идэвхжүүлэх',
  welcome: 'Тавтай морил',
};
function emailCampaignLabel(campaign: string | null): string {
  if (!campaign) return 'Гүйлгээний имэйл';
  if (campaign.startsWith('broadcast')) return 'Бөөн имэйл';
  return EMAIL_CAMPAIGN_LABEL[campaign] ?? campaign;
}

// Имэйлийн status → Badge өнгө + Монгол нэр.
const EMAIL_STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'info' }> = {
  delivered: { label: 'Хүрсэн', variant: 'success' },
  sent: { label: 'Илгээсэн', variant: 'info' },
  bounced: { label: 'Буцсан', variant: 'destructive' },
  complained: { label: 'Гомдол', variant: 'destructive' },
  failed: { label: 'Амжилтгүй', variant: 'destructive' },
  queued: { label: 'Дараалалд', variant: 'secondary' },
};

// Утас баталгаажуулалтын status → Badge өнгө + Монгол нэр (verify.mn).
const SMS_STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'info' }> = {
  verified: { label: 'Баталгаажсан', variant: 'success' },
  pending: { label: 'Хүлээж байна', variant: 'info' },
  expired: { label: 'Хугацаа дууссан', variant: 'secondary' },
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
  const lastPayment = order.payments[0];
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* НЭГ эх сурвалжтай захиалгын статус badge (gift / цуцлалтын эх сурвалж дотроо) */}
            <OrderStatusBadge status={order.status} source={order.source} cancelledBy={order.cancelledBy} />
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

// ─── Чат яриа карт (messenger маягийн bubble) ────────────────────────────────
function ChatConversationCard({ conv }: { conv: UserDetailChatConversation }) {
  const [open, setOpen] = useState(false);
  const isFb = conv.channel === 'facebook';
  const lastMsg = conv.messages[conv.messages.length - 1];
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Толгой — дарвал нээх/хаах */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            isFb
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'
              : 'bg-muted text-primary'
          }`}
        >
          {isFb ? <MessagesSquare className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isFb ? 'info' : 'secondary'} className="capitalize">
              {isFb ? 'Facebook' : 'Веб'}
            </Badge>
            {conv.userName && <span className="truncate text-sm font-medium">{conv.userName}</span>}
            <span className="text-xs text-muted-foreground">{conv.messages.length} мессеж</span>
          </div>
          {lastMsg && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {lastMsg.role === 'assistant' ? 'Бот: ' : ''}
              {lastMsg.text}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtDateTime(conv.lastMessageAt)}</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Мессеж урсгал */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="max-h-80 space-y-3 overflow-y-auto border-t border-border bg-muted/30 p-4">
              {conv.messages.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Мессеж алга</p>
              ) : (
                conv.messages.map((m, i) => {
                  const isUser = m.role === 'user';
                  return (
                    <div key={i} className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      {!isUser && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
                          <Bot className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div className={`flex max-w-[78%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word ${
                            isUser
                              ? 'rounded-br-sm bg-[#ffbe00] text-[#022179]'
                              : 'rounded-bl-sm bg-card text-foreground ring-1 ring-border'
                          }`}
                        >
                          {m.text}
                        </div>
                        {/* AI санал болгосон бүтээгдэхүүний card — хэрэглэгчид харагдсаныг
                            ЯГ ижлээр (нэр/үнэ/хямдрал/зураг). Зүгээр текст биш бүрэн. */}
                        {!isUser && Array.isArray(m.products) && m.products.length > 0 && (
                          <div className="mt-1.5 flex max-w-full gap-2 overflow-x-auto pb-1">
                            {m.products.map((p, pi) => (
                              <a
                                key={p.id ?? pi}
                                href={p.url ?? '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex w-32 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-background transition-colors hover:border-primary/40"
                              >
                                <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                                  {p.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Bot className="h-5 w-5" /></div>
                                  )}
                                </div>
                                <div className="flex flex-1 flex-col gap-0.5 p-1.5">
                                  <p className="line-clamp-2 min-h-7 text-[11px] font-semibold text-foreground">{p.title}</p>
                                  {p.salePrice != null ? (
                                    <span className="text-xs font-bold text-primary">{Math.round(p.salePrice).toLocaleString()}₮</span>
                                  ) : p.price != null ? (
                                    <span className="text-xs font-bold text-primary">{Math.round(p.price).toLocaleString()}₮</span>
                                  ) : null}
                                </div>
                              </a>
                            ))}
                          </div>
                        )}
                        <span className="mt-1 px-1 text-[10px] text-muted-foreground">{fmtTime(m.createdAt)}</span>
                      </div>
                      {isUser && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#022179] text-white">
                          <UserIcon className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

  // "Миний сан" — хэрэглэгчид ЯГ харагдаж байгаа бодит эзэмшил. Захиалга PAID
  // байж болох ч энд (санд) орсон эсэхийг харна — гомдол шийдэхэд гол. realtime.
  const { data: library, isLoading: libLoading } = useQuery<AdminLibraryEntry[]>({
    queryKey: ['admin', 'user-library', user?.id],
    queryFn: () => adminApi.users.library(user!.id),
    enabled: !!user,
    staleTime: 0,
  });

  const u = data?.user;
  const s = data?.summary;
  const chats = data?.chatConversations ?? [];
  const ltv = data?.ltv;
  const interests = data?.interests;
  const conversion = data?.chatConversion;
  const emails = data?.emailHistory ?? [];
  const sms = data?.smsHistory ?? [];
  const helpViews: { id: string; title: string; viewedAt: string; device?: string | null; source?: string | null }[] = data?.helpVideoViews ?? [];
  const faqViews: { id: string; question: string; viewedAt: string; device?: string | null }[] = data?.faqViews ?? [];

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[88vh] max-h-[88vh] w-[95vw] max-w-5xl flex-col gap-0 overflow-hidden p-0">
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
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-muted text-2xl font-bold text-primary ring-2 ring-primary/20">
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
                    {u?.phoneVerified
                      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      : <span className="text-[10px] text-amber-600 dark:text-amber-400">(баталгаажаагүй)</span>}
                  </span>
                )}
                {u?.pendingPhone && (
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    Утас солих хүсэлт: {u.pendingPhone}
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
                <TabsTrigger value="overview" className="data-[state=active]:bg-muted">Тойм</TabsTrigger>
                <TabsTrigger value="orders" className="data-[state=active]:bg-muted">
                  Захиалга {s ? `(${s.ordersTotal})` : ''}
                </TabsTrigger>
                <TabsTrigger value="library" className="data-[state=active]:bg-muted">
                  <Library className="mr-1 h-3.5 w-3.5" />Миний сан {library ? `(${library.length})` : ''}
                </TabsTrigger>
                <TabsTrigger value="downloads" className="data-[state=active]:bg-muted">
                  Татсан {s ? `(${s.downloadsTotal})` : ''}
                </TabsTrigger>
                <TabsTrigger value="chat" className="data-[state=active]:bg-muted">
                  💬 Чат {chats.length > 0 ? `(${chats.length})` : ''}
                </TabsTrigger>
                <TabsTrigger value="activity" className="data-[state=active]:bg-muted">
                  Үзсэн/Дарсан
                </TabsTrigger>
                <TabsTrigger value="behavior" className="data-[state=active]:bg-muted">
                  Хайлт/Хандалт
                </TabsTrigger>
                <TabsTrigger value="email" className="data-[state=active]:bg-muted">
                  <Mail className="mr-1 h-3.5 w-3.5" />Имэйл {emails.length > 0 ? `(${emails.length})` : ''}
                </TabsTrigger>
                <TabsTrigger value="sms" className="data-[state=active]:bg-muted">
                  <MessageSquare className="mr-1 h-3.5 w-3.5" />SMS {sms.length > 0 ? `(${sms.length})` : ''}
                </TabsTrigger>
                <TabsTrigger value="help" className="data-[state=active]:bg-muted">
                  Тусламж {(helpViews.length + faqViews.length) > 0 ? `(${helpViews.length + faqViews.length})` : ''}
                </TabsTrigger>
                <TabsTrigger value="account" className="data-[state=active]:bg-muted">Аккаунт түүх</TabsTrigger>
              </TabsList>
            </div>

            {/* ─── ТОЙМ ─── */}
            <TabsContent value="overview" className="m-0 flex-1 overflow-y-auto p-5 space-y-4">
              {/* ─── LTV / Худалдан авалтын үнэ цэнэ ─── */}
              {(ltv || conversion) && (
                <div className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/8 via-card to-card p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Wallet className="h-4 w-4 text-primary" />
                      Худалдан авагчийн үнэ цэнэ (LTV)
                    </p>
                    {conversion && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {conversion.chatted && (
                          <Badge variant="info"><MessageCircle className="mr-1 h-3 w-3" />Чатласан</Badge>
                        )}
                        {conversion.purchasedAfterChat && (
                          <Badge variant="success"><Sparkles className="mr-1 h-3 w-3" />Чатын дараа худалдсан</Badge>
                        )}
                      </div>
                    )}
                  </div>
                  {ltv ? (
                    <>
                      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Нийт зарцуулсан</p>
                          <p className="text-2xl font-bold tabular-nums text-primary">{fmtPrice(ltv.totalSpent)}</p>
                        </div>
                        <div className="flex items-center gap-4 pb-0.5">
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-bold tabular-nums">{ltv.orderCount}</p>
                              <p className="text-[11px] text-muted-foreground">захиалга</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-bold tabular-nums">{fmtPrice(ltv.avgOrder)}</p>
                              <p className="text-[11px] text-muted-foreground">дундаж</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      {(ltv.firstPurchase || ltv.lastPurchase) && (
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
                          {ltv.firstPurchase && (
                            <span className="flex items-center gap-1.5">
                              <CreditCard className="h-3.5 w-3.5" />
                              Эхний худалдалт: <span className="font-medium text-foreground">{fmtDate(ltv.firstPurchase)}</span>
                            </span>
                          )}
                          {ltv.lastPurchase && (
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              Сүүлийн: <span className="font-medium text-foreground">{fmtDate(ltv.lastPurchase)}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Худалдан авалт хараахан алга</p>
                  )}
                </div>
              )}

              {/* ─── Сонирхол (top ангилал / бүтээгдэхүүн) ─── */}
              {interests && (interests.topCategories.length > 0 || interests.topProducts.length > 0) && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Heart className="h-4 w-4 text-rose-500" />
                    Сонирхол
                  </p>
                  {interests.topCategories.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs text-muted-foreground">Хамгийн их сонирхсон ангилал</p>
                      <div className="flex flex-wrap gap-1.5">
                        {interests.topCategories.map((c) => (
                          <Badge key={c.name} variant="secondary">
                            {c.name}
                            <span className="ml-1 text-muted-foreground">×{c.count}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {interests.topProducts.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs text-muted-foreground">Хамгийн их үзсэн бүтээгдэхүүн</p>
                      <div className="space-y-1.5">
                        {interests.topProducts.map((p) => (
                          <div key={p.slug} className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                            <Eye className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                            <span className="min-w-0 flex-1 truncate">{p.title}</span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{p.views} үзэлт</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard icon={ShoppingCart} label="Нийт захиалга" value={s?.ordersTotal ?? 0} tone="bg-muted text-primary" />
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

            {/* ─── МИНИЙ САН (бодит эзэмшил — хэрэглэгчид харагдаж байгаагаар) ─── */}
            <TabsContent value="library" className="m-0 flex-1 overflow-y-auto p-5">
              {/* Тайлбар: энэ нь хэрэглэгчийн "Миний сан" хуудастай ЯГ ижил.
                  Захиалга PAID байгаад энд ороогүй бол алдаа → гомдол шийдэх. */}
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 dark:border-blue-900/50 dark:bg-blue-950/30">
                <Library className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Хэрэглэгчийн &ldquo;Миний сан&rdquo;-д ЯГ харагдаж байгаа эзэмшил. Хэрэв
                  төлбөртэй захиалга байгаад энд бүтээгдэхүүн харагдахгүй бол алдаа гарсан —
                  хэрэглэгч санаа олохгүй байна. Захиалгын тоотой тулгаж шалгана уу.
                </p>
              </div>

              {/* PAID захиалга байгаад санд ороогүй бол анхааруулга */}
              {!libLoading && library && s && s.paidOrders > 0 && library.length === 0 && (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 px-3.5 py-2.5 dark:border-red-900/50 dark:bg-red-950/30">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <p className="text-xs text-red-700 dark:text-red-300">
                    <span className="font-semibold">Анхаар:</span> {s.paidOrders} төлбөртэй захиалга
                    байгаа ч &ldquo;Миний сан&rdquo; ХООСОН байна. Бүтээгдэхүүн идэвхжээгүй —
                    шалгаж засах шаардлагатай.
                  </p>
                </div>
              )}

              {libLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : !library || library.length === 0 ? (
                <Empty icon={Library} text="Миний сан хоосон (идэвхтэй эзэмшил алга)" />
              ) : (
                <div className="space-y-2.5">
                  {library.map((entry) => {
                    const fileCount =
                      entry.product.files.length +
                      entry.product.bundleFiles.length +
                      (entry.product.downloadFileKey ? 1 : 0);
                    const expiresAt = entry.expiresAt ? new Date(entry.expiresAt) : null;
                    const daysLeft =
                      expiresAt && !entry.isExpired
                        ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000))
                        : null;
                    return (
                      <div
                        key={`${entry.orderId}-${entry.product.id}`}
                        className={`flex items-center gap-3 rounded-xl border bg-card p-3 ${
                          entry.isExpired ? 'border-red-200 dark:border-red-900/50' : 'border-border'
                        }`}
                      >
                        {/* Зураг */}
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {entry.product.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={entry.product.thumbnailUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        {/* Нэр + meta */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{entry.product.title}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <FileStack className="h-3 w-3" />
                              {fileCount} файл
                            </span>
                            <span>{fmtDate(entry.purchasedAt)}-нд авсан</span>
                            <span className="font-mono text-[10px]">
                              #{entry.orderId.slice(-8).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        {/* Идэвхтэй / хугацаа дууссан */}
                        {entry.isExpired ? (
                          <Badge variant="destructive" className="shrink-0">
                            <Clock className="mr-1 h-3 w-3" />Хугацаа дууссан
                          </Badge>
                        ) : daysLeft != null ? (
                          <Badge variant={daysLeft <= 7 ? 'warning' : 'success'} className="shrink-0">
                            <Clock className="mr-1 h-3 w-3" />{daysLeft} хоног
                          </Badge>
                        ) : (
                          <Badge variant="success" className="shrink-0">
                            <CheckCircle2 className="mr-1 h-3 w-3" />Идэвхтэй
                          </Badge>
                        )}
                      </div>
                    );
                  })}
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
                        <p className="truncate text-sm font-medium">{d.productTitle ?? d.fileName}</p>
                        {d.productTitle && <p className="truncate text-xs text-muted-foreground">{d.fileName}</p>}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        d.source === 'paid'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                          : d.source === 'bundle'
                            ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                      }`}>
                        {d.source === 'paid' ? 'Төлбөртэй' : d.source === 'bundle' ? 'Багц' : 'Үнэгүй'}
                      </span>
                      <p className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(d.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ─── ЧАТ ─── */}
            <TabsContent value="chat" className="m-0 flex-1 overflow-y-auto p-5">
              {chats.length === 0 ? (
                <Empty icon={MessageCircle} text="Чатын яриа алга" />
              ) : (
                <div className="space-y-3">
                  {conversion && (conversion.chatted || conversion.purchasedAfterChat) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {conversion.chatted && (
                        <Badge variant="info"><MessageCircle className="mr-1 h-3 w-3" />Чатласан</Badge>
                      )}
                      {conversion.purchasedAfterChat && (
                        <Badge variant="success"><Sparkles className="mr-1 h-3 w-3" />Чатын дараа худалдсан</Badge>
                      )}
                    </div>
                  )}
                  {chats.map((conv) => <ChatConversationCard key={conv.id} conv={conv} />)}
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

              {/* Сагсалсан бүтээгдэхүүн */}
              <div>
                <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
                  <ShoppingCart className="h-4 w-4 text-green-500" />
                  Сагсалсан ({data.cartedProducts.length})
                </p>
                {data.cartedProducts.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">Бүртгэл алга</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.cartedProducts.slice(0, 50).map((e) => (
                      <div key={e.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                        <ShoppingCart className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{e.productTitle}</span>
                        <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(e.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ─── ХАЙЛТ / ХАНДАЛТ ─── */}
            <TabsContent value="behavior" className="m-0 flex-1 overflow-y-auto p-5 space-y-5">
              {/* Хайлтын түүх */}
              <div>
                <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
                  <Search className="h-4 w-4 text-blue-500" />
                  Хайлтын түүх ({data.searchHistory.length})
                </p>
                {data.searchHistory.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">Бүртгэл алга</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.searchHistory.slice(0, 50).map((e) => (
                      <div key={e.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">&ldquo;{e.query}&rdquo;</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{e.results} үр дүн</span>
                        <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(e.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Хандсан хуудас */}
              <div>
                <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
                  <Globe className="h-4 w-4 text-cyan-500" />
                  Хандсан хуудас ({data.pageViews.length})
                </p>
                {data.pageViews.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">Бүртгэл алга</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.pageViews.slice(0, 80).map((e) => (
                      <div key={e.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                        <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate font-mono text-xs">{e.path}</span>
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
            </TabsContent>

            {/* ─── ИМЭЙЛ ТҮҮХ ─── */}
            <TabsContent value="email" className="m-0 flex-1 overflow-y-auto p-5">
              {emails.length === 0 ? (
                <Empty icon={Mail} text="Имэйл илгээгээгүй" />
              ) : (
                <div className="space-y-2">
                  {emails.map((em) => {
                    const st = EMAIL_STATUS[em.status] ?? { label: em.status, variant: 'secondary' as const };
                    return (
                      <div key={em.id} className="rounded-xl border border-border bg-card p-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 flex-1 text-sm font-semibold leading-snug wrap-break-word">{em.subject}</p>
                          <Badge variant={st.variant} className="shrink-0">{st.label}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{emailCampaignLabel(em.campaign)}</Badge>
                          {/* Нээлт — campaign-аар тааруулсан. Гүйлгээний имэйлд нээлт хэмжихгүй (—). */}
                          {em.campaign ? (
                            em.opened ? (
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" />Нээсэн
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <X className="h-3.5 w-3.5" />Нээгээгүй
                              </span>
                            )
                          ) : (
                            <span>—</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {fmtDateTime(em.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ─── SMS / УТАС БАТАЛГААЖУУЛАЛТ (verify.mn) ─── */}
            <TabsContent value="sms" className="m-0 flex-1 overflow-y-auto p-5">
              {sms.length === 0 ? (
                <Empty icon={MessageSquare} text="Утас баталгаажуулаагүй" />
              ) : (
                <div className="space-y-2">
                  {sms.map((sm) => {
                    const st = SMS_STATUS[sm.status] ?? { label: sm.status, variant: 'secondary' as const };
                    return (
                      <div key={sm.id} className="rounded-xl border border-border bg-card p-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold leading-snug">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            {sm.phone}
                          </p>
                          <Badge variant={st.variant} className="shrink-0">{st.label}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {/* Баталгаажсан огноо */}
                          {sm.verifiedAt ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Баталгаажсан: {fmtDateTime(sm.verifiedAt)}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <X className="h-3.5 w-3.5" />
                              Баталгаажаагүй
                            </span>
                          )}
                          {/* Эхэлсэн огноо */}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Эхэлсэн: {fmtDateTime(sm.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ─── ТУСЛАМЖ (Help video / FAQ үзэлт) ─── */}
            <TabsContent value="help" className="m-0 flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <p className="mb-2.5 text-sm font-semibold">Видео заавар үзсэн ({helpViews.length})</p>
                {helpViews.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">Үзэлт алга</p>
                ) : (
                  <div className="space-y-1.5">
                    {helpViews.map((v) => (
                      <div key={v.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{v.title}</span>
                        {/* Хаанаас үзсэн: бүтээгдэхүүний хуудас эсвэл Туслах самбар */}
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          v.source === 'product'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {v.source === 'product' ? 'Бүтээгдэхүүн' : 'Туслах самбар'}
                        </span>
                        {v.device && <span className="shrink-0 text-[11px] text-muted-foreground">{v.device}</span>}
                        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(v.viewedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="mb-2.5 text-sm font-semibold">FAQ үзсэн ({faqViews.length})</p>
                {faqViews.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">Үзэлт алга</p>
                ) : (
                  <div className="space-y-1.5">
                    {faqViews.map((f) => (
                      <div key={f.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{f.question}</span>
                        {f.device && <span className="shrink-0 text-[11px] text-muted-foreground">{f.device}</span>}
                        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(f.viewedAt)}</span>
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
                              {log.newValue && <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">{log.newValue}</span>}
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
