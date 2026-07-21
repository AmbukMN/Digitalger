'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import Image from 'next/image';
import { Upload, X, Globe, Mail, Building2, Palette, Check, Monitor, Sun, Moon, Share2, GraduationCap, PenLine } from 'lucide-react';
import {
  FacebookIcon,
  InstagramIcon,
  TwitterXIcon,
  ThreadsIcon,
  TelegramIcon,
  WhatsAppIcon,
  TikTokIcon,
  YouTubeIcon,
  LinkedInIcon,
} from '@/components/social-icons';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  Input,
  Label,
  Loading,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@digitalger/shared/ui';
import { adminApi } from '@/lib/api';
import { uploadWithProgress } from '@/lib/upload-with-progress';
import type { SiteSettings, ThemeSettings } from '@/types/admin';

// ——— Default theme options ——————————————————————————————————
const DEFAULT_THEME_OPTIONS = [
  {
    value: 'system' as const,
    label: 'Системийн тохиргоо',
    desc: 'Хэрэглэгчийн OS-ийн Light/Dark сонголтыг дагана',
    icon: Monitor,
  },
  {
    value: 'light' as const,
    label: 'Цайвар (Light)',
    desc: 'Бүх хэрэглэгчид цайвар горимоор харна',
    icon: Sun,
  },
  {
    value: 'dark' as const,
    label: 'Харанхуй (Dark)',
    desc: 'Бүх хэрэглэгчид харанхуй горимоор харна',
    icon: Moon,
  },
] as const;

// ——— Theme tab ——————————————————————————————————————————————
const THEME_COLORS = [
  { key: 'primaryColor', label: 'Primary өнгө', description: 'Товч, link, тэмдэглэл' },
  { key: 'secondaryColor', label: 'Secondary өнгө', description: 'Дэвсгэр, badge' },
  { key: 'accentColor', label: 'Accent өнгө', description: 'Онцлох элемент' },
] as const;

