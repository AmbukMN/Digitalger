'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowUpDown, Loader2, Pencil, Plus, Search, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { AdminErrorState } from '@/components/admin-error-state';
import { api } from '@/lib/api';
import { runMutation } from '@/lib/mutate';
import { useAdminGenres, type AdminGenre } from '@/lib/queries';

interface FormState {
  name: string;
  nameEn: string;
  order: string;
  isAdult: boolean;
}

const EMPTY: FormState = { name: '', nameEn: '', order: '0', isAdult: false };

export default function GenresPage() {
  const { data, isLoading, isError, error, refetch } = useAdminGenres();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<AdminGenre | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');

  /**
   * ⚠️ Шүүлт CLIENT талд — жанрын жагсаалт богино (ихэвчлэн 30-аас цөөн)
   * тул сервер рүү дахин очих нь илүү удаан (сүлжээний саатал > шүүх хугацаа).
   */
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data ?? [];
    return (data ?? []).filter((g) => g.name.toLowerCase().includes(needle));
  }, [data, q]);

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

  /* ⚠️ `runMutation` — өмнө нь try/catch БАЙХГҮЙ байсан тул жанр
     ашиглагдаж байгаа (FK) эсвэл 403 гарвал toast ч гарахгүй, мөр ч
     арилахгүй → админ устсан гэж бодно */
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
    await runMutation(() => api(`/admin/genres/${g.id}`, { method: 'DELETE' }), {
      success: 'Жанр устгагдлаа',
      onDone: () => qc.invalidateQueries({ queryKey: ['admin-genres'] }),
    });
  };

  return (
    <AdminShell>
      <AdminTopbar
        title="Жанрууд"
        subtitle={data ? `Нийт ${data.length} жанр · ${data.filter((g) => g.isAdult).length} нь 18+` : undefined}
      />

      <main className="mx-auto max-w-3xl p-4 pt-5 sm:p-8 sm:pt-6">
        <div className="mb-4 rounded-lg border border-primary/25 bg-primary/8 p-3 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Жанр = багцын хандалт.</strong> Багц бүр сонгосон
          жанруудын контентыг нээдэг. Улс/төрлөөр (Монгол кино, Солонгос кино гэх мэт) жанр үүсгээд{' '}
          <strong className="text-foreground">Багц</strong> хуудаснаас холбоно. 🔞 тэмдэгтэй жанр нь
          ерөнхий каталогт харагдахгүй.
        </div>

        {/* ⚠️ Хайлт — өмнө нь ЗӨВХӨН доош гүйлгэж хайх боломжтой байв
            (жанр 40+ болоход хэрэгтэйгээ олохгүй) */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Жанрын нэрээр хайх…"
              aria-label="Жанр хайх"
              className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={() => openEdit('new')}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
          >
            <Plus size={15} /> Жанр нэмэх
          </button>
        </div>

        {/* ⚠️ Шүүлтийн үр дүнгийн тоо — админ "хайлт ажиллав уу" гэдгийг
            шууд харна (хоосон үр дүн нь эвдэрсэн гэж ойлгогдохгүй) */}
        {q && (
          <p className="mt-2 text-xs text-muted-foreground">
            {rows.length} / {data?.length ?? 0} жанр
          </p>
        )}

        <div className="admin-card mt-4 overflow-hidden rounded-xl">
          {isError ? (
            <AdminErrorState error={error} onRetry={() => void refetch()} />
          ) : isLoading ? (
            /* ⚠️ Spinner БИШ skeleton — төслийн дүрэм (бүтэц урьдчилж
               харагдаж, дата ирэхэд layout үсэрдэггүй) */
            <TableSkeleton rows={6} cols={3} />
          ) : (
            <div className="divide-y divide-border">
              {rows.map((g) => (
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
                    {/* ⚠️ Кинотой жанрт л эрэмбэлэх утгатай — хоосон жанрт
                        товч гарвал хоосон хуудас нээгдэж будлиан үүснэ */}
                    {(g._count?.titles ?? 0) > 1 && (
                      <Link
                        href={`/genres/${g.id}/order`}
                        aria-label="Кино эрэмбэлэх"
                        title="Нүүрэнд гарах дарааллыг өөрчлөх"
                        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                      >
                        <ArrowUpDown size={15} />
                      </Link>
                    )}
                    {/* ⚠️ 36px — өмнөх 26px (`p-1.5`+14px) нь хүрэлцэх
                        зөвлөмжөөс хамаагүй бага, таблет дээр устгахыг
                        андуурч дардаг байв */}
                    <button
                      onClick={() => openEdit(g)}
                      aria-label="Засах"
                      className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => remove(g)}
                      aria-label="Устгах"
                      className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isLoading && !isError && !rows.length && (
            /* ⚠️ Хайлтын үр дүн хоосон БА дата огт байхгүй хоёрыг ЯЛГАНА —
               эс бөгөөс админ "бүх жанр устсан" гэж сандарна */
            <TableEmptyState
              icon={Tags}
              message={q ? 'Хайлтад тохирох жанр олдсонгүй' : 'Жанр байхгүй байна'}
              description={
                q
                  ? 'Өөр түлхүүр үг оруулж үзнэ үү.'
                  : 'Улс/төрлөөр жанр үүсгээд Багц хуудаснаас холбоно.'
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
                  <button
                    onClick={() => openEdit('new')}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
                  >
                    <Plus size={15} /> Эхний жанр нэмэх
                  </button>
                )
              }
            />
          )}
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
