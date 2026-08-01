'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { RichEditor } from '@/components/rich-editor';
import { api } from '@/lib/api';
import { useAdminPage } from '@/lib/queries';

/**
 * Сайтын хаяг — урьдчилан харах холбоост.
 * ⚠️ ХАТУУ localhost БИЧИХГҮЙ: production дээр админ "Харах" дарахад
 * localhost руу үсэрч эвдэрдэг байсан.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://besttv.us';

export default function PageEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const router = useRouter();
  const qc = useQueryClient();
  const { data: existing } = useAdminPage(id);

  const [form, setForm] = useState({
    slug: '',
    title: '',
    content: '',
    metaTitle: '',
    metaDescription: '',
    isActive: true,
    order: '0',
  });
  const [savedId, setSavedId] = useState<string | null>(isNew ? null : id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing && !isNew) {
      setForm({
        slug: existing.slug,
        title: existing.title,
        content: existing.content,
        metaTitle: existing.metaTitle ?? '',
        metaDescription: existing.metaDescription ?? '',
        isActive: existing.isActive,
        order: String(existing.order),
      });
    }
  }, [existing, isNew]);

  const save = async () => {
    if (!form.title.trim()) {
      toast.error('Гарчиг оруулна уу');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug: form.slug || undefined,
        title: form.title,
        content: form.content,
        metaTitle: form.metaTitle || undefined,
        metaDescription: form.metaDescription || undefined,
        isActive: form.isActive,
        order: Number(form.order) || 0,
      };

      if (savedId) {
        await api(`/admin/pages/${savedId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast.success('Хадгалагдлаа');
      } else {
        const created = await api<{ id: string }>('/admin/pages', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSavedId(created.id);
        toast.success('Хуудас үүслээ');
        router.replace(`/pages/${created.id}`);
      }
      qc.invalidateQueries({ queryKey: ['admin-pages'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell>
      <AdminTopbar
        title={isNew ? 'Шинэ хуудас' : 'Хуудас засах'}
        subtitle={!isNew ? form.title : undefined}
      />

      <main className="grid gap-6 p-8 pt-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="admin-card rounded-xl p-6">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Гарчиг</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="ж: Үйлчилгээний нөхцөл"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />

            <label className="mb-1.5 mt-4 block text-xs font-medium text-muted-foreground">
              Хаяг (slug) — сайт дээрх зам
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">/p/</span>
              <input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="terms (хоосон бол гарчгаас автомат)"
                className="flex-1 rounded-lg border border-input bg-card px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            <label className="mb-1.5 mt-4 block text-xs font-medium text-muted-foreground">
              Агуулга
            </label>
            <RichEditor
              value={form.content}
              onChange={(html) => setForm((f) => ({ ...f, content: html }))}
              placeholder="Хуудасны агуулгаа энд бичнэ үү..."
              minHeight={420}
            />
          </div>

          <div className="admin-card rounded-xl p-6">
            <h2 className="mb-1 text-sm font-semibold text-foreground">SEO</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Хоосон бол гарчиг/агуулгаас автоматаар үүснэ.
            </p>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Meta Title</label>
            <input
              value={form.metaTitle}
              onChange={(e) => setForm((f) => ({ ...f, metaTitle: e.target.value }))}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <label className="mb-1.5 mt-4 block text-xs font-medium text-muted-foreground">
              Meta Description
            </label>
            <textarea
              value={form.metaDescription}
              onChange={(e) => setForm((f) => ({ ...f, metaDescription: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <div className="admin-card sticky top-6 rounded-xl p-6">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Дараалал</label>
            <input
              type="number"
              value={form.order}
              onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />

            <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              Идэвхтэй (сайтад харагдана)
            </label>

            <button
              onClick={save}
              disabled={saving || !form.title}
              className="mt-5 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="mx-auto animate-spin" /> : 'Хадгалах'}
            </button>

            {savedId && form.slug && (
              <a
                href={`${SITE_URL}/p/${form.slug}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block rounded-lg bg-accent py-2 text-center text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Сайт дээр харах ↗
              </a>
            )}
          </div>
        </div>
      </main>
    </AdminShell>
  );
}
