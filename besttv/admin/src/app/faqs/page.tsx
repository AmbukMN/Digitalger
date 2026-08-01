'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { HelpCircle, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { api } from '@/lib/api';
import { useAdminFaqs, type AdminFaq } from '@/lib/queries';

const EMPTY: Omit<AdminFaq, 'id'> = { question: '', answer: '', category: 'Ерөнхий', order: 0, isActive: true };

export default function FaqsPage() {
  const { data, isLoading } = useAdminFaqs();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdminFaq | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

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
      setEditing(null);
    } catch {
      toast.error('Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (f: AdminFaq) => {
    const ok = await confirm({
      title: 'Асуултыг устгах уу?',
      description: f.question,
      tone: 'danger',
    });
    if (!ok) return;
    await api(`/admin/faqs/${f.id}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['admin-faqs'] });
    toast.success('Асуулт устгагдлаа');
  };

  const toggleActive = async (faq: AdminFaq) => {
    await api(`/admin/faqs/${faq.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !faq.isActive }) });
    qc.invalidateQueries({ queryKey: ['admin-faqs'] });
  };

  return (
    <AdminShell>
      <AdminTopbar title="Түгээмэл асуулт" subtitle={data ? `Нийт ${data.length} асуулт` : undefined} />

      <main className="p-4 pt-5 sm:p-8 sm:pt-6">
        <button
          onClick={() => openEdit('new')}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
        >
          <Plus size={15} /> Асуулт нэмэх
        </button>

        <div className="admin-card mt-5 overflow-hidden rounded-xl">
          {isLoading ? (
            <div className="flex items-center justify-center py-14 text-muted-foreground">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
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
                {data?.map((f) => (
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
                        className={cn(
                          'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                          f.isActive ? 'bg-success/15 text-success hover:bg-success/25' : 'bg-destructive/15 text-destructive hover:bg-destructive/25',
                        )}
                      >
                        {f.isActive ? 'Идэвхтэй' : 'Идэвхгvй'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(f)} aria-label="Засах" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => remove(f)} aria-label="Устгах" className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!isLoading && !data?.length && <TableEmptyState icon={HelpCircle} message="Асуулт олдсонгүй" />}
        </div>
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
