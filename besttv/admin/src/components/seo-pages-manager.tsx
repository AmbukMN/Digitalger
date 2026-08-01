'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { ImageUpload } from '@/components/image-upload';
import { api } from '@/lib/api';

interface SeoPath {
  path: string;
  label: string;
}

interface PageOverride {
  title?: string;
  description?: string;
  ogImageUrl?: string | null;
  keywords?: string;
  noindex?: boolean;
}

const EMPTY: PageOverride = {
  title: '',
  description: '',
  ogImageUrl: null,
  keywords: '',
  noindex: false,
};

/**
 * Хуудас тус бүрийн SEO override.
 *
 * ⚠️ Зарчим: ЗӨВХӨН бөглөсөн талбар л дарж бичнэ. Хоосон орхивол тухайн
 * хуудасны кодод бичсэн анхдагч утга хэвээр үлдэнэ — санамсаргүй хоосон
 * гарчигтай болохоос сэргийлнэ.
 */
export function SeoPagesManager() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>('/');
  const [form, setForm] = useState<PageOverride>(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data: paths } = useQuery({
    queryKey: ['admin-seo-paths'],
    queryFn: () => api<SeoPath[]>('/admin/seo/paths'),
    staleTime: Infinity, // тогтмол жагсаалт
  });

  const { data: pages, isLoading } = useQuery({
    queryKey: ['admin-seo-pages'],
    queryFn: () => api<Record<string, PageOverride>>('/admin/seo/pages'),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Сонголт солигдоход тухайн замын хадгалсан утгыг ачаална
  useEffect(() => {
    setForm({ ...EMPTY, ...(pages?.[selected] ?? {}) });
  }, [selected, pages]);

  const save = async () => {
    setSaving(true);
    try {
      await api(`/admin/seo/pages?path=${encodeURIComponent(selected)}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      await qc.invalidateQueries({ queryKey: ['admin-seo-pages'] });
      toast.success('Хуудасны SEO хадгалагдлаа');
    } catch {
      toast.error('Хадгалахад алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await api(`/admin/seo/pages?path=${encodeURIComponent(selected)}`, { method: 'DELETE' });
      await qc.invalidateQueries({ queryKey: ['admin-seo-pages'] });
      setForm(EMPTY);
      toast.success('Анхдагч утга руу буцаалаа');
    } catch {
      toast.error('Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  /** Тухайн зам тохируулагдсан эсэх — жагсаалтад ✓ харуулна */
  const isSet = (path: string) => {
    const o = pages?.[path];
    return Boolean(o && (o.title || o.description || o.ogImageUrl || o.keywords || o.noindex));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-[220px_1fr]">
      {/* Замын жагсаалт */}
      <nav className="space-y-1" aria-label="Хуудас сонгох">
        {(paths ?? []).map((p) => (
          <button
            key={p.path}
            type="button"
            onClick={() => setSelected(p.path)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              selected === p.path
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <span className="truncate">
              {p.label}
              <span className="ml-1.5 text-[11px] opacity-60">{p.path}</span>
            </span>
            {isSet(p.path) && <Check size={14} className="shrink-0" />}
          </button>
        ))}
      </nav>

      {/* Тохиргооны талбарууд */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground">
          Хоосон орхивол тухайн хуудасны анхдагч утга хэвээр үлдэнэ.
        </p>

        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
            Гарчиг (title)
            <span>{(form.title ?? '').length}/60</span>
          </span>
          <input
            value={form.title ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Анхдагчийг хэрэглэнэ"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
            Тайлбар (description)
            <span>{(form.description ?? '').length}/160</span>
          </span>
          <textarea
            value={form.description ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            placeholder="Анхдагчийг хэрэглэнэ"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Түлхүүр үг (таслалаар)
          </span>
          <input
            value={form.keywords ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
            placeholder="монгол кино, онлайн кино"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
            OG зураг (1200×630) — линк хуваалцахад харагдана
          </span>
          <div className="w-64">
            <ImageUpload
              kind="gallery"
              aspect="backdrop"
              value={form.ogImageUrl ?? null}
              onChange={(_key, url) => setForm((f) => ({ ...f, ogImageUrl: url }))}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.noindex ?? false}
            onChange={(e) => setForm((f) => ({ ...f, noindex: e.target.checked }))}
            className="h-4 w-4 rounded border-input"
          />
          Энэ хуудсыг индексжүүлэхгүй (noindex)
        </label>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Хадгалах
          </button>
          {isSet(selected) && (
            <button
              type="button"
              onClick={reset}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              <RotateCcw size={15} /> Анхдагч руу буцаах
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
