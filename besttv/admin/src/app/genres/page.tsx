'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { api } from '@/lib/api';
import { useAdminGenres, type AdminGenre } from '@/lib/queries';

interface FormState {
  name: string;
  nameEn: string;
  order: string;
  isAdult: boolean;
}

const EMPTY: FormState = { name: '', nameEn: '', order: '0', isAdult: false };

export default function GenresPage() {
  const { data, isLoading } = useAdminGenres();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<AdminGenre | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const openEdit = (genre: AdminGenre | 'new') => {
    setEditing(genre);
    setForm(
      genre === 'new'
        ? EMPTY
        : {
            name: genre.name,
            nameEn: '',
            order: String(genre.order),
            isAdult: genre.isAdult,
          },
    );
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Жанрын нэр оруулна уу');
      return;
    }

    // 18+ болгож байвал баталгаажуулна (үр дагавар том)
    if (form.isAdult && editing !== 'new' && !editing?.isAdult) {
      const ok = await confirm({
        title: `"${form.name}" жанрыг 18+ болгох уу?`,
        description: 'Энэ жанрын контент олон нийтэд харагдахаа болино.',
        bullets: [
          'Нүүр хуудас, каталог, хайлтаас бүрэн алга болно',
          'Зөвхөн /adult хуудсанд, нас баталгаажуулсны дараа харагдана',
          'Үзэхэд 18+ багц (эсвэл VIP) шаардлагатай болно',
        ],
        confirmLabel: '18+ болгох',
        tone: 'warning',
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        nameEn: form.nameEn.trim() || undefined,
        order: Number(form.order) || 0,
        isAdult: form.isAdult,
      };
      if (editing === 'new') {
        await api('/admin/genres', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Жанр нэмэгдлээ');
      } else if (editing) {
        await api(`/admin/genres/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast.success('Хадгалагдлаа');
      }
      qc.invalidateQueries({ queryKey: ['admin-genres'] });
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (g: AdminGenre) => {
    const ok = await confirm({
      title: `"${g.name}" жанрыг устгах уу?`,
      description: g._count?.titles
        ? `Энэ жанр ${g._count.titles} контенттой холбоотой байна.`
        : 'Энэ жанрыг бүрмөсөн устгана.',
      bullets: [
        'Контент өөрөө устахгүй, зөвхөн жанрын холбоос сална',
        'Энэ жанрыг ашигладаг багцаас автоматаар хасагдана',
      ],
      tone: 'danger',
    });
    if (!ok) return;
    await api(`/admin/genres/${g.id}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['admin-genres'] });
    toast.success('Жанр устгагдлаа');
  };

  return (
    <AdminShell>
      <AdminTopbar
        title="Жанрууд"
        subtitle={data ? `Нийт ${data.length} жанр · ${data.filter((g) => g.isAdult).length} нь 18+` : undefined}
      />

      <main className="mx-auto max-w-3xl p-8 pt-6">
        <div className="mb-4 rounded-lg border border-primary/25 bg-primary/8 p-3 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Жанр = багцын хандалт.</strong> Багц бүр сонгосон
          жанруудын контентыг нээдэг. Улс/төрлөөр (Монгол кино, Солонгос кино гэх мэт) жанр үүсгээд{' '}
          <strong className="text-foreground">Багц</strong> хуудаснаас холбоно. 🔞 тэмдэгтэй жанр нь
          ерөнхий каталогт харагдахгүй.
        </div>

        <button
          onClick={() => openEdit('new')}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
        >
          <Plus size={15} /> Жанр нэмэх
        </button>

        <div className="admin-card mt-5 overflow-hidden rounded-xl">
          {isLoading ? (
            <div className="flex items-center justify-center py-14 text-muted-foreground">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data?.map((g) => (
                <div
                  key={g.id}
                  className="group flex items-center justify-between px-4 py-3 transition-colors hover:bg-accent/40"
                >
                  <button
                    onClick={() => openEdit(g)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <Tags size={14} className={g.isAdult ? 'text-destructive' : 'text-muted-foreground'} />
                    <span className="truncate font-medium text-foreground group-hover:text-primary">
                      {g.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {g._count?.titles ?? 0} контент
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {g.isAdult && (
                      <span className="rounded-md bg-destructive/15 px-2 py-1 text-xs font-medium text-destructive">
                        🔞 18+
                      </span>
                    )}
                    <button
                      onClick={() => openEdit(g)}
                      aria-label="Засах"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => remove(g)}
                      aria-label="Устгах"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isLoading && !data?.length && <TableEmptyState icon={Tags} message="Жанр байхгүй байна" />}
        </div>
      </main>

      {editing && (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing === 'new' ? 'Шинэ жанр' : 'Жанр засах'}</DialogTitle>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
              className="space-y-3"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Жанрын нэр
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="ж: Монгол кино"
                  autoFocus
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Англи нэр (заавал биш)
                  </label>
                  <input
                    value={form.nameEn}
                    onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
                    placeholder="Mongolian"
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Дараалал
                  </label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              <label
                className={cn(
                  'flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors',
                  form.isAdult
                    ? 'border-destructive/40 bg-destructive/8'
                    : 'border-border hover:bg-accent/40',
                )}
              >
                <input
                  type="checkbox"
                  checked={form.isAdult}
                  onChange={(e) => setForm((f) => ({ ...f, isAdult: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    🔞 Насанд хүрэгчдийн (18+)
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Нүүр, каталог, хайлтаас алга болж зөвхөн /adult хуудсанд харагдана
                  </span>
                </span>
              </label>

              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                Хадгалах
              </button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </AdminShell>
  );
}
