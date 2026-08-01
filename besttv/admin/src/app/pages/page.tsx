'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { api } from '@/lib/api';
import { useAdminPages } from '@/lib/queries';

export default function PagesListPage() {
  const { data, isLoading } = useAdminPages();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const remove = async (id: string, title: string, slug: string) => {
    const ok = await confirm({
      title: `"${title}" хуудсыг устгах уу?`,
      description: 'Хуудас болон түүний бүх агуулга бүрмөсөн устана.',
      bullets: [`Сайт дээрх /p/${slug} хаяг 404 болно`, 'Footer-ээс автоматаар хасагдана'],
      tone: 'danger',
    });
    if (!ok) return;
    await api(`/admin/pages/${id}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['admin-pages'] });
    toast.success('Хуудас устгагдлаа');
  };

  const [busyId, setBusyId] = useState<string | null>(null);

  const toggleActive = async (id: string, isActive: boolean) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await api(`/admin/pages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !isActive }),
      });
      await qc.invalidateQueries({ queryKey: ['admin-pages'] });
      toast.success(isActive ? 'Хуудас идэвхгүй боллоо' : 'Хуудас идэвхжлээ');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Өөрчилж чадсангүй');
    } finally {
      setBusyId(null);
    }
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

        <Link
          href="/pages/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
        >
          <Plus size={15} /> Хуудас нэмэх
        </Link>

        <div className="admin-card mt-5 overflow-hidden rounded-xl">
          {isLoading ? (
            <div className="flex items-center justify-center py-14 text-muted-foreground">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
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
                {data?.map((p) => (
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
                      {new Date(p.updatedAt).toLocaleDateString('mn-MN')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(p.id, p.isActive)}
                        disabled={busyId === p.id}
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
                        <Link
                          href={`/pages/${p.id}`}
                          aria-label="Засах"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Pencil size={14} />
                        </Link>
                        <button
                          onClick={() => remove(p.id, p.title, p.slug)}
                          aria-label="Устгах"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!isLoading && !data?.length && <TableEmptyState icon={FileText} message="Хуудас байхгүй байна" />}
        </div>
      </main>
    </AdminShell>
  );
}
