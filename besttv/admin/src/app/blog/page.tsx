'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { api } from '@/lib/api';
import { useAdminBlogPosts } from '@/lib/queries';

export default function BlogPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, isFetching } = useAdminBlogPosts({ q, page });
  const qc = useQueryClient();
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

        <div className={cn('admin-card mt-5 overflow-hidden rounded-xl transition-opacity', isFetching && 'opacity-60')}>
          <table className="w-full text-sm">
            <thead className="bg-accent/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
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
          {!data?.items.length && <TableEmptyState icon={FileText} message="Нийтлэл олдсонгvй" />}
        </div>

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
    </AdminShell>
  );
}