function ThemeTab({
  theme,
  onSave,
  isSaving,
}: {
  theme: ThemeSettings | null;
  onSave: (colors: Partial<ThemeSettings>) => void;
  isSaving: boolean;
}) {
  const [colors, setColors] = useState({
    primaryColor: theme?.primaryColor ?? '#022179',
    secondaryColor: theme?.secondaryColor ?? '#ffbe00',
    accentColor: theme?.accentColor ?? '#1a5cc8',
  });
  const [defaultTheme, setDefaultTheme] = useState<'system' | 'light' | 'dark'>(
    theme?.defaultTheme ?? 'system',
  );

  useEffect(() => {
    if (theme) {
      setColors({
        primaryColor: theme.primaryColor ?? '#022179',
        secondaryColor: theme.secondaryColor ?? '#ffbe00',
        accentColor: theme.accentColor ?? '#1a5cc8',
      });
      setDefaultTheme(theme.defaultTheme ?? 'system');
    }
  }, [theme]);

  return (
    <div className="space-y-6">
      {/* Default theme selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Анхдагч горим
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Хэрэглэгч тохиргоогоо өөрчлөөгүй үед хэрэглэгдэх default горим.
            Хэрэглэгч өөрийн сонголтыг хадгалсан бол энэ тохиргоо тэдгээрт нөлөөлөхгүй.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {DEFAULT_THEME_OPTIONS.map(({ value, label, desc, icon: Icon }) => {
              const selected = defaultTheme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDefaultTheme(value)}
                  className={`relative flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all ${
                    selected
                      ? 'border-primary bg-muted'
                      : 'border-border hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  {selected && (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </span>
                  )}
                  <Icon
                    className={`h-6 w-6 ${selected ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <div>
                    <p className={`text-sm font-semibold ${selected ? 'text-primary' : ''}`}>
                      {label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <Button
            onClick={() => onSave({ defaultTheme })}
            disabled={isSaving}
            className="mt-4 w-full"
          >
            {isSaving ? (
              'Хадгалж байна...'
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Горим хадгалах
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Color pickers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Өнгөний тохиргоо
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Брэндийн өнгийг өөрчлөх. Сайтын дизайн сэдэвт нөлөөлнө.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {THEME_COLORS.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Label className="text-sm font-medium">{label}</Label>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-full border border-border shadow-inner"
                  style={{ background: colors[key] }}
                />
                <input
                  type="color"
                  value={colors[key]}
                  onChange={(e) =>
                    setColors((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="h-10 w-24 cursor-pointer rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                  title={label}
                />
                <span className="font-mono text-xs text-muted-foreground uppercase tracking-wide">
                  {colors[key]}
                </span>
              </div>
            </div>
          ))}

          <div className="pt-2 border-t">
            <h4 className="text-sm font-medium mb-3">Урьдчилан харах</h4>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md px-4 py-2 text-sm font-medium text-white"
                style={{ background: colors.primaryColor }}
              >
                Primary товч
              </button>
              <button
                className="rounded-md px-4 py-2 text-sm font-medium border"
                style={{
                  background: colors.secondaryColor,
                  color: colors.primaryColor,
                  borderColor: colors.primaryColor + '40',
                }}
              >
                Secondary товч
              </button>
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: colors.accentColor + '20',
                  color: colors.accentColor,
                }}
              >
                Accent badge
              </span>
            </div>
          </div>

          <Button
            onClick={() => onSave(colors)}
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? (
              'Хадгалж байна...'
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Өнгө хадгалах
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ——— General tab ————————————————————————————————————————————
function GeneralTab({
  site,
  onSave,
  isSaving,
}: {
  site: SiteSettings | null;
  onSave: (data: Partial<SiteSettings>) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState({
    siteName: site?.siteName ?? '',
    siteUrl: site?.siteUrl ?? '',
    supportEmail: site?.supportEmail ?? '',
    logoUrl: site?.logoUrl ?? '',
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(site?.logoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (site) {
      setForm({
        siteName: site.siteName ?? '',
        siteUrl: site.siteUrl ?? '',
        supportEmail: site.supportEmail ?? '',
        logoUrl: site.logoUrl ?? '',
      });
      setLogoPreview(site.logoUrl ?? null);
    }
  }, [site]);

  const handleLogoUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Зөвхөн зураг оруулна уу');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Зургийн хэмжээ 5MB-аас бага байх ёстой');
      return;
    }
    setUploading(true);
    try {
      const result = await uploadWithProgress(file);
      setLogoPreview(result.url);
      setForm((prev) => ({ ...prev, logoUrl: result.url }));
      toast.success('Лого амжилттай байршлаа');
    } catch {
      toast.error('Лого байршуулахад алдаа гарлаа');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleLogoUpload(file);
    },
    [handleLogoUpload],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      siteName: form.siteName || undefined,
      siteUrl: form.siteUrl || undefined,
      supportEmail: form.supportEmail || undefined,
      logoUrl: form.logoUrl || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Logo upload */}
      <Card>
        <CardHeader>
          <CardTitle>Сайтын лого</CardTitle>
          <p className="text-sm text-muted-foreground">
            Навбар, нэвтрэх хуудас, хөл хэсэгт харагдана.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-6">
            {/* Preview */}
            <div className="shrink-0">
              <div className="relative h-24 w-24 overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center">
                {logoPreview ? (
                  <>
                    <Image
                      src={logoPreview}
                      alt="Лого"
                      fill
                      className="object-contain p-2"
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setLogoPreview(null);
                        setForm((prev) => ({ ...prev, logoUrl: '' }));
                      }}
                      className="absolute right-1 top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground hover:opacity-90"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Drop zone */}
            <div
              className="flex-1 rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/50 cursor-pointer"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">
                {uploading ? 'Байршуулж байна...' : 'Зураг чирж тавих эсвэл сонгох'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, SVG, WEBP — дээд тал 5MB
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                }}
              />
            </div>
          </div>

          {/* Admin + Frontend харах */}
          {logoPreview && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Харагдах байдал</p>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="relative h-8 w-8 overflow-hidden rounded-lg">
                    <Image src={logoPreview} alt="" fill className="object-contain" unoptimized />
                  </div>
                  <span className="text-sm font-semibold">DigitalGer</span>
                  <span className="text-xs text-muted-foreground">(Навбар)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative h-10 w-10 overflow-hidden rounded-xl">
                    <Image src={logoPreview} alt="" fill className="object-contain" unoptimized />
                  </div>
                  <span className="text-xs text-muted-foreground">(Нэвтрэх хуудас)</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Site info */}
      <Card>
        <CardHeader>
          <CardTitle>Сайтын мэдээлэл</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="siteName">
                <Building2 className="inline h-3.5 w-3.5 mr-1" />
                Сайтын нэр
              </Label>
              <Input
                id="siteName"
                value={form.siteName}
                onChange={(e) => setForm({ ...form, siteName: e.target.value })}
                placeholder="DigitalGer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="siteUrl">
                <Globe className="inline h-3.5 w-3.5 mr-1" />
                Сайтын URL
              </Label>
              <Input
                id="siteUrl"
                value={form.siteUrl}
                onChange={(e) => setForm({ ...form, siteUrl: e.target.value })}
                placeholder="https://digitalger.mn"
                type="url"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                <Mail className="inline h-3.5 w-3.5 mr-1" />
                Дэмжлэгийн и-мэйл
              </Label>
              <Input
                id="email"
                value={form.supportEmail}
                onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
                placeholder="support@digitalger.mn"
                type="email"
              />
            </div>

            <Button type="submit" disabled={isSaving || uploading} className="w-full">
              {isSaving ? (
                'Хадгалж байна...'
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Мэдээлэл хадгалах
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ——— Social tab ——————————————————————————————————————————————
const SOCIAL_FIELDS = [
  { key: 'socialFacebook', label: 'Facebook', placeholder: 'https://facebook.com/digitalger', Icon: FacebookIcon },
  { key: 'socialInstagram', label: 'Instagram', placeholder: 'https://instagram.com/digitalger', Icon: InstagramIcon },
  { key: 'socialTwitter', label: 'Twitter / X', placeholder: 'https://x.com/digitalger', Icon: TwitterXIcon },
  { key: 'socialThreads', label: 'Threads', placeholder: 'https://threads.net/@digitalger', Icon: ThreadsIcon },
  { key: 'socialTelegram', label: 'Telegram', placeholder: 'https://t.me/digitalger', Icon: TelegramIcon },
  { key: 'socialWhatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/97699XXXXXX', Icon: WhatsAppIcon },
  { key: 'socialTiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@digitalger', Icon: TikTokIcon },
  { key: 'socialYoutube', label: 'YouTube', placeholder: 'https://youtube.com/@digitalger', Icon: YouTubeIcon },
  { key: 'socialLinkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/digitalger', Icon: LinkedInIcon },
] as const;

type SocialKey = typeof SOCIAL_FIELDS[number]['key'];

function SocialTab({
  site,
  onSave,
  isSaving,
}: {
  site: SiteSettings | null;
  onSave: (data: Partial<SiteSettings>) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<Record<SocialKey, string>>({
    socialFacebook: site?.socialFacebook ?? '',
    socialInstagram: site?.socialInstagram ?? '',
    socialTwitter: site?.socialTwitter ?? '',
    socialThreads: site?.socialThreads ?? '',
    socialTelegram: site?.socialTelegram ?? '',
    socialWhatsapp: site?.socialWhatsapp ?? '',
    socialTiktok: site?.socialTiktok ?? '',
    socialYoutube: site?.socialYoutube ?? '',
    socialLinkedin: site?.socialLinkedin ?? '',
  });

  useEffect(() => {
    if (site) {
      setForm({
        socialFacebook: site.socialFacebook ?? '',
        socialInstagram: site.socialInstagram ?? '',
        socialTwitter: site.socialTwitter ?? '',
        socialThreads: site.socialThreads ?? '',
        socialTelegram: site.socialTelegram ?? '',
        socialWhatsapp: site.socialWhatsapp ?? '',
        socialTiktok: site.socialTiktok ?? '',
        socialYoutube: site.socialYoutube ?? '',
        socialLinkedin: site.socialLinkedin ?? '',
      });
    }
  }, [site]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Partial<SiteSettings> = {};
    for (const key of Object.keys(form) as SocialKey[]) {
      (data as Record<string, string | null>)[key] = form[key] || null;
    }
    onSave(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Нийгмийн сүлжээ
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Холбоос оруулсан сүлжээнүүд нь footer болон mobile menu-д харагдана.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {SOCIAL_FIELDS.map(({ key, label, placeholder, Icon }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {label}
              </Label>
              <Input
                id={key}
                value={form[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                type="url"
              />
            </div>
          ))}
          <Button type="submit" disabled={isSaving} className="w-full mt-2">
            {isSaving ? (
              'Хадгалж байна...'
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Холбоосууд хадгалах
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ——— Certificate tab —————————————————————————————————————————
function CertificateTab({
  site,
  onSave,
  isSaving,
}: {
  site: SiteSettings | null;
  onSave: (data: Partial<SiteSettings>) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState({
    certSignerName: site?.certSignerName ?? '',
    certSignerTitle: site?.certSignerTitle ?? '',
    certSignatureUrl: site?.certSignatureUrl ?? '',
  });
  const [signaturePreview, setSignaturePreview] = useState<string | null>(
    site?.certSignatureUrl ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (site) {
      setForm({
        certSignerName: site.certSignerName ?? '',
        certSignerTitle: site.certSignerTitle ?? '',
        certSignatureUrl: site.certSignatureUrl ?? '',
      });
      setSignaturePreview(site.certSignatureUrl ?? null);
    }
  }, [site]);

  const handleSignatureUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Зөвхөн зураг оруулна уу');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Зургийн хэмжээ 5MB-аас бага байх ёстой');
      return;
    }
    setUploading(true);
    try {
      const result = await uploadWithProgress(file);
      setSignaturePreview(result.url);
      setForm((prev) => ({ ...prev, certSignatureUrl: result.url }));
      toast.success('Гарын үсэг амжилттай байршлаа');
    } catch {
      toast.error('Гарын үсэг байршуулахад алдаа гарлаа');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleSignatureUpload(file);
    },
    [handleSignatureUpload],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      certSignatureUrl: form.certSignatureUrl || null,
      certSignerName: form.certSignerName || null,
      certSignerTitle: form.certSignerTitle || null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Сертификат
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Энэ гарын үсэг болон нэр/тушаал нь бүх олгогдох сертификат дээр харагдана.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Гарын үсэг зураг upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <PenLine className="h-4 w-4 text-muted-foreground" />
              Гарын үсэг (зураг)
            </Label>
            <div className="flex items-start gap-6">
              {/* Preview — цайвар background дээр гарын үсэг тод харагдана */}
              <div className="shrink-0">
                <div className="relative flex h-24 w-40 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-white">
                  {signaturePreview ? (
                    <>
                      <Image
                        src={signaturePreview}
                        alt="Гарын үсэг"
                        fill
                        className="object-contain p-2"
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSignaturePreview(null);
                          setForm((prev) => ({ ...prev, certSignatureUrl: '' }));
                        }}
                        className="absolute right-1 top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground hover:opacity-90"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <PenLine className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Drop zone */}
              <div
                className="flex-1 cursor-pointer rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {uploading ? 'Байршуулж байна...' : 'Зураг чирж тавих эсвэл сонгох'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Зөвлөмж: ил тод дэвсгэртэй (transparent) PNG — дээд тал 5MB
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSignatureUpload(file);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Гарын үсэг зурах хүний нэр */}
          <div className="space-y-2">
            <Label htmlFor="certSignerName">Гарын үсэг зурах хүний нэр</Label>
            <Input
              id="certSignerName"
              value={form.certSignerName}
              onChange={(e) => setForm({ ...form, certSignerName: e.target.value })}
              placeholder="Б. Амгаланбаяр"
            />
          </div>

          {/* Албан тушаал */}
          <div className="space-y-2">
            <Label htmlFor="certSignerTitle">Албан тушаал</Label>
            <Input
              id="certSignerTitle"
              value={form.certSignerTitle}
              onChange={(e) => setForm({ ...form, certSignerTitle: e.target.value })}
              placeholder="Гүйцэтгэх захирал"
            />
          </div>

          <Button type="submit" disabled={isSaving || uploading} className="w-full">
            {isSaving ? (
              'Хадгалж байна...'
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Сертификат хадгалах
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ——— Main page ———————————————————————————————————————————————
export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminApi.settings.get(),
  });

  const themeMutation = useMutation({
    mutationFn: (body: Partial<ThemeSettings>) => adminApi.settings.updateTheme(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      toast.success('Өнгөний тохиргоо хадгалагдлаа');
    },
    onError: () => toast.error('Хадгалахад алдаа гарлаа'),
  });

  const siteMutation = useMutation({
    mutationFn: (body: Partial<SiteSettings>) => adminApi.settings.updateSite(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      toast.success('Сайтын мэдээлэл хадгалагдлаа');
    },
    onError: () => toast.error('Хадгалахад алдаа гарлаа'),
  });

  if (isLoading) return <Loading label="Тохиргоо ачаалж байна..." />;
  if (isError)
    return <ErrorState title="Тохиргоо ачаалахад алдаа гарлаа" onRetry={() => refetch()} />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl tracking-tight">Тохиргоо</h1>
        <p className="text-muted-foreground">Сайтын ерөнхий болон дизайн тохиргоо</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="w-full">
          <TabsTrigger value="general" className="flex-1">
            <Building2 className="mr-2 h-4 w-4" />
            Ерөнхий
          </TabsTrigger>
          <TabsTrigger value="theme" className="flex-1">
            <Palette className="mr-2 h-4 w-4" />
            Дизайн
          </TabsTrigger>
          <TabsTrigger value="social" className="flex-1">
            <Share2 className="mr-2 h-4 w-4" />
            Нийгмийн сүлжээ
          </TabsTrigger>
          <TabsTrigger value="certificate" className="flex-1">
            <GraduationCap className="mr-2 h-4 w-4" />
            Сертификат
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <GeneralTab
            site={data?.site ?? null}
            onSave={(body) => siteMutation.mutate(body)}
            isSaving={siteMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="theme" className="mt-6">
          <ThemeTab
            theme={data?.theme ?? null}
            onSave={(colors) => themeMutation.mutate(colors)}
            isSaving={themeMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="social" className="mt-6">
          <SocialTab
            site={data?.site ?? null}
            onSave={(body) => siteMutation.mutate(body)}
            isSaving={siteMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="certificate" className="mt-6">
          <CertificateTab
            site={data?.site ?? null}
            onSave={(body) => siteMutation.mutate(body)}
            isSaving={siteMutation.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
