'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { ImageUpload } from '@/components/image-upload';
import { RichEditor } from '@/components/rich-editor';
import { api } from '@/lib/api';
import { useAdminBlogPost } from '@/lib/queries';

export default function BlogEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const router = useRouter();
  const qc = useQueryClient();
  const { data: existing } = useAdminBlogPost(id);

  const [form, setForm] = useState({
    title: '',
    excerpt: '',
    content: '',
    author: '',
    tags: '',
    isPublished: false,
    metaTitle: '',
    metaDescription: '',
  });
  const [coverKey, setCoverKey] = useState<string | undefined>();
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(isNew ? null : id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing && !isNew) {
      setForm({
        title: existing.title,
        excerpt: existing.excerpt,
        content: existing.content,
        author: existing.author ?? '',
        tags: existing.tags.join(', '),
        isPublished: existing.isPublished,
        metaTitle: existing.metaTitle ?? '',
        metaDescription: existing.metaDescription ?? '',
      });
      setCoverKey(existing.coverKey ?? undefined);
      setCoverUrl(existing.coverUrl);
    }
  }, [existing, isNew]);

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Гарчиг, агуулгыг бөглөнө үү');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        excerpt: form.excerpt || undefined,
        content: form.content,
        author: form.author || undefined,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        isPublished: form.isPublished,
        metaTitle: form.metaTitle || undefined,
        metaDescription: form.metaDescription || undefined,
        coverKey,
      };

      if (savedId) {
        await api(`/admin/blog/${savedId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast.success('Хадгалагдлаа');
      } else {
        const created = await api<{ id: string }>('/admin/blog', { method: 'POST', body: JSON.stringify(payload) });
        setSavedId(created.id);
        toast.success('Нийтлэл vvсгэгдлээ');
        router.replace(`/blog/${created.id}`);
      }
      qc.invalidateQueries({ queryKey: ['admin-blog'] });
    } catch {
      toast.error('Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell>
      <AdminTopbar title={isNew ? 'Шинэ нийтлэл' : 'Нийтлэл засах'} />

      <main className="grid gap-6 p-8 pt-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="admin-card rounded-xl p-6">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Гарчиг</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />

            <label className="mb-1.5 mt-4 block text-xs font-medium text-muted-foreground">Товч тайлбар</label>
            <textarea
              value={form.excerpt}
              onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />

            <label className="mb-1.5 mt-4 block text-xs font-medium text-muted-foreground">Агуулга</label>
            <RichEditor
              value={form.content}
              onChange={(html) => setForm((f) => ({ ...f, content: html }))}
              placeholder="Нийтлэлийн агуулгаа энд бичнэ үү..."
              minHeight={360}
            />
          </div>

          <div className="admin-card rounded-xl p-6">
            <h2 className="mb-3 text-sm font-semibold text-foreground">SEO</h2>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Meta Title</label>
            <input
              value={form.metaTitle}
              onChange={(e) => setForm((f) => ({ ...f, metaTitle: e.target.value }))}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <label className="mb-1.5 mt-4 block text-xs font-medium text-muted-foreground">Meta Description</label>
            <textarea
              value={form.metaDescription}
              onChange={(e) => setForm((f) => ({ ...f, metaDescription: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="space-y-5">
          <div className="admin-card rounded-xl p-6">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Ковер зураг</label>
            <ImageUpload kind="backdrop" aspect="backdrop" value={coverUrl} onChange={(key, url) => { setCoverKey(key); setCoverUrl(url); }} />
          </div>

          <div className="admin-card rounded-xl p-6">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Зохиогч</label>
            <input
              value={form.author}
              onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />

            <label className="mb-1.5 mt-4 block text-xs font-medium text-muted-foreground">Tags (таслалаар)</label>
            <input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="кино, шинэ мэдээ"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />

            <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              Нийтлэх
            </label>

            <button
              onClick={save}
              disabled={saving || !form.title}
              className="mt-5 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
            >
              {saving ? 'Хадгалж байна...' : 'Хадгалах'}
            </button>
          </div>
        </div>
      </main>
    </AdminShell>
  );
}
