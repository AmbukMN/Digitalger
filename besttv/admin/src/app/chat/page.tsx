'use client';

import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bot,
  Headphones,
  Loader2,
  MessagesSquare,
  Search,
  Send,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { Badge, useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { CardSkeleton } from '@/components/table-skeleton';
import { Pagination } from '@/components/pagination';
import { api } from '@/lib/api';
import { runMutation } from '@/lib/mutate';
import { BulkBar, SelectBox, useBulkSelect } from '@/lib/use-bulk-select';

interface ConvListItem {
  id: string;
  channel: string;
  sessionId: string;
  userName: string | null;
  userEmail: string | null;
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
    titles?: { title: string; slug: string }[] | null;
    createdAt: string;
  }[];
}

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'Дөнгөж сая';
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} цаг`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} хоног`;
  return new Date(iso).toLocaleDateString('mn-MN');
}

export default function ChatPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);
  /* ⚠️ Хайлт — 51+ дэх яриа руу хүрэх цорын ганц зам байсан */
  const [q, setQ] = useState('');
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
    queryKey: ['admin-chat-list', onlyUnread, q, page],
    queryFn: () =>
      api<{ items: ConvListItem[]; total: number; unreadTotal: number; totalPages?: number }>(
        `/admin/chat/conversations?pageSize=30&page=${page}` +
          (onlyUnread ? '&onlyUnread=1' : '') +
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

  const send = async () => {
    const text = reply.trim();
    if (!text || !selected || sending) return;
    setSending(true);
    try {
      await api(`/admin/chat/conversations/${selected}/reply`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
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
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-foreground">
                        {name[0]?.toUpperCase() ?? '?'}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                        {name}
                      </p>
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
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {(detail.user?.name ?? detail.userName ?? detail.user?.email ?? 'З')[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {detail.user?.name ?? detail.userName ?? 'Зочин'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {detail.user?.email ?? detail.userEmail ?? detail.sessionId}
                  </p>
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
                    <div key={m.id} className={cn('flex', isUser ? 'justify-start' : 'justify-end')}>
                      <div className={cn('max-w-[70%]')}>
                        <p
                          className={cn(
                            'mb-1 flex items-center gap-1 text-[10px] font-medium',
                            isUser ? 'text-muted-foreground' : isAdmin ? 'text-success' : 'text-primary',
                          )}
                        >
                          {isUser ? <UserIcon size={10} /> : isAdmin ? <Headphones size={10} /> : <Bot size={10} />}
                          {isUser ? 'Хэрэглэгч' : isAdmin ? 'Админ (та)' : 'AI туслах'}
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
                        {Array.isArray(m.titles) && m.titles.length > 0 && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            🎬 Санал болгосон: {m.titles.map((t) => t.title).join(', ')}
                          </p>
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
