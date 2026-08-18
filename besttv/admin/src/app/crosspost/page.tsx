'use client';

import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Film,
  Images,
  Instagram,
  Loader2,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatDateTime } from '@besttv/shared';
import { useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { ImportProgress, type ImportRow } from '@/components/crosspost/import-progress';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableSkeleton } from '@/components/table-skeleton';
import { AdminErrorState } from '@/components/admin-error-state';
import { TableEmptyState } from '@/components/table-empty-state';
import { api } from '@/lib/api';
import { runMutation } from '@/lib/mutate';
import {
  useCrosspostHistory,
  useCrosspostStatus,
  useFbPosts,
  type CrosspostStatus,
  type FbPostItem,
} from '@/lib/queries';

/** Постын төрлийн шошго */
const KIND_LABEL: Record<string, string> = {
  IMAGE: 'Зураг',
  VIDEO: 'Видео → Reels',
  CAROUSEL: 'Олон зураг',
  TEXT: 'Зөвхөн текст',
  LINK: 'Холбоос',
};

const KIND_ICON: Record<string, React.ReactNode> = {
  IMAGE: <Images size={13} />,
  VIDEO: <Film size={13} />,
  CAROUSEL: <Images size={13} />,
};

const STATUS_LABEL: Record<CrosspostStatus, string> = {
  QUEUED: 'Дараалалд',
  PROCESSING: 'Боловсруулж байна',
  PUBLISHED: 'Нийтлэгдсэн',
  FAILED: 'Амжилтгүй',
  SKIPPED: 'Алгассан',
};

const STATUS_TONE: Record<CrosspostStatus, string> = {
  QUEUED: 'bg-primary/12 text-primary',
  PROCESSING: 'bg-warning/15 text-warning',
  PUBLISHED: 'bg-success/15 text-success',
  FAILED: 'bg-destructive/15 text-destructive',
  SKIPPED: 'bg-foreground/8 text-foreground/50',
};

