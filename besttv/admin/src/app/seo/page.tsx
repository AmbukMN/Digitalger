'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { ImageUpload } from '@/components/image-upload';
import { api } from '@/lib/api';
import { useAdminSeo, type SeoSettings } from '@/lib/queries';

const EMPTY: SeoSettings = {
  siteName: '',
  metaTitle: '',
  metaDescription: '',
  ogImageUrl: null,
  twitterCard: 'summary_large_image',
  noindex: false,
  googleAnalyticsId: '',
  googleTagManagerId: '',
  facebookPixelId: '',
  siteVerification: '',
};

export default function SeoPage() {
  const { data, isLoading } = useAdminSeo();
  const qc = useQueryClient();
  const [form, setForm] = useState<SeoSettings>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await api('/admin/seo', { method: 'PUT', body: JSON.stringify(form) });
      await qc.invalidateQueries({ queryKey: ['admin-seo'] });
      toast.success('SEO тохиргоо хадгалагдлаа');
    } catch {
      toast.error('Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AdminShell>
        <AdminTopbar title="SEO" />
        <main className="flex items-center justify-center p-16 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
        </main>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <AdminTopbar title="SEO" subtitle="Сайтын нүүр meta, Open Graph, аналитик тохиргоо" />

      <main className="grid gap-6 p-8 pt-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Үндсэн тохиргоо">
            <Field label="Сайтын нэр">
              <TextInput value={form.siteName} onChange={(v) => setForm((f) => ({ ...f, siteName: v }))} />
            </Field>
          </Section>

          <Section title="Meta SEO">
            <Field label="Meta Title" hint={`${form.metaTitle.length}/60`}>
              <TextInput value={form.metaTitle} onChange={(v) => setForm((f) => ({ ...f, metaTitle: v }))} />
            </Field>
            <Field label="Meta Description" hint={`${form.metaDescription.length}/160`}>
              <textarea
                value={form.metaDescription}
                onChange={(e) => setForm((f) => ({ ...f, metaDescription: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </Field>
          </Section>

          <Section title="Open Graph / Social">
            <Field label="OG зураг (1200×630 санал болгоно)">
              <div className="w-64">
                <ImageUpload
                  kind="gallery"
                  aspect="backdrop"
                  value={form.ogImageUrl}
                  onChange={(_key, url) => setForm((f) => ({ ...f, ogImageUrl: url }))}
                />
              </div>
            </Field>
            <Field label="Twitter Card төрөл">
              <select
                value={form.twitterCard}
                onChange={(e) => setForm((f) => ({ ...f, twitterCard: e.target.value }))}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="summary_large_image">summary_large_image</option>
                <option value="summary">summary</option>
              </select>
            </Field>
          </Section>

          <Section title="Robots">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.noindex}
                onChange={(e) => setForm((f) => ({ ...f, noindex: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              Хайлтын системд бүү индексжүүл (noindex)
            </label>
          </Section>

          <Section title="Аналитик">
            <Field label="Google Analytics ID (G-XXXXXXX)">
              <TextInput
                value={form.googleAnalyticsId}
                onChange={(v) => setForm((f) => ({ ...f, googleAnalyticsId: v }))}
              />
            </Field>
            <Field label="Google Tag Manager ID (GTM-XXXXXXX)">
              <TextInput
                value={form.googleTagManagerId}
                onChange={(v) => setForm((f) => ({ ...f, googleTagManagerId: v }))}
              />
            </Field>
            <Field label="Facebook Pixel ID">
              <TextInput
                value={form.facebookPixelId}
                onChange={(v) => setForm((f) => ({ ...f, facebookPixelId: v }))}
              />
            </Field>
            <Field label="Google Site Verification">
              <TextInput
                value={form.siteVerification}
                onChange={(v) => setForm((f) => ({ ...f, siteVerification: v }))}
              />
            </Field>
          </Section>

          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-105 disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Хадгалах
          </button>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Social Preview
          </p>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="aspect-video w-full bg-accent/50">
              {form.ogImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.ogImageUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="p-3">
              <p className="truncate text-xs text-muted-foreground">besttv.mn</p>
              <p className="truncate text-sm font-semibold text-foreground">{form.metaTitle || 'Meta title...'}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {form.metaDescription || 'Meta description...'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </AdminShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="admin-card rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {hint && <span className="text-[11px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
    />
  );
}
