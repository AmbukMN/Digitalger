'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { TableEmptyState } from '@/components/table-empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { AdminErrorState } from '@/components/admin-error-state';
import { ImageUpload } from '@/components/image-upload';
import { api } from '@/lib/api';
import { runMutation } from '@/lib/mutate';
import { useAdminBanners, type AdminBanner } from '@/lib/queries';

const EMPTY = {
  title: '',
  subtitle: '',
  imageKey: '',
  imageUrl: null as string | null,
  mobileImageKey: '',
  mobileImageUrl: null as string | null,
  ctaText: '',
  ctaHref: '',
  position: 2,
  order: 0,
  isActive: true,
  startsAt: '',
  endsAt: '',
};

/** `2026-08-08T10:00:00.000Z` → `2026-08-08T10:00` (datetime-local) */
const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 16) : '');

export default function BannersPage() {
  const { data, isLoading, isError, error, refetch } = useAdminBanners();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<AdminBanner | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data ?? [];
    return (data ?? []).filter(
      (b) =>
        b.title.toLowerCase().includes(needle) ||
        b.subtitle.toLowerCase().includes(needle) ||
        b.ctaHref.toLowerCase().includes(needle),
    );
  }, [data, q]);

  const openEdit = (b: AdminBanner | 'new') => {
    setEditing(b);
    setForm(
      b === 'new'
        ? EMPTY
        : {
            title: b.title,
            subtitle: b.subtitle,
            imageKey: b.imageKey,
            imageUrl: b.imageUrl,
            mobileImageKey: b.mobileImageKey ?? '',
            mobileImageUrl: b.mobileImageUrl,
            ctaText: b.ctaText,
            ctaHref: b.ctaHref,
            position: b.position,
            order: b.order,
            isActive: b.isActive,
            startsAt: toLocalInput(b.startsAt),
            endsAt: toLocalInput(b.endsAt),
          },
    );
  };

  const save = async () => {
    if (!form.imageKey) {
      toast.error('Зураг заавал — 16:9 өргөн зураг байршуулна уу');
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title,
      subtitle: form.subtitle,
      imageKey: form.imageKey,
      /* ⚠️ Хоосон мөр илгээвэл backend `null` болгоно (өргөн зураг хэрэглэнэ) */
      mobileImageKey: form.mobileImageKey || '',
      ctaText: form.ctaText,
      ctaHref: form.ctaHref,
      position: Number(form.position) || 0,
      order: Number(form.order) || 0,
      isActive: form.isActive,
      /* ⚠️ `datetime-local` нь цагийн бүсгүй — ISO болгоно */
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    };
    const ok = await runMutation(
      () =>
        editing === 'new'
          ? api('/admin/banners', { method: 'POST', body: JSON.stringify(payload) })
          : api(`/admin/banners/${(editing as AdminBanner).id}`, {
              method: 'PATCH',
              body: JSON.stringify(payload),
            }),
      {
        success: editing === 'new' ? 'Баннер нэмэгдлээ' : 'Хадгалагдлаа',
        onDone: () => qc.invalidateQueries({ queryKey: ['admin-banners'] }),
      },
    );
    if (ok) setEditing(null);
    setSaving(false);
  };

  const remove = async (b: AdminBanner) => {
    const ok = await confirm({
      title: 'Баннерыг устгах уу?',
      description: `${b.title || '(гарчиггүй)'} — зураг нь R2-оос ч устана.`,
      tone: 'danger',
    });
    if (!ok) return;
    await runMutation(() => api(`/admin/banners/${b.id}`, { method: 'DELETE' }), {
      success: 'Баннер устгагдлаа',
      onDone: () => qc.invalidateQueries({ queryKey: ['admin-banners'] }),
    });
  };

  const toggleActive = async (b: AdminBanner) => {
    await runMutation(
      () =>
        api(`/admin/banners/${b.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !b.isActive }),
        }),
      {
        success: b.isActive ? 'Идэвхгүй болголоо' : 'Идэвхжүүллээ',
        onDone: () => qc.invalidateQueries({ queryKey: ['admin-banners'] }),
      },
    );
  };

  /** Хугацаа дууссан/эхлээгүй эсэх — админ бодит төлөвийг шууд харна */
  const statusOf = (b: AdminBanner) => {
    if (!b.isActive) return { label: 'Идэвхгүй', tone: 'off' as const };
    const now = Date.now();
    if (b.startsAt && new Date(b.startsAt).getTime() > now) {
      return { label: 'Хүлээгдэж буй', tone: 'wait' as const };
    }
    if (b.endsAt && new Date(b.endsAt).getTime() < now) {
      return { label: 'Дууссан', tone: 'off' as const };
    }
    return { label: 'Идэвхтэй', tone: 'on' as const };
  };

  return (
    <AdminShell>
      <AdminTopbar
        title="Нүүрний баннер"
        subtitle={data ? `${data.length} баннер` : undefined}
      />

      <main className="p-4 pt-5 sm:p-8 sm:pt-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Гарчиг, холбоосоор хайх…"
              aria-label="Баннер хайх"
              className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={() => openEdit('new')}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
          >
            <Plus size={15} /> Баннер нэмэх
          </button>
        </div>

        {q && (
          <p className="mt-2 text-xs text-muted-foreground">
            {rows.length} / {data?.length ?? 0} баннер
          </p>
        )}

        {/*
          ⚠️ ТАЙЛБАР — админ "position" гэж юу болохыг мэдэхгүй бол
          баннераа хаана ч харагдахгүй тохируулна.
        */}
        <p className="mt-3 rounded-lg border border-border bg-accent/30 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Байрлал</strong> = хэддэх жанрын эгнээний{' '}
          <strong className="text-foreground">дараа</strong> баннер орох вэ.
          <code className="mx-1 rounded bg-accent px-1">0</code> = хамгийн дээр,
          <code className="mx-1 rounded bg-accent px-1">2</code> = 2 эгнээний дараа. Нүүрэнд
          15 эгнээ гардаг — түүнээс их утга бол баннер хамгийн доор гарна.
        </p>

        <div className="admin-card mt-4 overflow-hidden rounded-xl">
          {isError ? (
            <AdminErrorState error={error} onRetry={() => void refetch()} />
          ) : isLoading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-180 text-sm">
                <thead className="bg-accent/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Баннер</th>
                    <th className="px-4 py-3 text-left font-semibold">Холбоос</th>
                    <th className="px-4 py-3 text-left font-semibold">Байрлал</th>
                    <th className="px-4 py-3 text-left font-semibold">Хугацаа</th>
                    <th className="px-4 py-3 text-left font-semibold">Төлөв</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((b) => {
                    const st = statusOf(b);
                    return (
                      <tr
                        key={b.id}
                        className={cn(
                          'transition-colors hover:bg-accent/40',
                          st.tone === 'off' && 'opacity-55',
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-11 w-28 shrink-0 overflow-hidden rounded bg-muted">
                              {b.imageUrl && (
                                <Image
                                  src={b.imageUrl}
                                  alt=""
                                  fill
                                  sizes="112px"
                                  className="object-cover"
                                />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">
                                {b.title || <span className="text-muted-foreground">(гарчиггүй)</span>}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{b.subtitle}</p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-50 px-4 py-3">
                          <p className="truncate text-xs text-muted-foreground">
                            {b.ctaHref || '—'}
                          </p>
                          {b.ctaText && (
                            <span className="mt-0.5 inline-block rounded bg-accent px-1.5 py-0.5 text-[11px] text-foreground">
                              {b.ctaText}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {b.position}
                          {b.order > 0 && <span className="text-xs"> · {b.order}</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {b.startsAt || b.endsAt ? (
                            <>
                              {b.startsAt ? new Date(b.startsAt).toLocaleDateString('mn-MN') : '…'}
                              {' – '}
                              {b.endsAt ? new Date(b.endsAt).toLocaleDateString('mn-MN') : '…'}
                            </>
                          ) : (
                            'Хязгааргүй'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleActive(b)}
                            aria-pressed={b.isActive}
                            aria-label={b.isActive ? 'Идэвхгүй болгох' : 'Идэвхжүүлэх'}
                            className={cn(
                              'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                              st.tone === 'on'
                                ? 'bg-success/15 text-success hover:bg-success/25'
                                : st.tone === 'wait'
                                  ? 'bg-premium/15 text-premium hover:bg-premium/25'
                                  : 'bg-destructive/15 text-destructive hover:bg-destructive/25',
                            )}
                          >
                            {st.label}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(b)}
                              aria-label="Засах"
                              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => remove(b)}
                              aria-label="Устгах"
                              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!isLoading && !isError && !rows.length && (
            <TableEmptyState
              icon={ImageIcon}
              message={q ? 'Хайлтад тохирох баннер олдсонгүй' : 'Баннер байхгүй байна'}
              description={
                q
                  ? 'Өөр түлхүүр үгээр хайж үзнэ үү.'
                  : 'Нүүр хуудасны жанрын эгнээнүүдийн дунд сурталчилгааны зурвас нэмнэ.'
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
                  <button
                    onClick={() => openEdit('new')}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
                  >
                    <Plus size={15} /> Эхний баннер
                  </button>
                )
              }
            />
          )}
        </div>
      </main>

      {editing && (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing === 'new' ? 'Шинэ баннер' : 'Баннер засах'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Өргөн зураг (16:9) *
                </label>
                <ImageUpload
                  kind="backdrop"
                  aspect="backdrop"
                  value={form.imageUrl}
                  onChange={(key, url) => setForm((f) => ({ ...f, imageKey: key, imageUrl: url }))}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Мобайл зураг (заавал биш)
                </label>
                {/* ⚠️ Өргөн 16:9 нь утсан дээр хэт нарийн — босоо зураг нэмж болно */}
                <p className="mb-2 text-xs text-muted-foreground">
                  Хоосон бол дээрх өргөн зураг хэрэглэгдэнэ.
                </p>
                <ImageUpload
                  kind="backdrop"
                  aspect="backdrop"
                  value={form.mobileImageUrl}
                  onChange={(key, url) =>
                    setForm((f) => ({ ...f, mobileImageKey: key, mobileImageUrl: url }))
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Гарчиг</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Жихүүдэс хүрэм хайр"
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Дэд гарчиг</label>
                  <input
                    value={form.subtitle}
                    onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Товчны текст</label>
                  <input
                    value={form.ctaText}
                    onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))}
                    placeholder="Үзэх"
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Хоосон бол товч харагдахгүй</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Холбоос</label>
                  <input
                    value={form.ctaHref}
                    onChange={(e) => setForm((f) => ({ ...f, ctaHref: e.target.value }))}
                    placeholder="/movie/slug эсвэл /pricing"
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Байрлал (эгнээний дараа)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.position}
                    onChange={(e) => setForm((f) => ({ ...f, position: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Эрэмбэ (ижил байрлалд)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.order}
                    onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Эхлэх (заавал биш)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Дуусах (заавал биш)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-input"
                />
                Идэвхтэй
              </label>

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