export default function CrosspostPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'posts' | 'history'>('posts');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [historyStatus, setHistoryStatus] = useState('ALL');

  const { data: status } = useCrosspostStatus();
  const { data, isLoading, isError, error, refetch, isFetching } = useFbPosts(25);
  const history = useCrosspostHistory({ status: historyStatus, page: 1, limit: 50 });

  const items = useMemo(() => data?.items ?? [], [data]);

  /** ⚠️ Шилжүүлэх БОЛОМЖТОЙ, бас хараахан ороогүй постууд л сонгогдоно */
  const selectable = useMemo(
    () => items.filter((p) => p.canTransfer && p.status !== 'PUBLISHED'),
    [items],
  );

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  /**
   * ⚠️⚠️ ХУУЧИН FB ПОСТЫГ «НИЙТЛЭЛ ТОВЛОГЧ» РУУ ИМПОРТЛОХ.
   *
   * IG руу шилжүүлэхээс ЯЛГААТАЙ: энэ нь ноорог пост үүсгэнэ. Админ
   * дараа нь FB/IG-д хэдэн ч удаа, хэзээ ч товлож болно.
   *
   * ⚠️ Медиаг R2 руу ТАТНА (Meta-гийн CDN хаяг хугацаатай) тул
   * зураг олонтой пост удаж болно.
   */
  const [importing, setImporting] = useState(false);
  /** ⚠️ Мөр бүрийн бодит явц — админ юу болж байгааг ХАРНА */
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importDone, setImportDone] = useState(false);
  /**
   * ⚠️ `useRef` — `setState` нь давталтын дотор шинэчлэгддэггүй
   * (closure нь хуучин утгыг барина) тул цуцлалтыг ref-ээр хянана.
   */
  const cancelRef = useRef(false);
  const [cancelling, setCancelling] = useState(false);

  const toScheduler = async () => {
    /**
     * ⚠️⚠️ ДАРААЛАЛ: FB жагсаалт нь ШИНЭ → ХУУЧИН эрэмбэтэй, харин
     * ноорогийн жагсаалт нь `createdAt desc` (сүүлд үүссэн нь эхэнд).
     *
     * Хэрэв FB-ийн дарааллаар импортлобол хамгийн ХУУЧИН пост сүүлд
     * үүсч, ноорогт ЭХЭНД гарна — яг ЭСРЭГЭЭР. Тиймээс УРВУУГААР
     * (хуучин → шинэ) импортлоно: тэгвэл FB-ийн хамгийн шинэ пост
     * хамгийн сүүлд үүсч, ноорогийн ТЭРГҮҮНД гарна.
     */
    const order = items.map((i) => i.fbPostId);
    const ids = [...selected].sort((a, b) => order.indexOf(b) - order.indexOf(a));
    if (!ids.length) return;
    const ok = await confirm({
      title: `${ids.length} постыг товлогч руу импортлох уу?`,
      description: 'Ноорог пост үүснэ — дараа нь товлогчоос засаж, товлоно.',
      bullets: [
        'Медиа R2 руу татагдана (пост тутам 2–5 секунд)',
        'Facebook-т ОДОО дахин нийтлэгдэхгүй',
        'Медиатай бол FB + IG хоёулаа сонгогдоно',
      ],
      confirmLabel: 'Импортлох',
    });
    if (!ok) return;

    /* Постын эхний мөрийг шошго болгоно — админ алийг нь таних */
    const byId = new Map(items.map((i) => [i.fbPostId, i]));
    setImportRows(
      ids.map((id) => {
        const it = byId.get(id);
        return {
          fbPostId: id,
          label: (it?.message ?? '').replace(/\s+/g, ' ').slice(0, 70),
          state: 'WAIT' as const,
          /* ⚠️ Урьдчилан мэдэгдэх мэдээлэл — админ юу татагдахыг ХАРНА */
          kind: it?.kind,
          mediaTotal: it?.mediaCount ?? 0,
        };
      }),
    );
    setImportDone(false);
    cancelRef.current = false;
    setCancelling(false);
    setImporting(true);

    let done = 0;
    let failedCount = 0;
    /** ⚠️ Нийт татсан хэмжээ — админд «118 МБ татлаа» гэж харуулна */
    let totalBytes = 0;

    /* ⚠️ ДАРААЛАН — медиа татах нь хүнд, зэрэг явуулбал Meta хязгаарлана */
    for (const id of ids) {
      if (cancelRef.current) break;

      setImportRows((cur) =>
        cur.map((r) => (r.fbPostId === id ? { ...r, state: 'RUN' } : r)),
      );
      try {
        const res = await api<{
          importedKind: string;
          post?: { mediaKeys?: string[] };
          mediaTotal?: number;
          mediaFailed?: number;
          bytes?: number;
        }>(`/admin/crosspost/${id}/to-scheduler`, { method: 'POST' });
        done++;
        totalBytes += res.bytes ?? 0;
        setImportRows((cur) =>
          cur.map((r) =>
            r.fbPostId === id
              ? {
                  ...r,
                  state: 'OK',
                  kind: res.importedKind,
                  mediaOk: res.post?.mediaKeys?.length ?? 0,
                  mediaFailed: res.mediaFailed ?? 0,
                  bytes: res.bytes ?? 0,
                }
              : r,
          ),
        );
      } catch (e) {
        failedCount++;
        const msg = e instanceof Error ? e.message : 'Алдаа';
        setImportRows((cur) =>
          cur.map((r) => (r.fbPostId === id ? { ...r, state: 'FAIL', error: msg } : r)),
        );
      }
    }

    /**
     * ⚠️ Цуцалсан бол ҮЛДСЭН мөрүүдийг «хүлээгдэж буй» хэвээр орхихгүй —
     * дуусаагүй гэж андуурч мөнхөд хүлээнэ. Тодорхой тэмдэглэнэ.
     */
    if (cancelRef.current) {
      setImportRows((cur) =>
        cur.map((r) =>
          r.state === 'WAIT' ? { ...r, state: 'FAIL', error: 'Цуцлагдсан' } : r,
        ),
      );
    }

    setImporting(false);
    setImportDone(true);
    setSelected(new Set());

    const mb = totalBytes ? ` · ${(totalBytes / 1048576).toFixed(1)} МБ` : '';
    if (done && failedCount) {
      toast.warning(`${done} импортлогдлоо, ${failedCount} унав${mb}`);
    } else if (done) {
      toast.success(`${done} ноорог үүслээ${mb} — «Нийтлэл товлох» хэсгээс товлоно уу`);
    } else if (!cancelRef.current) {
      toast.error('Импортолж чадсангүй');
    }
  };

  const toggleAll = () => {
    setSelected((s) =>
      s.size === selectable.length ? new Set() : new Set(selectable.map((p) => p.fbPostId)),
    );
  };

  /**
   * ⚠️⚠️ Instagram-ийн 24 цагийн хязгаар (50 пост) — ХЭТРЭХЭЭС ӨМНӨ
   * анхааруулна. Эс бөгөөс админ 40 пост дараалалд оруулаад дунд нь
   * зогсоход яагаад болохгүй байгааг ойлгохгүй.
   */
  const send = async () => {
    const ids = [...selected];
    if (!ids.length) return;

    const quota = status?.quota;
    const remaining = quota ? quota.cap - quota.used : null;
    const overQuota = remaining !== null && ids.length > remaining;

    const ok = await confirm({
      title: `${ids.length} постыг Instagram руу шилжүүлэх үү?`,
      description:
        'Постууд дараалалд орж, ганц ганцаар нийтлэгдэнэ. Видео 1-5 минут үргэлжилж болно.',
      bullets: [
        'Текст нь Instagram caption болно (2200 тэмдэгтээр таслагдана)',
        'Видео нь Reels хэлбэрээр орно',
        ...(overQuota
          ? [
              `⚠️ Instagram-ийн 24 цагийн хязгаар: ${remaining} пост үлдсэн. ` +
                `Хэтэрсэн нь амжилтгүй болно.`,
            ]
          : []),
      ],
      confirmLabel: 'Тийм, шилжүүлэх',
      tone: overQuota ? 'danger' : 'warning',
    });
    if (!ok) return;

    setSending(true);
    try {
      const res = await api<{ queued: string[]; skipped: { fbPostId: string; reason: string }[] }>(
        '/admin/crosspost/enqueue',
        { method: 'POST', body: JSON.stringify({ fbPostIds: ids }) },
      );
      /* ⚠️ Алгассаныг ЗААВАЛ хэлнэ — чимээгүй өнгөрвөл админ бүгд
         орсон гэж бодно */
      if (res.skipped.length) {
        toast.warning(
          `${res.queued.length} пост дараалалд орлоо · ${res.skipped.length} алгаслаа`,
          { description: res.skipped.slice(0, 3).map((s) => s.reason).join(' · ') },
        );
      } else {
        toast.success(`${res.queued.length} пост дараалалд орлоо`);
      }
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['crosspost-posts'] });
      qc.invalidateQueries({ queryKey: ['crosspost-history'] });
      setTab('history');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setSending(false);
    }
  };

  const retry = async (id: string) => {
    await runMutation(() => api(`/admin/crosspost/${id}/retry`, { method: 'POST' }), {
      success: 'Дахин дараалалд орлоо',
      onDone: () => qc.invalidateQueries({ queryKey: ['crosspost-history'] }),
    });
  };

  return (
    <AdminShell>
      <AdminTopbar
        title="Facebook → Instagram"
        subtitle={
          items.length
            ? `${selectable.length} пост шилжүүлэх боломжтой · нийт ${items.length}`
            : undefined
        }
      />

      <main className="mx-auto max-w-5xl p-4 pt-5 sm:p-8 sm:pt-6">
        {/* ─── Холболтын төлөв ─── */}
        <ConnectionBanner status={status} />

        {/* ─── Таб ─── */}
        <div className="mb-4 flex gap-1 rounded-lg border border-border bg-card p-1">
          {(
            [
              ['posts', 'Facebook постууд'],
              ['history', 'Шилжүүлсэн түүх'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                tab === id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground/60 hover:bg-foreground/5',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'posts' ? (
          <>
            {/* ─── Үйлдлийн мөр ─── */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                onClick={toggleAll}
                disabled={!selectable.length}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-foreground/5 disabled:opacity-40"
              >
                {selected.size === selectable.length && selectable.length
                  ? 'Сонголт цуцлах'
                  : `Бүгдийг сонгох (${selectable.length})`}
              </button>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-foreground/5 disabled:opacity-40"
              >
                <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
                Шинэчлэх
              </button>
              {/* ⚠️ ТОВЛОГЧ РУУ — IG руу шилжүүлэхээс ТУСДАА үйлдэл */}
              <button
                onClick={toScheduler}
                disabled={!selected.size || importing || sending}
                title="Ноорог пост үүсгээд дараа нь товлоно"
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-foreground/5 disabled:opacity-40"
              >
                {importing ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CalendarClock size={13} />
                )}
                Товлогч руу{selected.size ? ` (${selected.size})` : ''}
              </button>
              <div className="ml-auto">
                <button
                  onClick={send}
                  disabled={!selected.size || sending || !status?.igConfigured}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-40"
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  Instagram руу шилжүүлэх{selected.size ? ` (${selected.size})` : ''}
                </button>
              </div>
            </div>

            {isLoading ? (
              <TableSkeleton rows={6} />
            ) : isError ? (
              <AdminErrorState error={error} onRetry={() => refetch()} />
            ) : !items.length ? (
              <TableEmptyState
                icon={Images}
                message="Пост олдсонгүй"
                description="Facebook хуудсанд пост байхгүй эсвэл татаж чадсангүй."
              />
            ) : (
              <div className="space-y-2">
                {items.map((p) => (
                  <PostRow
                    key={p.fbPostId}
                    post={p}
                    checked={selected.has(p.fbPostId)}
                    onToggle={() => toggle(p.fbPostId)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <HistoryTab
            data={history.data}
            isLoading={history.isLoading}
            status={historyStatus}
            onStatus={setHistoryStatus}
            onRetry={retry}
          />
        )}
      </main>
      {/* ⚠️ ЯВЦЫН ЦОНХ — 25 пост × видео = хэдэн минут. Админ юу
          болж байгааг БОДИТООР харна. */}
      {(importing || importRows.length > 0) && (
        <ImportProgress
          rows={importRows}
          done={importDone}
          cancelling={cancelling}
          onCancel={() => {
            cancelRef.current = true;
            setCancelling(true);
          }}
          onClose={() => {
            setImportRows([]);
            setImportDone(false);
          }}
        />
      )}

    </AdminShell>
  );
}

/**
 * Холболтын төлөв — юу дутуугаа админд ШУУД хэлнэ.
 *
 * ⚠️ Зөвшөөрөл дутуу байхад зүгээр «алдаа гарлаа» гэвэл админ өөрөө
 * Meta App Review хийх ёстойгоо хэзээ ч мэдэхгүй.
 */
function ConnectionBanner({
  status,
}: {
  status?: { fbConfigured: boolean; igConfigured: boolean; quota: { used: number; cap: number } | null };
}) {
  if (!status) return null;

  if (!status.igConfigured) {
    return (
      <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/8 p-3.5 text-xs leading-relaxed">
        <p className="mb-1 flex items-center gap-1.5 font-bold text-destructive">
          <AlertTriangle size={14} /> Instagram холболт дутуу байна
        </p>
        <p className="text-muted-foreground">
          {!status.fbConfigured
            ? 'Facebook токен тохируулаагүй байна (FB_PAGE_ACCESS_TOKEN).'
            : 'IG_USER_ID тохируулаагүй, эсвэл instagram_content_publish зөвшөөрөл байхгүй байна. Meta App Review шаардлагатай.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-success/25 bg-success/8 p-3 text-xs">
      <span className="flex items-center gap-1.5 font-semibold text-success">
        <Instagram size={14} /> Instagram холбогдсон
      </span>
      {status.quota && (
        <span className="text-muted-foreground">
          24 цагийн хязгаар:{' '}
          <strong className="text-foreground">
            {status.quota.used}/{status.quota.cap}
          </strong>{' '}
          ашигласан
        </span>
      )}
    </div>
  );
}

/** Нэг Facebook пост */
function PostRow({
  post,
  checked,
  onToggle,
}: {
  post: FbPostItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const done = post.status === 'PUBLISHED';
  const blocked = !post.canTransfer;

  return (
    <div
      className={cn(
        'flex gap-3 rounded-lg border p-3 transition-colors',
        blocked
          ? 'border-border/50 bg-foreground/2 opacity-70'
          : done
            ? 'border-success/25 bg-success/5'
            : checked
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card hover:border-foreground/20',
      )}
    >
      {/* Сонголт — боломжтой, ороогүй постод л */}
      <div className="flex items-start pt-1">
        {blocked || done ? (
          <div className="flex h-4 w-4 items-center justify-center">
            {done ? (
              <CheckCircle2 size={16} className="text-success" />
            ) : (
              <XCircle size={15} className="text-foreground/25" />
            )}
          </div>
        ) : (
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            aria-label="Постыг сонгох"
            className="h-4 w-4 cursor-pointer accent-primary"
          />
        )}
      </div>

      {/* Зургийн урьдчилсан харагдац */}
      {post.preview ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={post.preview}
          alt=""
          className="h-16 w-16 shrink-0 rounded-md object-cover sm:h-20 sm:w-20"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-foreground/5 text-foreground/25 sm:h-20 sm:w-20">
          <Film size={20} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded bg-foreground/8 px-1.5 py-0.5 text-[10px] font-semibold text-foreground/70">
            {KIND_ICON[post.kind]}
            {KIND_LABEL[post.kind] ?? post.kind}
          </span>
          {post.status && (
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                STATUS_TONE[post.status],
              )}
            >
              {STATUS_LABEL[post.status]}
            </span>
          )}
          <span className="text-[10px] text-foreground/40">
            {formatDateTime(post.postedAt)}
          </span>
          {post.permalink && (
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-primary hover:underline"
            >
              <ExternalLink size={11} className="inline" /> FB
            </a>
          )}
        </div>

        <p className="line-clamp-2 text-xs leading-relaxed text-foreground/75">
          {post.message || <span className="italic text-foreground/35">(текстгүй)</span>}
        </p>

        {/*
          ⚠️ ШАЛТГААНЫГ ЗААВАЛ ХАРУУЛНА. Чимээгүй алгасвал админ
          «яагаад 20-оос 12 нь л орсон бэ?» гэж эргэлзэнэ.
        */}
        {post.reason && (
          <p
            className={cn(
              'mt-1 text-[11px]',
              blocked ? 'text-foreground/45' : 'text-warning',
            )}
          >
            {blocked ? '⛔' : '⚠️'} {post.reason}
          </p>
        )}
        {post.error && (
          <p className="mt-1 text-[11px] text-destructive">❌ {post.error}</p>
        )}
      </div>
    </div>
  );
}

/** Шилжүүлсэн түүх */
function HistoryTab({
  data,
  isLoading,
  status,
  onStatus,
  onRetry,
}: {
  data?: {
    items: {
      id: string;
      fbPostId: string;
      message: string;
      kind: string;
      status: CrosspostStatus;
      igMediaId: string | null;
      error: string | null;
      attempts: number;
      publishedAt: string | null;
      createdAt: string;
    }[];
    stats: Record<string, number>;
  };
  isLoading: boolean;
  status: string;
  onStatus: (s: string) => void;
  onRetry: (id: string) => void;
}) {
  const stats = data?.stats ?? {};

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(['ALL', 'QUEUED', 'PROCESSING', 'PUBLISHED', 'FAILED', 'SKIPPED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => onStatus(s)}
            className={cn(
              'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors',
              status === s
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-foreground/60 hover:bg-foreground/5',
            )}
          >
            {s === 'ALL' ? 'Бүгд' : STATUS_LABEL[s]}
            {s !== 'ALL' && stats[s] ? (
              <span className="ml-1 opacity-60">{stats[s]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : !data?.items.length ? (
        <TableEmptyState
          icon={Instagram}
          message="Түүх хоосон"
          description="Одоогоор Instagram руу шилжүүлсэн пост байхгүй."
        />
      ) : (
        <div className="space-y-2">
          {data.items.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-card p-3">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                    STATUS_TONE[r.status],
                  )}
                >
                  {STATUS_LABEL[r.status]}
                </span>
                <span className="text-[10px] text-foreground/40">
                  {KIND_LABEL[r.kind] ?? r.kind}
                </span>
                {r.attempts > 1 && (
                  <span className="text-[10px] text-foreground/40">
                    <Clock size={10} className="inline" /> {r.attempts} оролдлого
                  </span>
                )}
                {r.igMediaId && (
                  <a
                    href={`https://www.instagram.com/p/${r.igMediaId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-primary hover:underline"
                  >
                    <Instagram size={11} className="inline" /> IG дээр харах
                  </a>
                )}
                <span className="ml-auto text-[10px] text-foreground/35">
                  {formatDateTime(r.publishedAt ?? r.createdAt)}
                </span>
              </div>
              <p className="line-clamp-1 text-xs text-foreground/70">
                {r.message || <span className="italic text-foreground/35">(текстгүй)</span>}
              </p>
              {r.error && (
                <div className="mt-1.5 flex items-start justify-between gap-2">
                  <p className="text-[11px] text-destructive">❌ {r.error}</p>
                  {r.status === 'FAILED' && (
                    <button
                      onClick={() => onRetry(r.id)}
                      className="shrink-0 rounded border border-border px-2 py-1 text-[10px] font-semibold hover:bg-foreground/5"
                    >
                      Дахин оролдох
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
