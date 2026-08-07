'use client';

import { useState } from 'react';
import { BulkBar, SelectBox, useBulkSelect } from '@/lib/use-bulk-select';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { AdminErrorState } from '@/components/admin-error-state';
import { api } from '@/lib/api';
import { useAdminBlogPosts } from '@/lib/queries';

export default function BlogPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, isFetching, isError, error, refetch } = useAdminBlogPosts({ q, page });
  const qc = useQueryClient();
  /* Олноор устгах — бусад админ жагсаалттай ижил зан төлөв */
  const sel = useBulkSelect({
    endpoint: '/admin/blog/bulk-delete',
    invalidate: ['admin-blog'],
    label: 'нийтлэл',
  });
  const confirm = useConfirm();

  const remove = async (id: string, title: string) => {
    const ok = await confirm({
      title: `"${title}" нийтлэлийг устгах уу?`,
      description: 'Нийтлэл болон түүний агуулга бүрмөсөн устана.',
      bullets: ['Сэргээх боломжгүй', 'Сайт дээрх холбоос 404 болно'],
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api(`/admin/blog/${id}`, { method: 'DELETE' });
      await qc.invalidateQueries({ queryKey: ['admin-blog'] });
      toast.success('Нийтлэл устгагдлаа');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Устгаж чадсангүй');
    }
  };

  return (
    <AdminShell>
      <AdminTopbar title="Блог" subtitle={data ? `Нийт ${data.total} нийтлэл` : undefined} />

      <main className="p-4 pt-5 sm:p-8 sm:pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Гарчгаар хайх..."
              className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
            />
          </div>
          <Link
            href="/blog/new"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
          >
            <Plus size={15} /> Нийтлэл нэмэх
          </Link>
        </div>

        {/*
          ⚠️ `isError` — API унавал ХООСОН ХҮСНЭГТ харагдаж, админ
          "бүх нийтлэл устсан" гэж сандардаг байв.
        */}
        {isError ? (
          <div className="admin-card mt-5 rounded-xl">
            <AdminErrorState error={error} onRetry={() => void refetch()} />
          </div>
        ) : !data ? (
          /* ⚠️ ЭХНИЙ ачаалалтад `opacity-60` нь ЮУ Ч харуулдаггүй байв
             (хоосон хүснэгтийн толгой л). Skeleton нь бүтцийг харуулна. */
          <div className="admin-card mt-5 overflow-hidden rounded-xl">
            <TableSkeleton rows={8} cols={6} />
          </div>
        ) : (
        <div className={cn('admin-card mt-5 overflow-x-auto rounded-xl transition-opacity', isFetching && 'opacity-60')}>
          {/* ⚠️ Мобайлд 7 багана шахагдаж текст давхцдаг байв */}
          <table className="w-full min-w-200 text-sm">
            <thead className="bg-accent/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <SelectBox
                    checked={sel.allChecked((data?.items ?? []).map((p) => p.id))}
                    onChange={() => sel.toggleAll((data?.items ?? []).map((p) => p.id))}
                    ariaLabel="Хуудсан дээрх бүгдийг сонгох"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold">Гарчиг</th>
                <th className="px-4 py-3 text-left font-semibold">Зохиогч</th>
                <th className="px-4 py-3 text-left font-semibold">Vзсэн</th>
                <th className="px-4 py-3 text-left font-semibold">Огноо</th>
                <th className="px-4 py-3 text-left font-semibold">Төлөв</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.items.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <SelectBox
                      checked={sel.isSelected(p.id)}
                      onChange={() => sel.toggle(p.id)}
                      ariaLabel={`${p.title} сонгох`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/blog/${p.id}`} className="font-medium text-foreground hover:text-primary">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.author ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Eye size={13} /> {p.views}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString('mn-MN')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-md px-2 py-1 text-xs font-medium',
                        p.isPublished ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {p.isPublished ? 'Нийтлэгдсэн' : 'Ноорог'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(p.id, p.title)}
                      aria-label="Устгах"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.items.length && (
            <TableEmptyState
              icon={FileText}
              message={q ? 'Хайлтад тохирох нийтлэл олдсонгүй' : 'Нийтлэл байхгүй байна'}
              description={
                q
                  ? 'Өөр түлхүүр үгээр хайж үзнэ үү.'
                  : 'Блог нийтлэл нэмбэл /blog хуудсанд харагдана.'
              }
              action={
                q ? (
                  <button
                    onClick={() => setQ('')}
                    className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-accent"
                  >
                    Хайлт цэвэрлэх
                  </button>
                ) : (
                  <Link
                    href="/blog/new"
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
                  >
                    <Plus size={15} /> Эхний нийтлэл
                  </Link>
                )
              }
            />
          )}
        </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="mt-5 flex gap-1.5">
            {Array.from({ length: data.totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={cn(
                  'h-8 w-8 rounded-lg text-sm font-medium transition-colors',
                  page === i + 1 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </main>
      <BulkBar {...sel.bar} />
    </AdminShell>
  );
}
