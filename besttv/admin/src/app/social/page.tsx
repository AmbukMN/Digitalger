'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  Facebook,
  Instagram,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatDateTime } from '@besttv/shared';
import { useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { AdminErrorState } from '@/components/admin-error-state';
import { TableEmptyState } from '@/components/table-empty-state';
import { api } from '@/lib/api';
import { SocialComposer } from '@/components/social/composer';
import { SocialSlots } from '@/components/social/slots';
import type { SocialPost, ChannelInfo } from '@/components/social/types';
import { CHANNEL_META, STATUS_META } from '@/components/social/types';

const TABS = [
  { key: 'SCHEDULED', label: 'Товлосон' },
  { key: 'DRAFT', label: 'Ноорог' },
  { key: 'PUBLISHED', label: 'Нийтэлсэн' },
  /**
   * ⚠️ `PARTIAL` нь ХАМГИЙН яаралтай төлөв (FB болсон, IG болоогүй)
   * атлаа өмнө нь ямар ч табд харагддаггүй байв — зөвхөн «Бүгд»-д.
   * `ATTENTION` нь FAILED + PARTIAL хоёуланг шүүнэ.
   */
  { key: 'ATTENTION', label: 'Анхаарах' },
  { key: 'ALL', label: 'Бүгд' },
] as const;

export default function SocialPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [tab, setTab] = useState<string>('SCHEDULED');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<SocialPost | null>(null);
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-social-posts', tab],
    queryFn: () => api<SocialPost[]>(`/admin/social/posts?status=${tab}&limit=100`),
    /* ⚠️ Товлосон постууд цагтаа явдаг тул шинэчилж байх ёстой */
    refetchInterval: tab === 'SCHEDULED' || tab === 'ALL' ? 30_000 : false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: channels } = useQuery({
    queryKey: ['admin-social-channels'],
    queryFn: () => api<ChannelInfo>('/admin/social/channels'),
    refetchInterval: 60_000,
  });

  const posts = useMemo(() => data ?? [], [data]);

  const reload = () => {
    qc.invalidateQueries({ queryKey: ['admin-social-posts'] });
    qc.invalidateQueries({ queryKey: ['admin-social-channels'] });
  };

  const publishNow = async (p: SocialPost) => {
    const ok = await confirm({
      title: 'Одоо нийтлэх үү?',
      description: p.body.slice(0, 120) || '(текстгүй)',
      bullets: [
        `Сувгууд: ${p.targets.map((t) => CHANNEL_META[t.channel].label).join(', ')}`,
        'Товлолт цуцлагдаж, шууд илгээгдэнэ',
      ],
      confirmLabel: 'Нийтлэх',
    });
    if (!ok) return;
    setBusy(p.id);
    try {
      await api(`/admin/social/posts/${p.id}/publish-now`, { method: 'POST' });
      toast.success('Илгээгдлээ');
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setBusy(null);
    }
  };

  /**
   * ⚠️⚠️ ЗӨВХӨН УНАСАН сувгийг дахин — нийтлэгдсэнийг ХӨНДӨХГҮЙ.
   * Эс бөгөөс FB дээр ДАВХАР пост үүснэ.
   */
  const retry = async (p: SocialPost) => {
    setBusy(p.id);
    try {
      const r = await api<{ retried: number }>(`/admin/social/posts/${p.id}/retry`, {
        method: 'POST',
      });
      toast.success(`${r.retried} суваг дахин дараалалд орлоо`);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setBusy(null);
    }
  };

  const duplicate = async (p: SocialPost) => {
    setBusy(p.id);
    try {
      await api(`/admin/social/posts/${p.id}/duplicate`, { method: 'POST' });
      toast.success('Хуулбар ноорог болж үүслээ');
      setTab('DRAFT');
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (p: SocialPost) => {
    const ok = await confirm({
      title: 'Постыг устгах уу?',
      description: p.body.slice(0, 120) || '(текстгүй)',
      bullets: ['Сэргээх боломжгүй'],
      confirmLabel: 'Устгах',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api(`/admin/social/posts/${p.id}`, { method: 'DELETE' });
      toast.success('Устгагдлаа');
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    }
  };

  const togglePause = async (channel: 'FACEBOOK' | 'INSTAGRAM') => {
    const cur = channels?.paused?.[channel] ?? false;
    try {
      await api('/admin/social/channels/pause', {
        method: 'PATCH',
        body: JSON.stringify({ channel, paused: !cur }),
      });
      toast.success(
        !cur
          ? `${CHANNEL_META[channel].label} зогсоов — товлосон пост явахгүй`
          : `${CHANNEL_META[channel].label} сэргэлээ`,
      );
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    }
  };

  return (
    <AdminShell>
      <AdminTopbar
        title="Нийтлэл товлогч"
        subtitle="Facebook болон Instagram руу зэрэг нийтлэх"
      />

      <div className="space-y-4 p-4 md:p-6">
        {/* ── Сувгийн төлөв ── */}
        <div className="flex flex-wrap items-center gap-2">
          {(['FACEBOOK', 'INSTAGRAM'] as const).map((ch) => {
            const meta = CHANNEL_META[ch];
            const paused = channels?.paused?.[ch] ?? false;
            const Icon = meta.Icon;
            return (
              <button
                key={ch}
                onClick={() => togglePause(ch)}
                title={paused ? 'Сэргээх' : 'Түр зогсоох'}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                  paused
                    ? 'border-warning/40 bg-warning/10 text-warning'
                    : 'border-border text-muted-foreground hover:bg-accent',
                )}
              >
                <Icon size={13} />
                {meta.label}
                {paused ? <Pause size={11} /> : <Play size={11} />}
                {paused && <span>зогссон</span>}
              </button>
            );
          })}

          {/* ⚠️ IG-ийн 24 цагийн квот — хэтрэхээс ӨМНӨ мэдэгдэнэ */}
          {channels?.igQuota && (
            <span
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-xs font-medium',
                channels.igQuota.used / channels.igQuota.cap > 0.8
                  ? 'bg-warning/15 text-warning'
                  : 'bg-accent text-muted-foreground',
              )}
            >
              IG квот {channels.igQuota.used}/{channels.igQuota.cap}
            </span>
          )}

          <div className="ml-auto flex gap-2">
            <button onClick={() => setSlotsOpen(true)} className="btn-secondary">
              <Settings2 size={14} /> Хуваарь
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setComposerOpen(true);
              }}
              className="btn-primary"
            >
              <Plus size={14} /> Шинэ пост
            </button>
          </div>
        </div>

        {/* ⚠️ Зогсоосон суваг байвал ТОДООР — Buffer дээр энэ нь
            календарь дээр харагддаггүй бөгөөд «яагаад пост явахгүй
            байна» гэсэн эргэлзээ үүсгэдэг */}
        {channels?.paused &&
          Object.entries(channels.paused).some(([, v]) => v) && (
            <p className="flex items-center gap-1.5 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-warning">
              <Pause size={13} className="shrink-0" />
              Зогсоосон суваг байна — товлосон постууд тэр сувагт ЯВАХГҮЙ
              (дараалалдаа хэвээр үлдэнэ)
            </p>
          )}

        {/* ── Табууд ── */}
        <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                tab === t.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-50"
            aria-label="Шинэчлэх"
          >
            <RefreshCw size={14} className={cn(isFetching && 'animate-spin')} />
          </button>
        </div>

        {/* ── Жагсаалт ── */}
        {isError ? (
          <AdminErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="admin-skeleton h-28 rounded-xl" />
            ))}
          </div>
        ) : !posts.length ? (
          <TableEmptyState
            icon={CalendarClock}
            message={
              tab === 'SCHEDULED'
                ? 'Товлосон пост байхгүй — «Шинэ пост» дарж эхлүүлнэ үү'
                : 'Пост байхгүй'
            }
          />
        ) : (
          <div className="space-y-2">
            {posts.map((p) => (
              <PostRow
                key={p.id}
                post={p}
                busy={busy === p.id}
                onEdit={() => {
                  setEditing(p);
                  setComposerOpen(true);
                }}
                onPublishNow={() => publishNow(p)}
                onRetry={() => retry(p)}
                onDuplicate={() => duplicate(p)}
                onRemove={() => remove(p)}
              />
            ))}
          </div>
        )}
      </div>

      {composerOpen && (
        <SocialComposer
          post={editing}
          onClose={() => {
            setComposerOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            setComposerOpen(false);
            setEditing(null);
            reload();
          }}
        />
      )}

      {slotsOpen && <SocialSlots onClose={() => setSlotsOpen(false)} onSaved={reload} />}
    </AdminShell>
  );
}

