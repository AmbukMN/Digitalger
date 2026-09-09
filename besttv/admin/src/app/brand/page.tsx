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
  const { data, isLoading, isError } = useAdminBrand();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const [siteName, setSiteName] = useState('');
  /** Хэрэглэгч анх орох үеийн өнгөний горим */
  const [defaultTheme, setDefaultTheme] = useState<'dark' | 'light' | 'system'>('dark');
  /** ⚠️ БАРААН горимын лого (хуучин нэр — одоо байгаа лого энд) */
  const [logoKey, setLogoKey] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  /**
   * ⚠️ ГЭРЭЛ горимын лого. Хоосон бол бараан лого хоёуланд
   * хэрэглэгдэнэ — өмнөх зан төлөв ХЭВЭЭР.
   */
  const [logoLightKey, setLogoLightKey] = useState<string | null>(null);
  const [logoLightUrl, setLogoLightUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** ⚠️ Аль лого байршиж байгаа — хоёр талбар тусдаа индикатортай */
  const [uploading, setUploading] = useState<'dark' | 'light' | null>(null);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputLightRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // ⚠️ Дата async ирдэг тул useState-ийн эхний утга хоцордог — ирмэгц дүүргэнэ
  useEffect(() => {
    if (data) {
      setSiteName(data.siteName);
      setDefaultTheme((data as { defaultTheme?: 'dark' | 'light' | 'system' }).defaultTheme ?? 'dark');
      setLogoKey(data.logoKey);
      setLogoUrl(data.logoUrl);
      setLogoLightKey(data.logoLightKey ?? null);
      setLogoLightUrl(data.logoLightUrl ?? null);
    }
  }, [data]);

  /** ⚠️ Хоёр талбарт нэг функц — код давхардуулахгүй */
  const pickLogo = async (file: File, variant: 'dark' | 'light') => {
    setUploading(variant);
    setProgress(0);
    try {
      const h = uploadImage(file, 'brand', setProgress);
      abortRef.current = h.abort;
      const res = await h.promise;
      if (variant === 'dark') {
        setLogoKey(res.key);
        setLogoUrl(res.url);
      } else {
        setLogoLightKey(res.key);
        setLogoLightUrl(res.url);
      }
      toast.info('Лого сонгогдлоо — Хадгалах товчийг дарна уу');
    } catch {
      // toast-ыг helper харуулсан
    } finally {
      abortRef.current = null;
      setUploading(null);
      setProgress(0);
    }
  };

  const removeLogo = async (variant: 'dark' | 'light') => {
    const ok = await confirm({
      title: variant === 'dark' ? 'Бараан логог хасах уу?' : 'Гэрэл логог хасах уу?',
      description:
        variant === 'dark'
          ? 'Лого байхгүй үед сайтын нэр текстээр харагдана.'
          : 'Гэрэл лого байхгүй бол бараан лого хоёр горимд ч хэрэглэгдэнэ.',
      bullets: ['Хадгалсны дараа бүх хуудсанд өөрчлөгдөнө'],
      confirmLabel: 'Хасах',
      tone: 'warning',
    });
    if (!ok) return;
    if (variant === 'dark') {
      setLogoKey(null);
      setLogoUrl(null);
    } else {
      setLogoLightKey(null);
      setLogoLightUrl(null);
    }
  };

  const save = async () => {
    /**
     * ⚠️⚠️ ДАТА ИРЭЭГҮЙ БОЛ ХАДГАЛАХГҮЙ.
     *
     * ⛔ БОДИТ ЭРСДЭЛ (2026-09-09 аудит): API унавал форм анхны
     * (хоосон) утгаараа үлдэнэ. Хадгалбал backend нь `!== undefined`
     * шалгадаг тул `null`/`[]` нь ХҮЧИНТЭЙ утга болж бичигдэнэ —
     * лого салах, сошиал холбоос бүрэн тэглэгдэх эрсдэлтэй.
     *
     * ⚠️ `dirty` нь `data`-аас хамаардаг тул тохиолдлын хамгаалалт
     * болж байсан — тодорхой шалгалт ЗААВАЛ.
     */
    if (isError || !data) {
      toast.error('Тохиргоо ачаалагдаагүй байна — хуудсыг дахин ачаална уу');
      return;
    }
    setSaving(true);
    try {
      await api('/admin/settings/brand', {
        method: 'PUT',
        body: JSON.stringify({ siteName, logoKey, logoLightKey, defaultTheme }),
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
      /* ⚠️ Гэрэл лого сольсныг БАС мэдрэнэ — эс бөгөөс
         «Хадгалах» товч идэвхжэхгүй */
      logoLightKey !== (data.logoLightKey ?? null) ||
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
              {/**
               * ⚠️⚠️ ХОЁР ЛОГО — ЯАГААД ХЭРЭГТЭЙ ВЭ.
               *
               * Лого нь улаан + ЦАГААН бичигтэй тул ГЭРЭЛ горимын
               * цайвар дэвсгэр дээр цагаан хэсэг нь УУСДАГ. Гэрэл
               * горимд бараан бичигтэй хувилбар автоматаар солигдоно.
               *
               * ⚠️ Гэрэл лого хоосон бол бараан лого хоёуланд
               * хэрэглэгдэнэ — өмнөх зан төлөв ХЭВЭЭР.
               *
               * ⚠️ SVG-г ЗӨВШӨӨРӨХГҮЙ: backend-ийн `ALLOWED_IMAGE_TYPES`-д
               * SVG байхгүй тул сонгоход тодорхойгүй алдаа гарна.
               */}
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Хоёр горимд тусдаа лого. Гэрэл логог оруулаагүй бол бараан лого
                хоёуланд нь хэрэглэгдэнэ.
              </p>

              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/webp,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickLogo(f, 'dark');
                  if (inputRef.current) inputRef.current.value = '';
                }}
              />
              <input
                ref={inputLightRef}
                type="file"
                accept="image/png,image/webp,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickLogo(f, 'light');
                  if (inputLightRef.current) inputLightRef.current.value = '';
                }}
              />

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {/* ── БАРААН горим ── */}
                <div>
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Moon size={12} /> Бараан горим
                  </span>
                  {/* ⚠️ Бараан дэвсгэр — лого яг тэр орчинд харагдана */}
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading !== null}
                    className={cn(
                      'flex h-28 w-full items-center justify-center rounded-lg border border-dashed border-input bg-[#0e0f13] px-4 transition-colors hover:border-primary',
                      uploading !== null && 'opacity-60',
                    )}
                  >
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt="Бараан лого"
                        className="max-h-20 w-auto object-contain"
                      />
                    ) : (
                      <span className="flex flex-col items-center gap-1.5 text-white/50">
                        <UploadCloud size={20} />
                        <span className="text-xs">Сонгох</span>
                      </span>
                    )}
                  </button>
                  {uploading === 'dark' && (
                    <UploadProgress
                      className="mt-2"
                      percent={progress}
                      phase={progress >= 100 ? 'processing' : 'uploading'}
                      onCancel={progress < 100 ? () => abortRef.current?.() : undefined}
                    />
                  )}
                  {logoUrl && uploading === null && (
                    <button
                      type="button"
                      onClick={() => removeLogo('dark')}
                      className="mt-1.5 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 size={12} /> Хасах
                    </button>
                  )}
                </div>

                {/* ── ГЭРЭЛ горим ── */}
                <div>
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Sun size={12} /> Гэрэл горим
                  </span>
                  {/* ⚠️ ЦАГААН дэвсгэр — цагаан бичиг уусаж байгаа эсэхийг
                      админ ЭНД ШУУД харна */}
                  <button
                    type="button"
                    onClick={() => inputLightRef.current?.click()}
                    disabled={uploading !== null}
                    className={cn(
                      'flex h-28 w-full items-center justify-center rounded-lg border border-dashed border-input bg-white px-4 transition-colors hover:border-primary',
                      uploading !== null && 'opacity-60',
                    )}
                  >
                    {logoLightUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoLightUrl}
                        alt="Гэрэл лого"
                        className="max-h-20 w-auto object-contain"
                      />
                    ) : logoUrl ? (
                      /* ⚠️ Оруулаагүй бол бараан лого энд ЯАЖ харагдахыг
                         үзүүлнэ — «уусаж байна» гэдгийг админ шууд мэднэ */
                      <span className="flex flex-col items-center gap-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logoUrl}
                          alt=""
                          aria-hidden
                          className="max-h-14 w-auto object-contain"
                        />
                        <span className="text-[10px] text-black/45">
                          Бараан лого хэрэглэгдэнэ
                        </span>
                      </span>
                    ) : (
                      <span className="flex flex-col items-center gap-1.5 text-black/40">
                        <UploadCloud size={20} />
                        <span className="text-xs">Сонгох</span>
                      </span>
                    )}
                  </button>
                  {uploading === 'light' && (
                    <UploadProgress
                      className="mt-2"
                      percent={progress}
                      phase={progress >= 100 ? 'processing' : 'uploading'}
                      onCancel={progress < 100 ? () => abortRef.current?.() : undefined}
                    />
                  )}
                  {logoLightUrl && uploading === null && (
                    <button
                      type="button"
                      onClick={() => removeLogo('light')}
                      className="mt-1.5 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 size={12} /> Хасах
                    </button>
                  )}
                </div>
              </div>

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
                {/**
                 * ⚠️⚠️ ХОЁР ГОРИМЫГ ЗЭРЭГ ХАРУУЛНА.
                 *
                 * Админ панель нь `<html class="dark">` ХАТУУ тул
                 * `brand-logo-*` CSS дүрэм энд ажиллахгүй. Тиймээс
                 * preview-д логоо ГАРААР сонгож, хоёр дэвсгэр дээр
                 * зэрэг үзүүлнэ — админ хадгалахаас ӨМНӨ хоёуланд
                 * зөв харагдаж байгааг батална.
                 *
                 * ⚠️ Гэрэл лого хоосон бол бараан лого fallback —
                 * `BrandLogo`-ийн бодит зан төлөвтэй ЯГ ИЖИЛ.
                 */}
                <PreviewBox label="Сайтын толгой — бараан горим" dark>
                  <BrandLogo logoUrl={logoUrl} siteName={siteName} imgClassName="h-9 w-auto" />
                </PreviewBox>

                <PreviewBox label="Сайтын толгой — гэрэл горим" light>
                  <BrandLogo
                    logoUrl={logoLightUrl ?? logoUrl}
                    siteName={siteName}
                    imgClassName="h-9 w-auto"
                    /* ⚠️ Цагаан дэвсгэр дээр текст fallback ч уншигдана */
                    className={logoLightUrl || logoUrl ? undefined : 'text-black'}
                  />
                </PreviewBox>

                <PreviewBox label="Админ панель (үргэлж бараан)">
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
            disabled={saving || uploading !== null || !dirty}
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
  light,
  children,
}: {
  label: string;
  dark?: boolean;
  /** ⚠️ ЦАГААН дэвсгэр — гэрэл горимын бодит орчин */
  light?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] text-muted-foreground">{label}</p>
      <div
        className={cn(
          'flex h-16 items-center rounded-lg border border-border px-4',
          dark ? 'bg-[#0a0a0a]' : light ? 'bg-white' : 'bg-card',
        )}
      >
        {children}
      </div>
    </div>
  );
}
