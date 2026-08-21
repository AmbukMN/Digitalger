'use client';

import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bot,
  Film,
  Headphones,
  Loader2,
  MessagesSquare,
  Paperclip,
  Search,
  Send,
  Sparkles,
  User as UserIcon,
  Globe,
  Facebook,
  Instagram,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatDate } from '@besttv/shared';
import { Badge, useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { CardSkeleton } from '@/components/table-skeleton';
import { Pagination } from '@/components/pagination';
import { UserAvatar } from '@/components/user-avatar';
import { api } from '@/lib/api';
import { runMutation } from '@/lib/mutate';
import { BulkBar, SelectBox, useBulkSelect } from '@/lib/use-bulk-select';

/**
 * Сувгийн тэмдэг — яриа хаанаас ирснийг нэг харцаар.
 *
 * ⚠️⚠️ БҮХ СУВАГТ тэмдэг тавина (админы хүсэлт). Өмнө нь вэбийнхэд
 * тэмдэг ОГТ байхгүй байсан тул админ «тэмдэггүй = вэб» гэж ТААМАГЛАХ
 * шаардлагатай болдог байв — шинэ ажилтанд ойлгомжгүй, мөн тэмдэг
 * ачаалагдаагүй эсэхийг ялгах аргагүй.
 *
 * ⚠️ Гэхдээ ЯЛГАРАЛ хадгалагдана: вэб нь СААРАЛ (чимээгүй), FB/IG нь
 * брэндийн ӨНГӨТЭЙ. Ингэснээр 10 вэб ярианы дунд 2 FB яриа шууд
 * харагдана — жагсаалт «дүүрэхгүй».
 *
 * ⚠️ Сувгийн нэрийг ҮРГЭЛЖ энэ газраас авна — өөр газар шууд бичвэл
 * (жишээ: шүүлтийн товч) зөрөх эрсдэлтэй.
 */
const CHANNEL_META: Record<
  string,
  { label: string; full: string; cls: string; Icon: typeof Globe }
> = {
  web: {
    label: 'Вэб',
    full: 'Вэб сайтын чат',
    /* ⚠️ Саарал — олон байдаг тул анхаарал татах ёсгүй */
    cls: 'bg-muted text-muted-foreground',
    Icon: Globe,
  },
  facebook: {
    label: 'FB',
    full: 'Facebook Messenger',
    cls: 'bg-[#1877F2]/15 text-[#1877F2]',
    Icon: Facebook,
  },
  instagram: {
    label: 'IG',
    full: 'Instagram DM',
    cls: 'bg-[#E1306C]/15 text-[#E1306C]',
    Icon: Instagram,
  },
};

function ChannelBadge({ channel, size = 'sm' }: { channel: string; size?: 'sm' | 'md' }) {
  /* ⚠️ Танихгүй суваг ирвэл (ирээдүйн WhatsApp гэх мэт) нэрийг нь
     хэвээр харуулна — `null` буцаавал ЧИМЭЭГҮЙ алга болно */
  const meta = CHANNEL_META[channel] ?? {
    label: channel,
    full: channel,
    cls: 'bg-muted text-muted-foreground',
    Icon: Globe,
  };
  const { Icon } = meta;
  return (
    <span
      title={meta.full}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded font-bold leading-none',
        meta.cls,
        size === 'md' ? 'px-2 py-1 text-[11px]' : 'px-1.5 py-0.5 text-[10px]',
      )}
    >
      <Icon size={size === 'md' ? 12 : 10} className="shrink-0" />
      {meta.label}
    </span>
  );
}

/**
 * ⚠️ Ярианы аватар нь `UserAvatar`-ыг ашиглана (тусдаа хуулбар БАЙХГҮЙ).
 *
 * Өмнө нь энд `ChatAvatar` гэсэн БАРАГ ИЖИЛ компонент байсан — `onError`
 * fallback, `no-referrer`, хэмжээ бүгд давхардсан. Нэгийг нь зассан
 * алдаа нөгөөд үлдэх эрсдэлтэй.
 *
 * ⚠️ Backend нь `userImage`-д FB/IG зураг ЭСВЭЛ манай сайтын аватарын
 * presigned URL-ийг хийж өгдөг (FB/IG давуу — сувгийн бодит нүүр).
 */

