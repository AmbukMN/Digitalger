'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { HelpCircle, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { AdminErrorState } from '@/components/admin-error-state';
import { Pagination } from '@/components/pagination';
import { api } from '@/lib/api';
import { runMutation } from '@/lib/mutate';
import { useAdminFaqs, useAdminFaqCategories, type AdminFaq } from '@/lib/queries';

const EMPTY: Omit<AdminFaq, 'id'> = { question: '', answer: '', category: 'Ерөнхий', order: 0, isActive: true };

export default function FaqsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdminFaq | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [page, setPage] = useState(1);
  const confirm = useConfirm();

  /**
   * ⚠️⚠️ SERVER талын хуудаслалт + хайлт + ангиллын шүүлт.
   *
   * Өмнө нь бүх FAQ-г client-д татаж шүүдэг байсан — асуулт олноор
   * нэмэгдэхэд жагсаалт таслагдаж, хуудаслалтгүй болдог байв. Одоо
   * хайлт/шүүлт/хуудаслалт бүгд серверт (coupons-той ижил pattern).
   */
  const LIMIT = 20;
  /* ⚠️ Хайлтыг debounce — үсэг бүрд сервер рүү очихгүй */
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  /* ⚠️ Хайлт/шүүлт солиход эхний хуудас руу буцах (хоосон хуудсанд гацахгүй) */
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, cat]);

  const { data, isLoading, isError, error, refetch } = useAdminFaqs({
    page,
    limit: LIMIT,
    search: debouncedQ || undefined,
    category: cat || undefined,
  });
  const rows = data?.items ?? [];

  /* ⚠️ Ангиллын жагсаалтыг СЕРВЕРЭЭС үүсгэнэ — хуудаслалт идэвхжсэн тул
     тухайн хуудсан дахь мөрөөс цуглуулбал бүх ангилал шүүлтэд гарахгүй */
  const { data: categories = [] } = useAdminFaqCategories();

  const openEdit = (faq: AdminFaq | 'new') => {
    setEditing(faq);
    setForm(faq === 'new' ? EMPTY : { question: faq.question, answer: faq.answer, category: faq.category, order: faq.order, isActive: faq.isActive });
  };

  const save = async () => {
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error('Асуулт, хариулт хоёуланг бөглөнө үү');
      return;
    }
    setSaving(true);
    try {
      if (editing === 'new') {
        await api('/admin/faqs', { method: 'POST', body: JSON.stringify(form) });
        toast.success('Асуулт нэмэгдлээ');
      } else if (editing) {
        await api(`/admin/faqs/${editing.id}`, { method: 'PATCH', body: JSON.stringify(form) });
        toast.success('Хадгалагдлаа');
      }
      qc.invalidateQueries({ queryKey: ['admin-faqs'] });
      /* ⚠️ Шинэ ангилал орж ирж болзошгүй — шүүлтийн dropdown-г шинэчилнэ */
      qc.invalidateQueries({ queryKey: ['admin-faq-categories'] });
      setEditing(null);
    } catch {
      toast.error('Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  /* ⚠️ `runMutation` — өмнө нь try/catch БАЙХГҮЙ байсан тул алдаа
     гарвал toast ч гарахгүй, мөр ч устахгүй (админ болсон гэж бодно) */
  const remove = async (f: AdminFaq) => {
    const ok = await confirm({
      title: 'Асуултыг устгах уу?',
      description: f.question,
      tone: 'danger',
    });
    if (!ok) return;
    await runMutation(() => api(`/admin/faqs/${f.id}`, { method: 'DELETE' }), {
      success: 'Асуулт устгагдлаа',
      onDone: () => qc.invalidateQueries({ queryKey: ['admin-faqs'] }),
    });
  };

  const toggleActive = async (faq: AdminFaq) => {
    await runMutation(
      () =>
        api(`/admin/faqs/${faq.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !faq.isActive }),
        }),
      {
        /* ⚠️ Өмнө нь амжилтын toast ч БАЙГААГҮЙ — админ дарсан эсэхээ
           мэдэхгүй дахин дахин дардаг байв */
        success: faq.isActive ? 'Идэвхгүй болголоо' : 'Идэвхжүүллээ',
        onDone: () => qc.invalidateQueries({ queryKey: ['admin-faqs'] }),
      },
    );
  };

  return (
    <AdminShell>
      <AdminTopbar title="Түгээмэл асуулт" subtitle={data ? `Нийт ${data.total} асуулт` : undefined} />

      <main className="p-4 pt-5 sm:p-8 sm:pt-6">
        {/* ⚠️ Хайлт + ангиллын шүүлт — өмнө нь ЗӨВХӨН доош гүйлгэж
            хайх боломжтой байв (100+ асуулт болоход ашиглах аргагүй) */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Асуулт, хариултаас хайх…"
              aria-label="Асуулт хайх"
              className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            aria-label="Ангилал шүүх"
            className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">Бүх ангилал</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={() => openEdit('new')}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
          >
            <Plus size={15} /> Асуулт нэмэх
          </button>
        </div>

        {/* ⚠️ Шүүлтийн үр дүнгийн тоо — админ "хайлт ажиллав уу" гэдгийг
            шууд харна (хоосон үр дүн нь эвдэрсэн гэж ойлгогдохгүй) */}
        {(q || cat) && (
          <p className="mt-2 text-xs text-muted-foreground">
            Нийт {data?.total ?? 0} асуулт олдлоо
          </p>
        )}

        <div className="admin-card mt-4 overflow-hidden rounded-xl">
          {isError ? (
            <AdminErrorState error={error} onRetry={() => void refetch()} />
          ) : isLoading ? (
            /* ⚠️ Spinner БИШ skeleton — төслийн дүрэм (бүтэц урьдчилж
               харагдаж, дата ирэхэд layout үсэрдэггүй) */
            <TableSkeleton rows={6} cols={5} />
          ) : (
            /* ⚠️ Мобайлд хэвтээ гүйлт — 5 багана 375px дэлгэцэнд шахагдаж
               текст давхцдаг байв */
            <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-sm">
              <thead className="bg-accent/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Асуулт</th>
                  <th className="px-4 py-3 text-left font-semibold">Ангилал</th>
                  <th className="px-4 py-3 text-left font-semibold">Дараалал</th>
                  <th className="px-4 py-3 text-left font-semibold">Төлөв</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((f) => (
                  <tr key={f.id} className="transition-colors hover:bg-accent/40">
                    <td className="max-w-md px-4 py-3">
                      <p className="truncate font-medium text-foreground">{f.question}</p>
                      <p className="truncate text-xs text-muted-foreground">{f.answer}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{f.category}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.order}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(f)}
                        /* ⚠️ `aria-pressed` — төлөвийг ЗӨВХӨН өнгө/текстээр
                           илэрхийлбэл скрин ридер уншихгүй */
                        aria-pressed={f.isActive}
                        aria-label={f.isActive ? 'Идэвхгүй болгох' : 'Идэвхжүүлэх'}
                        className={cn(
                          'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                          f.isActive ? 'bg-success/15 text-success hover:bg-success/25' : 'bg-destructive/15 text-destructive hover:bg-destructive/25',
                        )}
                      >
                        {f.isActive ? 'Идэвхтэй' : 'Идэвхгүй'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* ⚠️ 36px — өмнөх 26px (`p-1.5`+14px) нь хүрэлцэх
                            зөвлөмжөөс хамаагүй бага, таблет дээр устгахыг
                            андуурч дардаг байв */}
                        <button onClick={() => openEdit(f)} aria-label="Засах" className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => remove(f)} aria-label="Устгах" className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive">
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
               эс бөгөөс админ "бүх FAQ устсан" гэж сандарна */
            <TableEmptyState
              icon={HelpCircle}
              message={q || cat ? 'Хайлтад тохирох асуулт олдсонгүй' : 'Асуулт байхгүй байна'}
              description={
                q || cat
                  ? 'Өөр түлхүүр үг эсвэл ангилал сонгож үзнэ үү.'
                  : 'Хэрэглэгчийн түгээмэл асуултыг нэмбэл /faq хуудсанд харагдана.'
              }
              action={
                q || cat ? (
                  <button
                    onClick={() => {
                      setQ('');
                      setCat('');
                    }}
                    className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-accent"
                  >
                    Шүүлт цэвэрлэх
                  </button>
                ) : (
                  <button
                    onClick={() => openEdit('new')}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
                  >
                    <Plus size={15} /> Эхний асуулт нэмэх
                  </button>
                )
              }
            />
          )}
        </div>

        <Pagination
          page={data?.page ?? 1}
          totalPages={data?.totalPages ?? 1}
          total={data?.total}
          limit={LIMIT}
          onPage={(p) => setPage(p)}
        />
      </main>

      {editing && (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing === 'new' ? 'Шинэ асуулт' : 'Асуулт засах'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Асуулт</label>
                <input
                  value={form.question}
                  onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Хариулт</label>
                <textarea
                  value={form.answer}
                  onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                  rows={4}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Ангилал</label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-xs text-muted-foreground">Дараалал</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>
              <button
                onClick={save}
                disabled={saving}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
              >
                {saving ? <Loader2 size={15} className="mx-auto animate-spin" /> : 'Хадгалах'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AdminShell>
  );
}
