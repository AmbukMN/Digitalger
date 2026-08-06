'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, Loader2, Monitor, Moon, Save, Sun, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { BrandLogo, useConfirm } from '@besttv/shared/ui';
import { AdminShell } from '@/components/admin-shell';
import { AdminTopbar } from '@/components/admin-topbar';
import { UploadProgress } from '@/components/upload-progress';
import { api } from '@/lib/api';
import { uploadImage } from '@/lib/upload';
import { useAdminBrand } from '@/lib/queries';
import { SocialsSettings } from '@/components/socials-settings';
import { RentSettingsCard } from '@/components/rent-settings-card';

/** Тохиргооны табууд — шинэ хэсэг нэмэхэд энд л нэмнэ */
const TABS = [
  { id: 'brand', label: 'Брэнд / Лого' },
  { id: 'socials', label: 'Сошиал холбоос' },
  { id: 'rent', label: 'Түрээс' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('brand');
  const { data, isLoading } = useAdminBrand();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const [siteName, setSiteName] = useState('');
  /** Хэрэглэгч анх орох үеийн өнгөний горим */
  const [defaultTheme, setDefaultTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [logoKey, setLogoKey] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // ⚠️ Дата async ирдэг тул useState-ийн эхний утга хоцордог — ирмэгц дүүргэнэ
  useEffect(() => {
    if (data) {
      setSiteName(data.siteName);
      setDefaultTheme((data as { defaultTheme?: 'dark' | 'light' | 'system' }).defaultTheme ?? 'dark');
      setLogoKey(data.logoKey);
      setLogoUrl(data.logoUrl);
    }
  }, [data]);

  const pickLogo = async (file: File) => {
    setUploading(true);
    setProgress(0);
    try {
      const h = uploadImage(file, 'brand', setProgress);
      abortRef.current = h.abort;
      const res = await h.promise;
      setLogoKey(res.key);
      setLogoUrl(res.url);
      toast.info('Лого сонгогдлоо — Хадгалах товчийг дарна уу');
    } catch {
      // toast-ыг helper харуулсан
    } finally {
      abortRef.current = null;
      setUploading(false);
      setProgress(0);
    }
  };

  const removeLogo = async () => {
    const ok = await confirm({
      title: 'Логог хасах уу?',
      description: 'Лого байхгүй үед сайтын нэр текстээр харагдана.',
      bullets: ['Хадгалсны дараа бүх хуудсанд өөрчлөгдөнө'],
      confirmLabel: 'Хасах',
      tone: 'warning',
    });
    if (!ok) return;
    setLogoKey(null);
    setLogoUrl(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api('/admin/settings/brand', {
        method: 'PUT',
        body: JSON.stringify({ siteName, logoKey, defaultTheme }),
      });
      // Бүх хуудасны лого шинэчлэгдэнэ
      await qc.invalidateQueries({ queryKey: ['admin-brand'] });
      await qc.invalidateQueries({ queryKey: ['brand'] });
      toast.success('Брэнд хадгалагдлаа — бүх хуудсанд шинэчлэгдэнэ');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Хадгалж чадсангүй');
    } finally {
      setSaving(false);
    }
  };

  const dirty = data
    ? siteName !== data.siteName ||
      logoKey !== data.logoKey ||
      defaultTheme !== ((data as { defaultTheme?: string }).defaultTheme ?? 'dark')
    : false;

  return (
    <AdminShell>
      <AdminTopbar title="Тохиргоо" subtitle="Брэнд, сошиал холбоос, түрээс" />

      <main className="p-4 pt-5 sm:p-8 sm:pt-6">
        {/* Табууд — цаашид шинэ ерөнхий тохиргоо нэмэхэд энд залгана */}
        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                tab === t.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'socials' && <SocialsSettings />}
        {tab === 'rent' && <RentSettingsCard />}

        <div className={cn(tab !== 'brand' && 'hidden')}>
        <div className="mb-5 rounded-lg border border-primary/25 bg-primary/8 p-3 text-xs text-muted-foreground">
          Энд байршуулсан лого нь <strong className="text-foreground">бүх хуудсанд</strong>{' '}
          харагдана — сайтын толгой, хөл, нэвтрэх хуудас, админ панель.
          <br />
          Санал болгох хэмжээ: өргөн 400-600px, өндөр 150-200px, тунгалаг дэвсгэртэй PNG.
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <div className="grid max-w-4xl gap-5 lg:grid-cols-2">
            {/* ── Лого ── */}
            <div className="admin-card rounded-xl p-5">
              <p className="text-sm font-semibold text-foreground">Лого</p>

              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickLogo(f);
                  if (inputRef.current) inputRef.current.value = '';
                }}
              />

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className={cn(
                  'mt-3 flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-input bg-accent/20 px-4 transition-colors hover:border-primary',
                  uploading && 'opacity-60',
                )}
              >
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Лого" className="max-h-24 w-auto object-contain" />
                ) : (
                  <span className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <UploadCloud size={22} />
                    <span className="text-xs">Лого сонгох (PNG/SVG/WebP)</span>
                  </span>
                )}
              </button>

              {uploading && (
                <UploadProgress
                  className="mt-2"
                  percent={progress}
                  phase={progress >= 100 ? 'processing' : 'uploading'}
                  onCancel={progress < 100 ? () => abortRef.current?.() : undefined}
                />
              )}

              {logoUrl && !uploading && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="mt-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                >
                  <Trash2 size={12} /> Логог хасах
                </button>
              )}

              <label className="mt-5 block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Сайтын нэр
                </span>
                <input
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="BestTV"
                  maxLength={60}
                  aria-label="Сайтын нэр"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Лого байхгүй үед энэ нэр текстээр харагдана
                </span>
              </label>

              {/*
                ⚠️ АНХДАГЧ ӨНГӨНИЙ ГОРИМ — сайтад АНХ орсон хүнд юу
                харагдахыг заана. Сонголт хийсэн хэрэглэгчийн тохиргоо
                ДАВАМГАЙЛНА (энэ утга түүнийг дарж бичихгүй).
              */}
              <div className="mt-5">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Анхдагч өнгөний горим
                </span>
                <div className="flex gap-2">
                  {([
                    { v: 'dark' as const, label: 'Бараан', icon: Moon },
                    { v: 'light' as const, label: 'Гэрэл', icon: Sun },
                    { v: 'system' as const, label: 'Системийн дагуу', icon: Monitor },
                  ]).map(({ v, label, icon: Icon }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setDefaultTheme(v)}
                      aria-pressed={defaultTheme === v}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-colors',
                        defaultTheme === v
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-input text-muted-foreground hover:bg-accent',
                      )}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Сайтад анх орсон хүнд харагдах горим. Хэрэглэгч өөрөө
                  сольсон бол түүний сонголт хадгалагдана.
                </span>
              </div>
            </div>

            {/* ── Урьдчилан харах ── */}
            <div className="admin-card rounded-xl p-5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <ImageIcon size={14} /> Урьдчилан харах
              </p>

              <div className="mt-3 space-y-3">
                <PreviewBox label="Сайтын толгой (хар дэвсгэр)" dark>
                  <BrandLogo logoUrl={logoUrl} siteName={siteName} imgClassName="h-9 w-auto" />
                </PreviewBox>

                <PreviewBox label="Админ панель (цайвар/бараан)">
                  <div className="flex items-center gap-2">
                    <BrandLogo logoUrl={logoUrl} siteName={siteName} imgClassName="h-8 w-auto" />
                    <span className="text-sm text-muted-foreground">Admin</span>
                  </div>
                </PreviewBox>

                <PreviewBox label="Нэвтрэх хуудас" dark>
                  <BrandLogo
                    logoUrl={logoUrl}
                    siteName={siteName}
                    imgClassName="h-11 w-auto"
                    textSize="text-3xl"
                  />
                </PreviewBox>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || uploading || !dirty}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
          </button>
          {dirty && !saving && (
            <span className="text-xs text-premium">Хадгалаагүй өөрчлөлт байна</span>
          )}
        </div>
        </div>
      </main>
    </AdminShell>
  );
}

function PreviewBox({
  label,
  dark,
  children,
}: {
  label: string;
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] text-muted-foreground">{label}</p>
      <div
        className={cn(
          'flex h-16 items-center rounded-lg border border-border px-4',
          dark ? 'bg-[#0a0a0a]' : 'bg-card',
        )}
      >
        {children}
      </div>
    </div>
  );
}