// ─── Постын мөр ────────────────────────────────────────────────────────────

function PostRow({
  post,
  busy,
  onEdit,
  onPublishNow,
  onRetry,
  onDuplicate,
  onRemove,
}: {
  post: SocialPost;
  busy: boolean;
  onEdit: () => void;
  onPublishNow: () => void;
  onRetry: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const st = STATUS_META[post.status] ?? STATUS_META.DRAFT;
  const hasFailed = post.targets.some((t) => t.status === 'FAILED');
  const canEdit = post.status === 'DRAFT' || post.status === 'SCHEDULED';

  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-3 transition-colors',
        post.status === 'FAILED' || post.status === 'PARTIAL'
          ? 'border-destructive/35'
          : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        {/* Медиа */}
        {post.mediaUrls?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.mediaUrls[0]}
            alt=""
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span
              className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', st.cls)}
            >
              {st.label}
            </span>
            {/* Суваг тус бүрийн ТУСДАА төлөв */}
            {post.targets.map((t) => {
              const m = CHANNEL_META[t.channel];
              const Icon = m.Icon;
              const ok = t.status === 'PUBLISHED';
              const bad = t.status === 'FAILED';
              return (
                <span
                  key={t.id}
                  title={t.error ?? t.status}
                  className={cn(
                    'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold',
                    ok
                      ? 'bg-success/15 text-success'
                      : bad
                        ? 'bg-destructive/15 text-destructive'
                        : m.cls,
                  )}
                >
                  <Icon size={10} />
                  {m.label}
                  {ok && <CheckCircle2 size={9} />}
                  {bad && <XCircle size={9} />}
                </span>
              );
            })}
            {post.scheduledAt && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock size={10} />
                {formatDateTime(post.scheduledAt)}
                {/* ⚠️ NEXT_AVAILABLE постууд хуваарь солиход ШИЛЖИНЭ */}
                {post.scheduleKind === 'NEXT_AVAILABLE' && (
                  <span title="Хуваарь өөрчлөгдөхөд шилжинэ">· дараалал</span>
                )}
              </span>
            )}
          </div>

          <p className="line-clamp-2 text-sm text-foreground">
            {post.body || <span className="text-muted-foreground">(текстгүй)</span>}
          </p>

          {/* ⚠️ Алдааны шалтгааныг ИЛ — админ юу хийхээ мэдэх ёстой */}
          {post.targets
            .filter((t) => t.error)
            .map((t) => (
              <p
                key={t.id}
                className="mt-1 flex items-start gap-1 text-[11px] text-destructive"
              >
                <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                {CHANNEL_META[t.channel].label}: {t.error}
              </p>
            ))}
        </div>

        {/* Үйлдлүүд */}
        <div className="flex shrink-0 items-center gap-1">
          {busy && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          {hasFailed && (
            <button
              onClick={onRetry}
              disabled={busy}
              title="Зөвхөн УНАСАН сувгийг дахин илгээх"
              className="rounded-md p-1.5 text-warning hover:bg-warning/10 disabled:opacity-50"
            >
              <RefreshCw size={14} />
            </button>
          )}
          {canEdit && (
            <button
              onClick={onPublishNow}
              disabled={busy}
              title="Одоо нийтлэх"
              className="rounded-md p-1.5 text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          )}
          <button
            onClick={onDuplicate}
            disabled={busy}
            title="Хуулж дахин товлох"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            <Copy size={14} />
          </button>
          {canEdit && (
            <button
              onClick={onEdit}
              className="rounded-md px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              Засах
            </button>
          )}
          <button
            onClick={onRemove}
            title="Устгах"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
