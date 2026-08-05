'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, Clapperboard, Film, Lock, Pencil, Plus, Settings2, Tv, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { api } from '@/lib/api';
import { BulkBar, type BulkImpact } from '@/components/bulk-bar';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { TitleEditDialog } from '@/components/title-edit-dialog';
import { DataToolbar, SortHeader } from '@/components/data-toolbar';
import { Pagination } from '@/components/pagination';
import {
  useAdminGenres,
  useAdminTitleCounts,
  useAdminTitles,
  type TitleFilters,
} from '@/lib/queries';
import { genreName } from '@/lib/genre';

const STATUS_LABEL: Record<string, string> = {
  NONE: 'Видео ороогүй',
  UPLOADED: 'Ачаалагдсан',
  PROCESSING: 'Боловсруулж байна',
  READY: 'Бэлэн',
  FAILED: 'Алдаатай',
};

const EMPTY: TitleFilters = {
  q: '',
  type: 'ALL',
  genre: 'ALL',
  status: 'ALL',
  access: 'ALL',
  active: 'ALL',
  year: '',
  sort: 'createdAt',
  dir: 'desc',
  page: 1,
  limit: 20,
};

export default function MoviesPage() {
  const [f, setF] = useState<TitleFilters>(EMPTY);
  const { data, isFetching } = useAdminTitles(f);
  const { data: counts } = useAdminTitleCounts({ q: f.q, genre: f.genre, year: f.year });
  const { data: genres } = useAdminGenres();
  /** null = хаалттай, 'new' = шинэ, id = засах */
  const [editing, setEditing] = useState<string | null | 'new'>(null);
  const qc = useQueryClient();

  /** Bulk үйлдэлд сонгосон мөрүүд */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const ids = useMemo(() => [...selected], [selected]);

  const toggleOne = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const pageIds = data?.items.map((t) => t.id) ?? [];
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });

  /** Bulk дараа — жагсаалт/тоолол шинэчилж, сонголт цэвэрлэнэ */
  const afterBulk = async (msg: string) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['admin-titles'] }),
      qc.invalidateQueries({ queryKey: ['admin-title-counts'] }),
    ]);
    setSelected(new Set());
    toast.success(msg);
  };

  const set = (patch: Partial<TitleFilters>) => {
    // ⚠️ Шүүлт/хуудас солигдоход сонголт цэвэрлэнэ — харагдахгүй мөр
    // сонгоотой үлдэж, санамсаргүй устгахаас сэргийлнэ
    setSelected(new Set());
    setF((s) => ({ ...s, ...patch, page: patch.page ?? 1 }));
  };

  const activeCount = useMemo(() => {
    let n = 0;
    if (f.genre && f.genre !== 'ALL') n++;
    if (f.status && f.status !== 'ALL') n++;
    if (f.access && f.access !== 'ALL') n++;
    if (f.active && f.active !== 'ALL') n++;
    if (f.year) n++;
    return n;
  }, [f]);

  const toggleSort = (field: string) =>
    set({ sort: field, dir: f.sort === field && f.dir === 'desc' ? 'asc' : 'desc' });

  return (
    <AdminShell>
      <AdminTopbar
        title="Кино"
        subtitle={data ? `${data.total.toLocaleString()} контент` : undefined}
      />

      <main className="p-4 pt-5 sm:p-8 sm:pt-6">
        {/* ⚠️ "Видео ороогүй" нь ажлын жагсаалт — нэг дарж шүүнэ */}
        {!!counts?.noVideo && (
          <button
            onClick={() => set({ status: 'NONE', type: 'MOVIE' })}
            className="mb-4 flex w-full items-center gap-2 rounded-lg border border-warning/30 bg-warning/8 px-3.5 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:bg-warning/12"
          >
            <Film size={14} className="text-warning" />
            <span>
              <strong className="text-foreground">{counts.noVideo}</strong> кинонд видео ороогүй
              байна — дарж шүүнэ
            </span>
          </button>
        )}

        <DataToolbar
          search={f.q ?? ''}
          onSearch={(v) => set({ q: v })}
          searchPlaceholder="Нэр, slug-аар хайх (галиг дэмжинэ)..."
          tabs={[
            { id: 'ALL', label: 'Бүгд', count: counts?.ALL },
            { id: 'MOVIE', label: 'Нэг ангит', count: counts?.movies },
            { id: 'SERIES', label: 'Олон ангит', count: counts?.series },
          ]}
          activeTab={f.type}
          onTab={(id) => set({ type: id })}
          selects={[
            {
              id: 'genre',
              label: 'Жанр',
              value: f.genre ?? 'ALL',
              options: [
                { value: 'ALL', label: 'Бүх жанр' },
                ...(genres ?? []).map((g) => ({ value: g.id, label: g.name })),
              ],
              onChange: (v) => set({ genre: v }),
            },
            {
              id: 'status',
              label: 'Видеоны төлөв',
              value: f.status ?? 'ALL',
              options: [
                { value: 'ALL', label: 'Бүгд' },
                { value: 'READY', label: 'Бэлэн' },
                { value: 'PROCESSING', label: 'Боловсруулж байна' },
                { value: 'NONE', label: 'Видео ороогүй' },
                { value: 'FAILED', label: 'Алдаатай' },
              ],
              onChange: (v) => set({ status: v }),
            },
            {
              id: 'access',
              label: 'Хандалт',
              value: f.access ?? 'ALL',
              options: [
                { value: 'ALL', label: 'Бүгд' },
                { value: 'premium', label: 'Төлбөртэй' },
                { value: 'free', label: 'Үнэгүй' },
              ],
              onChange: (v) => set({ access: v }),
            },
            {
              id: 'active',
              label: 'Идэвх',
              value: f.active ?? 'ALL',
              options: [
                { value: 'ALL', label: 'Бүгд' },
                { value: 'true', label: 'Идэвхтэй' },
                { value: 'false', label: 'Нуугдсан' },
              ],
              onChange: (v) => set({ active: v }),
            },
          ]}
          limit={f.limit}
          onLimit={(n) => set({ limit: n })}
          activeCount={activeCount}
          onReset={() => setF(EMPTY)}
          actions={
            <button
              onClick={() => setEditing('new')}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
            >
              <Plus size={16} /> Шинэ нэмэх
            </button>
          }
        />

        {/* ⚠️ Сонголттой үед л гарна — бөөн үйлдэл (нийтлэх/нуух/устгах г.м.) */}
        <BulkBar
          count={ids.length}
          onClear={() => setSelected(new Set())}
          loadImpact={() =>
            api<BulkImpact>('/admin/titles/bulk/impact', {
              method: 'POST',
              body: JSON.stringify({ ids }),
            })
          }
          onDelete={async (force) => {
            const r = await api<{ deleted: number }>('/admin/titles/bulk/delete', {
              method: 'POST',
              body: JSON.stringify({ ids, force }),
            });
            await afterBulk(`${r.deleted} контент устгагдлаа`);
          }}
          onSetActive={async (isActive) => {
            const r = await api<{ updated: number }>('/admin/titles/bulk/active', {
              method: 'POST',
              body: JSON.stringify({ ids, isActive }),
            });
            await afterBulk(`${r.updated} контент ${isActive ? 'нийтлэгдлээ' : 'нуугдлаа'}`);
          }}
          onSetPremium={async (isPremium) => {
            const r = await api<{ updated: number }>('/admin/titles/bulk/premium', {
              method: 'POST',
              body: JSON.stringify({ ids, isPremium }),
            });
            await afterBulk(`${r.updated} контент ${isPremium ? 'төлбөртэй' : 'үнэгүй'} боллоо`);
          }}
        />

        <div
          className={cn(
            'admin-card mt-5 overflow-x-auto rounded-xl transition-opacity',
            isFetching && 'opacity-60',
          )}
        >
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-accent/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allOnPage}
                    onChange={toggleAll}
                    aria-label="Бүгдийг сонгох"
                    className="h-4 w-4 cursor-pointer rounded border-input accent-primary"
                  />
                </th>
                <SortHeader
                  label="Гарчиг"
                  field="title"
                  sort={f.sort ?? 'createdAt'}
                  dir={f.dir ?? 'desc'}
                  onSort={toggleSort}
                />
                <th className="px-4 py-3 text-left font-semibold">Төрөл</th>
                <th className="px-4 py-3 text-left font-semibold">Жанр</th>
                <th className="px-4 py-3 text-left font-semibold">Видео</th>
                <th className="px-4 py-3 text-left font-semibold">Хандалт</th>
                <SortHeader
                  label="Үзэлт"
                  field="views"
                  sort={f.sort ?? 'createdAt'}
                  dir={f.dir ?? 'desc'}
                  onSort={toggleSort}
                  align="right"
                />
                <th className="px-4 py-3 text-left font-semibold">Идэвх</th>
                <th className="px-4 py-3 text-right font-semibold">Үйлдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.items.map((t) => (
                <tr
                  key={t.id}
                  className={cn(
                    'transition-colors hover:bg-accent/40',
                    selected.has(t.id) && 'bg-primary/6',
                  )}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggleOne(t.id)}
                      aria-label={`${t.title} сонгох`}
                      className="h-4 w-4 cursor-pointer rounded border-input accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEditing(t.id)}
                      className="flex items-center gap-3 text-left"
                    >
                      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                        {t.posterUrl ? (
                          <Image
                            src={t.posterUrl}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : (
                          <Clapperboard className="m-auto mt-3 text-muted-foreground" size={18} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground hover:text-primary">{t.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.year ?? '—'} · {t.slug}
                        </p>
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {t.type === 'MOVIE' ? <Film size={13} /> : <Tv size={13} />}
                      {t.type === 'MOVIE' ? 'Нэг ангит' : `${t._count.seasons} улирал`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {t.genres.map(genreName).filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-medium',
                        t.streamStatus === 'READY' && 'bg-success/15 text-success',
                        t.streamStatus === 'PROCESSING' && 'bg-warning/15 text-warning',
                        t.streamStatus === 'FAILED' && 'bg-destructive/15 text-destructive',
                        (t.streamStatus === 'NONE' || t.streamStatus === 'UPLOADED') &&
                          'bg-muted text-muted-foreground',
                      )}
                    >
                      {STATUS_LABEL[t.streamStatus] ?? t.streamStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {t.isPremium ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-premium/15 px-2 py-0.5 text-xs font-medium text-premium">
                        <Lock size={10} /> Төлбөртэй
                      </span>
                    ) : (
                      <span className="rounded-md bg-success/12 px-2 py-0.5 text-xs font-medium text-success">
                        Үнэгүй
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {(t.views ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {t.isActive ? (
                      <Check size={16} className="text-success" />
                    ) : (
                      <X size={16} className="text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditing(t.id)}
                        title="Хурдан засах"
                        aria-label="Хурдан засах"
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                      >
                        <Pencil size={15} />
                      </button>
                      {/* Видео/улирал/анги — дэлгэрэнгүй хуудсанд */}
                      <Link
                        href={`/movies/${t.id}`}
                        title="Дэлгэрэнгүй (видео, ангиуд)"
                        aria-label="Дэлгэрэнгүй"
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                      >
                        <Settings2 size={15} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.items.length && !isFetching && (
            <TableEmptyState
              icon={Clapperboard}
              message={
                activeCount > 0 || f.q
                  ? 'Шүүлтэд тохирох контент олдсонгүй'
                  : 'Контент байхгүй байна'
              }
            />
          )}
        </div>

        <Pagination
          page={data?.page ?? 1}
          totalPages={data?.totalPages ?? 1}
          total={data?.total}
          limit={f.limit}
          onPage={(p) => setF((s) => ({ ...s, page: p }))}
        />
      </main>

      {/* Кино нэмэх/засах — МОДАЛ (видео, ангиуд дэлгэрэнгүй хуудсанд) */}
      <TitleEditDialog
        open={editing !== null}
        titleId={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
      />
    </AdminShell>
  );
}
