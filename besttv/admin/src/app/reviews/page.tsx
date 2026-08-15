'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Flag,
  Loader2,
  MessageSquare,
  Search,
  Shield,
  Star,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatDate } from '@besttv/shared';
import { Badge, useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { Pagination } from '@/components/pagination';
import { AdminErrorState } from '@/components/admin-error-state';
import { NewBadge } from '@/components/new-badge';
import { api } from '@/lib/api';
import { useNewSince } from '@/lib/use-new-since';
import { useAdminReviews, type AdminReview } from '@/lib/queries';

const REASON_LABEL: Record<string, string> = {
  spam: 'Спам',
  offensive: 'Доромжилсон',
  spoiler: 'Спойлер',
  other: 'Бусад',
};

type Filter = 'all' | 'reported' | 'hidden';

export default function ReviewsPage() {
  // Аль сэтгэгдэл сүүлийн үзэлтээс хойш шинээр ирснийг мөрөнд тэмдэглэнэ
  const isNew = useNewSince('reviews');
  const [q, setQ] = useState('');
  const [rating, setRating] = useState<number | undefined>();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Ажиллаж буй мөр/бөөнөөр устгалт — давхар дарахаас сэргийлнэ
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const { data, isFetching, isError, error, refetch } = useAdminReviews({
    q,
    rating,
    page,
    onlyReported: filter === 'reported',
    onlyHidden: filter === 'hidden',
  });
  const qc = useQueryClient();
  const confirm = useConfirm();

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-reviews'] });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data?.items.length) return;
    setSelected((prev) =>
      prev.size === data.items.length ? new Set() : new Set(data.items.map((r) => r.id)),
    );
  };

  const setHidden = async (r: AdminReview, isHidden: boolean) => {
    if (isHidden) {
      const ok = await confirm({
        title: 'Сэтгэгдлийг нуух уу?',
        description: r.comment ? `"${r.comment.slice(0, 120)}"` : `${r.title.title}`,
        bullets: [
          'Сайт дээр харагдахаа болино',
          'Устгахгүй — хэзээ ч буцааж харуулж болно',
          'Дундаж үнэлгээнээс хасагдана',
        ],
        confirmLabel: 'Нуух',
        tone: 'warning',
      });
      if (!ok) return;
    }
    setBusyId(r.id);
    try {
      await api(`/admin/reviews/${r.id}/hidden`, {
        method: 'PATCH',
        body: JSON.stringify({ isHidden }),
      });
      await refresh();
      toast.success(isHidden ? 'Сэтгэгдэл нуугдлаа' : 'Сэтгэгдэл буцааж харагдана');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Өөрчилж чадсангүй');
    } finally {
      setBusyId(null);
    }
  };

  const clearReports = async (r: AdminReview) => {
    const ok = await confirm({
      title: 'Мэдээллийг цэвэрлэх үү?',
      description: 'Энэ сэтгэгдэл зөв гэж үзэж, мэдээллүүдийг арилгана.',
      bullets: [`${r.reportCount} мэдээлэл устана`, 'Сэтгэгдэл хэвээр харагдана'],
      confirmLabel: 'Зөв гэж үзэх',
      tone: 'info',
    });
    if (!ok) return;
    setBusyId(r.id);
    try {
      await api(`/admin/reviews/${r.id}/clear-reports`, { method: 'POST' });
      await refresh();
      toast.success('Мэдээлэл цэвэрлэгдлээ');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Цэвэрлэж чадсангүй');
    } finally {
      setBusyId(null);
    }
  };

  const removeOne = async (r: AdminReview) => {
    const ok = await confirm({
      title: 'Сэтгэгдлийг устгах уу?',
      description: r.comment ? `"${r.comment.slice(0, 120)}"` : `${r.title.title} — ${r.rating} од`,
      bullets: [
        `${r.user.name ?? r.user.email} хэрэглэгчийн сэтгэгдэл`,
        ...(r._count.replies > 0 ? [`${r._count.replies} хариу ХАМТ устана`] : []),
        'Одны үнэлгээ ч хамт устана',
        'Устгахын оронд НУУХ боломжтой',
      ],
      confirmLabel: 'Бүрмөсөн устгах',
      tone: 'danger',
    });
    if (!ok) return;
    setBusyId(r.id);
    try {
      await api(`/admin/reviews/${r.id}`, { method: 'DELETE' });
      await refresh();
      toast.success('Сэтгэгдэл устгагдлаа');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Устгаж чадсангүй');
    } finally {
      setBusyId(null);
    }
  };

  const removeBulk = async () => {
    if (selected.size === 0) return;
    const ok = await confirm({
      title: `${selected.size} сэтгэгдлийг устгах уу?`,
      description: 'Сонгосон бүх сэтгэгдэл бүрмөсөн устана.',
      bullets: ['Хариунууд ч хамт устана', 'Дундаж үнэлгээ дахин тооцогдоно'],
      confirmLabel: `${selected.size}-г устгах`,
      tone: 'danger',
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      await api('/admin/reviews/bulk', {
        method: 'DELETE',
        body: JSON.stringify({ ids: [...selected] }),
      });
      await refresh();
      toast.success(`${selected.size} сэтгэгдэл устгагдлаа`);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Устгаж чадсангүй');
    } finally {
      setBulkBusy(false);
    }
  };

  const FILTERS: { value: Filter; label: string; count?: number }[] = [
    { value: 'all', label: 'Бүгд' },
    { value: 'reported', label: 'Мэдээлэгдсэн', count: data?.reportedTotal },
    { value: 'hidden', label: 'Нуусан' },
  ];

  return (
    <AdminShell>
      <AdminTopbar
        title="Сэтгэгдэл"
        subtitle={
          data
            ? `Нийт ${data.total}${data.reportedTotal > 0 ? ` · ${data.reportedTotal} мэдээлэгдсэн` : ''}`
            : undefined
        }
      />

      <main className="p-4 pt-5 sm:p-8 sm:pt-6">
        {/* Мэдээлэгдсэн анхааруулга */}
        {(data?.reportedTotal ?? 0) > 0 && filter !== 'reported' && (
          <button
            onClick={() => {
              setFilter('reported');
              setPage(1);
            }}
            className="mb-4 flex w-full items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-destructive/15"
          >
            <Flag size={15} className="shrink-0 text-destructive" />
            <span>
              <strong className="text-destructive">{data?.reportedTotal} сэтгэгдэл</strong> тохиромжгүй
              гэж мэдээлэгдсэн байна — шалгана уу
            </span>
          </button>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Сэтгэгдэл, кино, хэрэглэгчээр хайх..."
              className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
            />
          </div>

          <div className="flex gap-1 rounded-lg bg-accent/50 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  setFilter(f.value);
                  setPage(1);
                }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  filter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
                {f.count ? ` (${f.count})` : ''}
              </button>
            ))}
          </div>

          <select
            value={rating ?? ''}
            onChange={(e) => {
              setRating(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
            }}
            className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">Бүх үнэлгээ</option>
            {Array.from({ length: 10 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} од
              </option>
            ))}
          </select>

          {selected.size > 0 && (
            <button
              onClick={removeBulk}
              disabled={bulkBusy}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-destructive/15 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/25 disabled:opacity-50"
            >
              {bulkBusy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {selected.size} устгах
            </button>
          )}
        </div>

        {/* ⚠️ API унавал хоосон хүснэгт биш АЛДАА харуулна */}
        {isError ? (
          <div className="admin-card mt-5 rounded-xl">
            <AdminErrorState error={error} onRetry={() => void refetch()} />
          </div>
        ) : !data ? (
          /* ⚠️ Эхний ачаалалтад `opacity-60` нь юу ч харуулдаггүй байв */
          <div className="admin-card mt-5 overflow-hidden rounded-xl">
            <TableSkeleton rows={8} cols={6} />
          </div>
        ) : (
        <div
          className={cn(
            'admin-card mt-5 overflow-x-auto rounded-xl transition-opacity',
            isFetching && 'opacity-60',
          )}
        >
          {/* ⚠️ Мобайлд 7 багана шахагдаж текст давхцдаг байв */}
          <table className="w-full min-w-200 text-sm">
            <thead className="bg-accent/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={!!data?.items.length && selected.size === data.items.length}
                    onChange={toggleSelectAll}
                    /* ⚠️ Скрин ридер зөвхөн "checkbox" гэж уншдаг байв */
                    aria-label="Бүх сэтгэгдлийг сонгох"
                    className="h-4 w-4 rounded border-input"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold">Хэрэглэгч</th>
                <th className="px-4 py-3 text-left font-semibold">Кино</th>
                <th className="px-4 py-3 text-left font-semibold">Үнэлгээ</th>
                <th className="px-4 py-3 text-left font-semibold">Сэтгэгдэл</th>
                <th className="px-4 py-3 text-left font-semibold">Огноо</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.items.map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    'transition-colors hover:bg-accent/40',
                    r.isHidden && 'opacity-50',
                    r.reportCount > 0 && !r.isHidden && 'bg-destructive/5',
                  )}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      aria-label={`${r.user.name ?? r.user.email}-ийн сэтгэгдлийг сонгох`}
                      className="h-4 w-4 rounded border-input"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="flex items-center gap-1.5 font-medium text-foreground">
                      {r.isStaff && <Shield size={12} className="text-primary" />}
                      {r.user.name ?? '—'}
                      {isNew(r.createdAt) && <NewBadge />}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground">{r.title.title}</td>
                  <td className="px-4 py-3">
                    {r.parentId ? (
                      <Badge variant="secondary">Хариу</Badge>
                    ) : (
                      <span className="flex items-center gap-1 text-foreground">
                        <Star size={13} className="fill-premium text-premium" /> {r.rating}
                      </span>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <p className="truncate text-muted-foreground">{r.comment || '—'}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {r.hasSpoiler && (
                        <Badge variant="warning" className="text-[10px]">
                          Спойлер
                        </Badge>
                      )}
                      {r.isHidden && (
                        <Badge variant="secondary" className="text-[10px]">
                          Нуусан
                        </Badge>
                      )}
                      {r._count.replies > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {r._count.replies} хариу
                        </span>
                      )}
                      {r.reportCount > 0 && (
                        <span
                          className="flex items-center gap-0.5 rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive"
                          title={r.reports.map((x) => REASON_LABEL[x.reason] ?? x.reason).join(', ')}
                        >
                          <Flag size={9} /> {r.reportCount} ·{' '}
                          {r.reports
                            .slice(0, 2)
                            .map((x) => REASON_LABEL[x.reason] ?? x.reason)
                            .join(', ')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(r.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {r.reportCount > 0 && (
                        <button
                          onClick={() => clearReports(r)}
                          disabled={busyId === r.id}
                          aria-label="Зөв гэж үзэх"
                          title="Зөв гэж үзэж мэдээллийг цэвэрлэх"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-success/15 hover:text-success disabled:opacity-40"
                        >
                          <CheckCircle2 size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => setHidden(r, !r.isHidden)}
                        disabled={busyId === r.id}
                        aria-label={r.isHidden ? 'Буцааж харуулах' : 'Нуух'}
                        title={r.isHidden ? 'Буцааж харуулах' : 'Сайтаас нуух (устгахгүй)'}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                      >
                        {r.isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button
                        onClick={() => removeOne(r)}
                        disabled={busyId === r.id}
                        aria-label="Устгах"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.items.length && (
            <TableEmptyState
              icon={MessageSquare}
              message={
                filter === 'reported'
                  ? 'Мэдээлэгдсэн сэтгэгдэл байхгүй 👍'
                  : filter === 'hidden'
                    ? 'Нуусан сэтгэгдэл байхгүй'
                    : 'Сэтгэгдэл олдсонгүй'
              }
              description={
                q || rating
                  ? 'Өөр түлхүүр үг эсвэл үнэлгээ сонгож үзнэ үү.'
                  : filter === 'reported'
                    ? 'Хэрэглэгчид гомдол мэдүүлээгүй байна.'
                    : undefined
              }
              action={
                q || rating ? (
                  <button
                    onClick={() => {
                      setQ('');
                      setRating(undefined);
                    }}
                    className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-accent"
                  >
                    Шүүлт цэвэрлэх
                  </button>
                ) : undefined
              }
            />
          )}
        </div>
        )}

        {/* ⚠️ `Array.from({length: totalPages})` ХАСАВ — 5000 сэтгэгдэл
            = 250 товч дэлгэц дүүргэнэ. `<Pagination>` нь идэвхтэйн
            эргэн тойрон ±1 + "…" харуулж, "1–20 / 340" тоог ч гаргана. */}
        <Pagination
          page={data?.page ?? page}
          totalPages={data?.totalPages ?? 1}
          total={data?.total}
          limit={20}
          onPage={setPage}
        />
      </main>
    </AdminShell>
  );
}
