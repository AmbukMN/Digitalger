'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { cn, formatDate } from '@besttv/shared';
import { useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { AdminErrorState } from '@/components/admin-error-state';
import { api } from '@/lib/api';
import { runMutation } from '@/lib/mutate';
import { useAdminPages } from '@/lib/queries';

export default function PagesListPage() {
  const { data, isLoading, isError, error, refetch } = useAdminPages();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [q, setQ] = useState('');

  /**
   * ⚠️ Шүүлт CLIENT талд — статик хуудас цөөхөн (ихэвчлэн 10-аас цөөн)
   * тул сервер рүү дахин очих нь илүү удаан.
   */
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data ?? [];
    return (data ?? []).filter(
      (p) => p.title.toLowerCase().includes(needle) || p.slug.toLowerCase().includes(needle),
    );
  }, [data, q]);

  /* ⚠️ `runMutation` — өмнө нь try/catch БАЙХГҮЙ байсан тул 403/500
     гарвал toast ч гарахгүй, мөр ч арилахгүй (админ устсан гэж бодно) */
  const remove = async (id: string, title: string, slug: string) => {
    const ok = await confirm({
      title: `"${title}" хуудсыг устгах уу?`,
      description: 'Хуудас болон түүний бүх агуулга бүрмөсөн устана.',
      bullets: [`Сайт дээрх /p/${slug} хаяг 404 болно`, 'Footer-ээс автоматаар хасагдана'],
      tone: 'danger',
    });
    if (!ok) return;
    await runMutation(() => api(`/admin/pages/${id}`, { method: 'DELETE' }), {
      success: 'Хуудас устгагдлаа',
      onDone: () => qc.invalidateQueries({ queryKey: ['admin-pages'] }),
    });
  };

  const [busyId, setBusyId] = useState<string | null>(null);

  const toggleActive = async (id: string, isActive: boolean) => {
    if (busyId) return;
    setBusyId(id);
    await runMutation(
      () =>
        api(`/admin/pages/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !isActive }),
        }),
      {
        success: isActive ? 'Хуудас идэвхгүй боллоо' : 'Хуудас идэвхжлээ',
        error: 'Өөрчилж чадсангүй',
        onDone: () => qc.invalidateQueries({ queryKey: ['admin-pages'] }),
      },
    );
    setBusyId(null);
  };

  return (
    <AdminShell>
      <AdminTopbar title="Хуудсууд" subtitle={data ? `Нийт ${data.length} хуудас` : undefined} />

      <main className="p-4 pt-5 sm:p-8 sm:pt-6">
        <div className="mb-4 rounded-lg border border-primary/25 bg-primary/8 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Статик хуудсууд</strong> — Үйлчилгээний нөхцөл,
          Нууцлалын бодлого, Мэдээлэл устгах хүсэлт зэрэг. Агуулгыг эндээс бүрэн засварлана.
          Сайт дээр <code className="rounded bg-accent px-1">/p/[хаяг]</code> замаар харагдана.
        </div>

        {/* ⚠️ Хайлт — гарчиг БОЛОН slug-аар (админ ихэвчлэн /p/terms гэсэн
            хаягаараа сануудаг, гарчгаараа биш) */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Гарчиг, хаягаар хайх…"
              aria-label="Хуудас хайх"
              className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <Link
            href="/pages/new"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
          >
            <Plus size={15} /> Хуудас нэмэх
          </Link>
        </div>

        {/* ⚠️ Шүүлтийн үр дүнгийн тоо — хоосон үр дүн нь эвдэрсэн гэж
            ойлгогдохгүй */}
        {q && (
          <p className="mt-2 text-xs text-muted-foreground">
            {rows.length} / {data?.length ?? 0} хуудас
          </p>
        )}

        <div className="admin-card mt-4 overflow-hidden rounded-xl">
          {isError ? (
            <AdminErrorState error={error} onRetry={() => void refetch()} />
          ) : isLoading ? (
            /* ⚠️ Spinner БИШ skeleton — төслийн дүрэм (бүтэц урьдчилж
               харагдаж, дата ирэхэд layout үсэрдэггүй) */
            <TableSkeleton rows={6} cols={6} />
          ) : (
            /* ⚠️ Мобайлд хэвтээ гүйлт — 6 багана 375px дэлгэцэнд шахагдаж
               текст давхцдаг байв */
            <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-sm">
              <thead className="bg-accent/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Гарчиг</th>
                  <th className="px-4 py-3 text-left font-semibold">Хаяг (slug)</th>
                  <th className="px-4 py-3 text-left font-semibold">Дараалал</th>
                  <th className="px-4 py-3 text-left font-semibold">Шинэчилсэн</th>
                  <th className="px-4 py-3 text-left font-semibold">Төлөв</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <Link href={`/pages/${p.id}`} className="font-medium text-foreground hover:text-primary">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-accent px-1.5 py-0.5 text-xs text-muted-foreground">
                        /p/{p.slug}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.order}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(p.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(p.id, p.isActive)}
                        disabled={busyId === p.id}
                        /* ⚠️ `aria-pressed` — төлөвийг ЗӨВХӨН өнгө/текстээр
                           илэрхийлбэл скрин ридер уншихгүй */
                        aria-pressed={p.isActive}
                        aria-label={p.isActive ? 'Идэвхгүй болгох' : 'Идэвхжүүлэх'}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-60',
                          p.isActive
                            ? 'bg-success/15 text-success hover:bg-success/25'
                            : 'bg-muted text-muted-foreground hover:bg-accent',
                        )}
                      >
                        {busyId === p.id && <Loader2 size={11} className="animate-spin" />}
                        {p.isActive ? 'Идэвхтэй' : 'Идэвхгүй'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* ⚠️ 36px — өмнөх 26px (`p-1.5`+14px) нь хүрэлцэх
                            зөвлөмжөөс хамаагүй бага, таблет дээр устгахыг
                            андуурч дардаг байв */}
                        <Link
                          href={`/pages/${p.id}`}
                          aria-label="Засах"
                          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Pencil size={15} />
                        </Link>
                        <button
                          onClick={() => remove(p.id, p.title, p.slug)}
                          aria-label="Устгах"
                          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
          {!isLoading && !isError && !rows.length && (
            /* ⚠️ Хайлтын үр дүн хоосон БА дата огт байхгүй хоёрыг ЯЛГАНА —
               эс бөгөөс админ "бүх хуудас устсан" гэж сандарна */
            <TableEmptyState
              icon={FileText}
              message={q ? 'Хайлтад тохирох хуудас олдсонгүй' : 'Хуудас байхгүй байна'}
              description={
                q
                  ? 'Өөр түлхүүр үг эсвэл хаяг оруулж үзнэ үү.'
                  : 'Үйлчилгээний нөхцөл, Нууцлалын бодлого зэрэг статик хуудсыг нэмбэл /p/[хаяг] замаар харагдана.'
              }
              action={
                q ? (
                  <button
                    onClick={() => setQ('')}
                    className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-accent"
                  >
                    Шүүлт цэвэрлэх
                  </button>
                ) : (
                  <Link
                    href="/pages/new"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
                  >
                    <Plus size={15} /> Эхний хуудас нэмэх
                  </Link>
                )
              }
            />
          )}
        </div>
      </main>
    </AdminShell>
  );
}