interface ConvListItem {
  id: string;
  channel: string;
  sessionId: string;
  userName: string | null;
  userEmail: string | null;
  /** FB/IG профайл зураг — админ хэнтэй ярьж буйгаа нүүрээр таана */
  userImage: string | null;
  adminUnread: boolean;
  handedOff: boolean;
  lastMessageAt: string;
  user: { id: string; name: string | null; email: string } | null;
  messages: { text: string; role: string }[];
  _count: { messages: number };
}

interface ConvDetail extends ConvListItem {
  messages: {
    id: string;
    role: string;
    text: string;
    titles?: {
      title: string;
      slug: string;
      posterUrl?: string;
      url?: string;
      year?: number;
      rating?: number;
    }[] | null;
    /** FB/IG-ээс ирсэн баримтын зураг (R2-д хадгалагдсан) */
    attachmentUrl?: string;
    attachmentType?: string;
    createdAt: string;
  }[];
  /** Хэрэглэгчийн идэвхтэй багцууд — «төлбөртэй юу?» гэдгийг мэдэх */
  subscriptions?: { expiresAt: string; plan: { name: string; isVip: boolean } | null }[];
}

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'Дөнгөж сая';
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} цаг`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} хоног`;
  return formatDate(iso);
}

export default function ChatPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);
  /* ⚠️ Хайлт — 51+ дэх яриа руу хүрэх цорын ганц зам байсан */
  const [q, setQ] = useState('');
  /* ⚠️ Сувгийн шүүлт — '' = бүгд. FB/IG чатбот ажилласнаар вэбийн
     яриатай холилдоно, ялгаж харах шаардлагатай. */
  const [channel, setChannel] = useState('');
  const [page, setPage] = useState(1);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const qc = useQueryClient();
  /* Олноор устгах — тест яриа их хуримтлагддаг */
  const sel = useBulkSelect({
    endpoint: '/admin/chat/conversations/bulk-delete',
    invalidate: ['admin-chat-list', 'admin-chat-unread', 'admin-chat-detail'],
    label: 'яриа',
  });
  const confirm = useConfirm();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Жагсаалт — 15 сек тутам шинэчилнэ (шинэ чат ирэхийг барина)
  const { data: list, isLoading } = useQuery({
    queryKey: ['admin-chat-list', onlyUnread, q, page, channel],
    queryFn: () =>
      api<{
        items: ConvListItem[];
        total: number;
        unreadTotal: number;
        channelCounts?: Record<string, number>;
        totalPages?: number;
      }>(
        `/admin/chat/conversations?pageSize=30&page=${page}` +
          (onlyUnread ? '&onlyUnread=1' : '') +
          (channel ? `&channel=${channel}` : '') +
          (q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''),
      ),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    /* ⚠️ Хайх/хуудас солиход жагсаалт АНИВЧИХГҮЙ (хуучин дата үлдэнэ) */
    placeholderData: keepPreviousData,
  });

  // Сонгосон яриа — 6 сек тутам (хэрэглэгчийн шинэ мессежийг хурдан харах)
  const { data: detail, isFetching: loadingDetail } = useQuery({
    queryKey: ['admin-chat-detail', selected],
    queryFn: () => api<ConvDetail>(`/admin/chat/conversations/${selected}`),
    enabled: !!selected,
    refetchInterval: 6_000,
    staleTime: 0,
  });

  // Шинэ мессеж ирэхэд доош гүйлгэнэ
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [detail?.messages?.length]);

  /**
   * ⚠️⚠️ ЯРИА НЭЭМЭГЦ «шинэ» тоог ШУУД цэвэрлэнэ.
   *
   * БОДИТ АЛДАА: backend нь `getConversation`-д `adminUnread=false`
   * болгодог АТЛАА frontend нь жагсаалт/badge-аа дахин татдаггүй байв.
   * Тиймээс уншсан яриа «шинэ» хэвээр 15 секунд харагдаж, админ өөр
   * хуудас руу ороод буцаж ирж байж л тоо арилдаг байлаа.
   *
   * ⚠️ Мессежийн ТОО-г ч хамааралд оруулав: нээлттэй яриа руу шинэ
   * мессеж ирэхэд backend дахин `adminUnread=true` болгодог. Дараагийн
   * таталт (6 сек) түүнийг `false` болгоно — тэр мөчид жагсаалтаа ч
   * шинэчилж байж badge үнэн утгаа хадгална.
   */
  useEffect(() => {
    if (!detail?.id) return;
    void qc.invalidateQueries({ queryKey: ['admin-chat-list'] });
    void qc.invalidateQueries({ queryKey: ['admin-chat-unread'] });
    /* Sidebar-ийн «Чат N» badge — AdminShell-ээс тусад нь татагддаг */
    void qc.invalidateQueries({ queryKey: ['admin-badges'] });
  }, [detail?.id, detail?.messages?.length, qc]);

  const send = async () => {
    const text = reply.trim();
    if (!text || !selected || sending) return;
    setSending(true);
    try {
      const res = await api<{ ok: boolean; delivered?: boolean }>(
        `/admin/chat/conversations/${selected}/reply`,
        { method: 'POST', body: JSON.stringify({ text }) },
      );
      /**
       * ⚠️ FB/IG-д хариу Messenger рүү илгээгддэг. Илгээлт УНАСАН
       * (token хүчингүй, 24 цагийн цонх хаагдсан) тохиолдолд админд
       * ХЭЛНЭ — эс бөгөөс "хариулчихлаа" гэж бодоод орхиж, хэрэглэгч
       * хариу хүлээсээр үлдэнэ.
       */
      if (res?.delivered === false) {
        toast.warning(
          'Хадгалагдсан ч Messenger рүү илгээгдсэнгүй. Token эсвэл 24 цагийн хязгаарыг шалгана уу.',
          { duration: 8000 },
        );
      }
      setReply('');
      await qc.invalidateQueries({ queryKey: ['admin-chat-detail', selected] });
      qc.invalidateQueries({ queryKey: ['admin-chat-list'] });
      qc.invalidateQueries({ queryKey: ['admin-chat-unread'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Илгээж чадсангүй');
    } finally {
      setSending(false);
    }
  };

  const toggleHandoff = async () => {
    if (!detail) return;
    const turningOn = !detail.handedOff;
    const ok = await confirm({
      title: turningOn ? 'Чатыг өөрөө хариулах уу?' : 'AI туслахад буцаах уу?',
      description: turningOn
        ? 'Та энэ хэрэглэгчтэй шууд харилцана.'
        : 'AI туслах дахин автоматаар хариулж эхэлнэ.',
      bullets: turningOn
        ? ['AI хариулахаа БОЛИНО', 'Хэрэглэгчид "багийн гишүүнтэй ярьж байна" гэж харагдана']
        : ['Таны бичсэн мессежүүд хэвээр үлдэнэ'],
      confirmLabel: turningOn ? 'Тийм, өөрөө хариулна' : 'AI-д буцаах',
      tone: turningOn ? 'warning' : 'info',
    });
    if (!ok) return;
    /* ⚠️ try/catch БАЙГААГҮЙ — алдаа гарвал toast ч гарахгүй, админ
       "AI унтарсан" гэж бодоод хариулахгүй өнгөрөх эрсдэлтэй байв */
    await runMutation(
      () =>
        api(`/admin/chat/conversations/${detail.id}/handoff`, {
          method: 'POST',
          body: JSON.stringify({ handedOff: turningOn }),
        }),
      {
        success: turningOn ? 'Та одоо шууд хариулж байна' : 'AI туслах идэвхжлээ',
        onDone: () => {
          void qc.invalidateQueries({ queryKey: ['admin-chat-detail', selected] });
          qc.invalidateQueries({ queryKey: ['admin-chat-list'] });
        },
      },
    );
  };

  const items = list?.items ?? [];

  return (
    <AdminShell>
      <AdminTopbar
        title="Чат"
        subtitle={list ? `${list.total} яриа · ${list.unreadTotal} шинэ` : undefined}
      />

      <main className="flex h-[calc(100vh-4rem)] gap-4 p-3 pt-3 sm:p-6 sm:pt-4">
        {/*
          ── Ярианы жагсаалт ──
          ⚠️⚠️ МОБАЙЛД ЖАГСААЛТ↔ЯРИА СЭЛГЭНЭ.
          Өмнө нь `w-80 shrink-0` тогтмол байсан тул 375px дэлгэцэнд
          жагсаалт 320px эзэлж, чат цонхонд ~40px үлддэг байв —
          админ утаснаас чат хариулах БОЛОМЖГҮЙ.
          Одоо яриа сонгогдоогүй үед л жагсаалт харагдана (десктопт
          `md:flex` тул хоёулаа зэрэг).
        */}
        <div
          className={cn(
            'admin-card w-full shrink-0 flex-col overflow-hidden rounded-xl md:flex md:w-80',
            selected ? 'hidden' : 'flex',
          )}
        >
          {/* ⚠️ Хайлт — хэрэглэгчийн имэйл/нэр эсвэл зурвасын агуулгаар.
              Зочин хэрэглэгч имэйлгүй тул агуулгаар л олдоно. */}
          <div className="border-b border-border p-2.5">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                placeholder="Имэйл, нэр, зурвасаар хайх..."
                className="w-full rounded-md border border-input bg-card py-1.5 pl-8 pr-2.5 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 border-b border-border p-2.5">
            <button
              onClick={() => { setOnlyUnread(false); setPage(1); }}
              className={cn(
                'flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors',
                !onlyUnread ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
              )}
            >
              Бүгд
            </button>
            <button
              onClick={() => { setOnlyUnread(true); setPage(1); }}
              className={cn(
                'flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors',
                onlyUnread ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
              )}
            >
              Шинэ {list?.unreadTotal ? `(${list.unreadTotal})` : ''}
            </button>
          </div>

          {/*
            ⚠️ СУВГИЙН ШҮҮЛТ — зөвхөн FB/IG-ээс яриа ИРСЭН үед л
            харагдана. Чатбот асаагаагүй байхад хоосон таб харуулбал
            админ дарж шалгаад юу ч олдохгүй, эвдэрсэн мэт санагдана.
          */}
          {(() => {
            const cc = list?.channelCounts ?? {};
            const hasSocial = (cc.facebook ?? 0) > 0 || (cc.instagram ?? 0) > 0;
            if (!hasSocial) return null;
            /* ⚠️ Нэрийг CHANNEL_META-аас — badge-тэй ҮРГЭЛЖ таарна */
            const TABS: { key: string; label: string; Icon: typeof Globe | null }[] = [
              { key: '', label: 'Бүх суваг', Icon: null },
              { key: 'web', label: CHANNEL_META.web.label, Icon: CHANNEL_META.web.Icon },
              {
                key: 'facebook',
                label: CHANNEL_META.facebook.label,
                Icon: CHANNEL_META.facebook.Icon,
              },
              {
                key: 'instagram',
                label: CHANNEL_META.instagram.label,
                Icon: CHANNEL_META.instagram.Icon,
              },
            ];
            return (
              <div className="flex items-center gap-1.5 border-b border-border px-2.5 pb-2.5">
                {TABS.map((t) => {
                  /* Бүх суваг дээр тоо харуулахгүй — нийт тоо доор бий */
                  const n = t.key ? (cc[t.key] ?? 0) : 0;
                  if (t.key && n === 0) return null;
                  return (
                    <button
                      key={t.key || 'all'}
                      onClick={() => {
                        setChannel(t.key);
                        setPage(1);
                      }}
                      className={cn(
                        'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors',
                        channel === t.key
                          ? 'bg-foreground/10 text-foreground'
                          : 'text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {t.Icon && <t.Icon size={11} className="shrink-0" />}
                      {t.label}
                      {t.key ? ` ${n}` : ''}
                    </button>
                  );
                })}
              </div>
            );
          })()}

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              /* ⚠️ Spinner БИШ skeleton — ярианы мөрийн бүтэц урьдчилж
                 харагдана (аватар + 2 мөр текст) */
              <div className="p-2.5">
                <CardSkeleton count={5} />
              </div>
            ) : items.length === 0 ? (
              <TableEmptyState icon={MessagesSquare} message="Яриа байхгүй байна" />
            ) : (
              items.map((c) => {
                const last = c.messages[0];
                const name = c.user?.name ?? c.userName ?? c.user?.email ?? c.userEmail ?? 'Зочин';
                return (
                  /*
                   * ⚠️ Гадна нь `div` — өмнө нь `button` байсан. Bulk сонголтын
                   * checkbox нь ИНТЕРАКТИВ элемент тул `button` дотор үүрлэвэл
                   * HTML буруу болж, дарахад хоёулаа зэрэг ажилладаг.
                   */
                  <div
                    key={c.id}
                    className={cn(
                      'flex items-start gap-2 border-b border-border px-3 py-2.5 transition-colors',
                      selected === c.id ? 'bg-primary/10' : 'hover:bg-accent/50',
                    )}
                  >
                    <div className="pt-1.5">
                      <SelectBox
                        checked={sel.isSelected(c.id)}
                        onChange={() => sel.toggle(c.id)}
                        ariaLabel={`${name}-ийн яриаг сонгох`}
                      />
                    </div>
                    <button
                      onClick={() => setSelected(c.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                    <div className="flex items-center gap-2">
                      <UserAvatar src={c.userImage} name={name} size={28} />
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                        {name}
                      </p>
                      {/*
                        ⚠️ СУВГИЙН ТЭМДЭГ — яриа Facebook/Instagram/вэбийн
                        алинаас ирснийг ЯЛГАНА. Чатбот FB/IG-ээс мессеж
                        дамжуулж эхэлсэн тул энэ тэмдэггүй бол админ хаана
                        хариулж байгаагаа мэдэхгүй (өнгө аяс, хариу өгөх
                        хэлбэр суваг бүрд өөр).
                      */}
                      <ChannelBadge channel={c.channel} />
                      {c.adminUnread && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {last ? `${last.role === 'user' ? '' : '↩ '}${last.text}` : '—'}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">{timeAgo(c.lastMessageAt)}</span>
                      {c.handedOff && (
                        <Badge variant="warning" className="text-[9px]">
                          Гар хариу
                        </Badge>
                      )}
                      {!c.user && (
                        <Badge variant="secondary" className="text-[9px]">
                          Зочин
                        </Badge>
                      )}
                    </div>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* ⚠️⚠️ ХУУДАСЛАЛТ — өмнө нь `pageSize=50` тогтмол байсан тул
              51 дэх яриа руу хүрэх ЯМАР Ч арга байгаагүй. Одоо 30-аар
              хуудаслаж, доод талд байрлана (жагсаалт гүйлгэхэд хамт
              гүйхгүй — `shrink-0`). */}
          {(list?.totalPages ?? 1) > 1 && (
            <div className="shrink-0 border-t border-border px-2.5 py-1.5">
              <Pagination
                page={page}
                totalPages={list?.totalPages ?? 1}
                total={list?.total}
                limit={30}
                onPage={setPage}
              />
            </div>
          )}
        </div>

        {/* ── Яриа ── ⚠️ Мобайлд зөвхөн СОНГОГДСОН үед харагдана */}
        <div
          className={cn(
            'admin-card flex-1 flex-col overflow-hidden rounded-xl md:flex',
            selected ? 'flex' : 'hidden md:flex',
          )}
        >
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
              <MessagesSquare size={32} className="opacity-40" />
              {/* ⚠️ Жагсаалт хоосон үед "зүүн талаас сонго" гэдэг нь
                  ЗӨРЧИЛТЭЙ — сонгох юм байхгүй */}
              <p className="text-sm">
                {items.length ? 'Зүүн талаас яриа сонгоно уу' : 'Одоогоор яриа байхгүй байна'}
              </p>
            </div>
          ) : !detail && loadingDetail ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : detail ? (
            <>
              {/* Толгой */}
              <div className="flex items-center gap-3 border-b border-border p-3.5">
                {/* ⚠️ Мобайлд жагсаалт руу БУЦАХ — эс бөгөөс ярианаас
                    гарах ямар ч зам байхгүй болно */}
                <button
                  onClick={() => setSelected(null)}
                  aria-label="Жагсаалт руу буцах"
                  className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
                >
                  <ArrowLeft size={18} />
                </button>
                <UserAvatar
                  src={detail.userImage}
                  name={detail.user?.name ?? detail.userName}
                  email={detail.user?.email ?? detail.userEmail}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {detail.user?.name ?? detail.userName ?? 'Зочин'}
                    </p>
                    {/* ⚠️ Дэлгэрэнгүйд ч суваг — админ хариулахаасаа өмнө
                        хаана бичиж байгаагаа мэдэх ёстой.
                        ⚠️ `md` — жагсаалтынхаас ТОМ: хариу бичихийн өмнөх
                        сүүлчийн шалгах цэг тул тодорхой харагдана. */}
                    <ChannelBadge channel={detail.channel} size="md" />
                  </div>
                  {/*
                    ⚠️ Имэйл БА PSID ХОЁУЛАА. Өмнө нь `??` гинжээр имэйл
                    олдвол PSID нуугддаг байв — гэтэл FB ярианд PSID нь
                    Meta Inbox-той тулгах цорын ганц түлхүүр.
                    Чатаас автоматаар таньсан имэйл нь FB хэрэглэгчтэй
                    холбогдох цорын ганц зам тул мөн харуулна.
                  */}
                  <p className="truncate text-xs text-muted-foreground">
                    {detail.user?.email ?? detail.userEmail ?? (
                      <span className="text-muted-foreground/60">имэйлгүй</span>
                    )}
                    {(detail.channel === 'facebook' || detail.channel === 'instagram') && (
                      <span
                        title="Facebook/Instagram хэрэглэгчийн ID (Meta Inbox-д хайхад)"
                        className="ml-2 font-mono text-[10px] text-muted-foreground/60"
                      >
                        {detail.sessionId}
                      </span>
                    )}
                  </p>
                  {/*
                    ⚠️⚠️ БАГЦЫН ТӨЛӨВ — «энэ хүн төлбөртэй юу?» гэдгийг
                    мэдэхгүй бол дансаар шилжүүлсэн гомдол шийдэх
                    БОЛОМЖГҮЙ. Админ өөр таб руу орж хайх шаардлагагүй.

                    ⚠️ Зөвхөн бүртгэлтэй (userId бий) хэрэглэгчид. FB-ээс
                    шууд бичсэн зочин сайтад бүртгэлгүй байж болно.
                  */}
                  {detail.user &&
                    (detail.subscriptions?.length ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {detail.subscriptions.map((s, i) => (
                          <span
                            key={i}
                            title={`${formatDate(s.expiresAt)} хүртэл`}
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                              s.plan?.isVip
                                ? 'bg-premium/15 text-premium'
                                : 'bg-success/15 text-success',
                            )}
                          >
                            {s.plan?.isVip ? '👑 ' : '✓ '}
                            {s.plan?.name ?? 'Багц'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="mt-1 inline-block rounded bg-foreground/8 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
                        Багцгүй
                      </span>
                    ))}
                </div>
                <button
                  onClick={toggleHandoff}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                    detail.handedOff
                      ? 'bg-success/15 text-success hover:bg-success/25'
                      : 'bg-accent text-muted-foreground hover:bg-accent/70 hover:text-foreground',
                  )}
                >
                  {detail.handedOff ? <Headphones size={13} /> : <Sparkles size={13} />}
                  {detail.handedOff ? 'Би хариулж байна' : 'AI хариулж байна'}
                </button>
              </div>

              {/* Мессежүүд */}
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-accent/15 p-4">
                {detail.messages.map((m) => {
                  const isUser = m.role === 'user';
                  const isAdmin = m.role === 'admin';
                  return (
                    <div
                      key={m.id}
                      className={cn('flex gap-2', isUser ? 'justify-start' : 'justify-end')}
                    >
                      {/* ⚠️ Зөвхөн хэрэглэгчийн талд — AI/админд аватар
                          нэмбэл давхардаж, чат бөглүү харагдана */}
                      {isUser && (
                        <div className="mt-5 shrink-0">
                          <UserAvatar
                            src={detail.userImage}
                            name={detail.user?.name ?? detail.userName ?? 'Зочин'}
                            size={26}
                          />
                        </div>
                      )}
                      <div className={cn('max-w-[70%]')}>
                        <p
                          className={cn(
                            'mb-1 flex items-center gap-1 text-[10px] font-medium',
                            isUser ? 'text-muted-foreground' : isAdmin ? 'text-success' : 'text-primary',
                          )}
                        >
                          {isUser ? <UserIcon size={10} /> : isAdmin ? <Headphones size={10} /> : <Bot size={10} />}
                          {/*
                            ⚠️ НЭР БАЙВАЛ НЭРИЙГ нь бичнэ — «Хэрэглэгч» гэсэн
                            ерөнхий үг БИШ. Админ хэнтэй ярьж байгаагаа
                            мессеж бүр дээр харах ёстой (толгойд нэг л удаа
                            бичигдсэн байдаг тул гүйлгэхэд алга болно).

                            Эрэмбэ: бүртгэлтэй нэр → чатад бичсэн нэр →
                            «Зочин» (нэвтрээгүй).
                          */}
                          {isUser
                            ? (detail.user?.name ?? detail.userName ?? 'Зочин')
                            : isAdmin
                              ? 'Админ (та)'
                              : 'AI туслах'}
                          <span className="text-muted-foreground/60">· {timeAgo(m.createdAt)}</span>
                        </p>
                        <div
                          className={cn(
                            'whitespace-pre-wrap wrap-break-word rounded-2xl px-3.5 py-2.5 text-sm',
                            isUser
                              ? 'rounded-bl-md bg-card text-foreground'
                              : isAdmin
                                ? 'rounded-br-md bg-success/15 text-foreground'
                                : 'rounded-br-md bg-primary/10 text-foreground',
                          )}
                        >
                          {m.text}
                        </div>
                        {/*
                          ⚠️⚠️ БАРИМТЫН ЗУРАГ — дансаар шилжүүлсэн баримт.
                          Meta-гийн CDN линк хэдэн цагт үхдэг тул backend
                          R2 руу хуулж мөнхжүүлсэн. Админ ЭНД харж
                          баталгаажуулна — Meta Inbox руу орох шаардлагагүй.
                        */}
                        {m.attachmentUrl && (
                          <a
                            href={m.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Томоор харах"
                            className="mt-1.5 block w-fit overflow-hidden rounded-lg border border-border transition-colors hover:border-primary/50"
                          >
                            {m.attachmentType === 'image' ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.attachmentUrl}
                                alt="Хавсралт"
                                loading="lazy"
                                className="max-h-56 max-w-60 object-contain"
                              />
                            ) : (
                              <span className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-foreground">
                                <Paperclip size={13} />
                                {m.attachmentType === 'video' ? 'Бичлэг' : 'Файл'} — нээх
                              </span>
                            )}
                          </a>
                        )}
                        {/*
                          ⚠️⚠️ КИНОНЫ КАРТ — хэрэглэгч Messenger дээр ЯГ
                          ингэж (постертой карт) харсан. Өмнө нь энд зөвхөн
                          «🎬 Санал болгосон: нэр, нэр, нэр» гэсэн жижиг
                          саарал текст харуулдаг байв — админ юу илгээснийг
                          НҮДЭЭР харж чадахгүй, гомдол шалгахад ойлгомжгүй.
                        */}
                        {Array.isArray(m.titles) && m.titles.length > 0 && (
                          <div className="mt-1.5 flex max-w-full gap-2 overflow-x-auto pb-1">
                            {m.titles.map((t, ti) => (
                              <a
                                key={t.slug ?? ti}
                                href={t.url ?? `https://besttv.us/movie/${t.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={t.title}
                                className="flex w-24 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50"
                              >
                                <div className="relative aspect-2/3 w-full overflow-hidden bg-accent">
                                  {t.posterUrl ? (
                                    /* ⚠️ next/image БИШ — R2 CDN зам динамик,
                                       мөн админд оптимизаци шаардлагагүй */
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={t.posterUrl}
                                      alt={t.title}
                                      loading="lazy"
                                      referrerPolicy="no-referrer"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center text-muted-foreground">
                                      <Film size={16} />
                                    </div>
                                  )}
                                </div>
                                <div className="p-1.5">
                                  <p className="line-clamp-2 text-[10px] font-semibold leading-tight text-foreground">
                                    {t.title}
                                  </p>
                                  <p className="mt-0.5 flex items-center gap-1 text-[9px] text-muted-foreground">
                                    {t.year ? <span>{t.year}</span> : null}
                                    {t.rating ? <span>⭐ {t.rating}</span> : null}
                                  </p>
                                </div>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Хариу бичих */}
              <div className="border-t border-border p-3">
                {!detail.handedOff && (
                  <p className="mb-2 rounded-lg border border-premium/30 bg-premium/8 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                    ⚠️ Одоо AI хариулж байна. Та бичвэл хэрэглэгчид хүрнэ, гэхдээ AI ч
                    хариулсаар байх тул <strong className="text-foreground">&ldquo;Би хариулж байна&rdquo;</strong>{' '}
                    болгож тохируулахыг зөвлөж байна.
                  </p>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={2}
                    placeholder="Хариу бичих... (Enter илгээх, Shift+Enter шинэ мөр)"
                    disabled={sending}
                    className="max-h-32 min-h-13 flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary disabled:opacity-50"
                  />
                  <button
                    onClick={send}
                    disabled={!reply.trim() || sending}
                    className="flex h-13 w-13 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:brightness-110 disabled:opacity-40"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </main>
      <BulkBar {...sel.bar} />
    </AdminShell>
  );
}
