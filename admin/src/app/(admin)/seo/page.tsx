'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorState,
  Input,
  Label,
  Loading,
  Separator,
} from '@digitalger/shared/ui';
import {
  BarChart2,
  ChevronDown,
  ChevronUp,
  Globe,
  Image as ImageIcon,
  Map,
  Search,
  Settings,
  Share2,
  Upload,
  X,
} from 'lucide-react';
import { cn } from '@digitalger/shared';
import { adminApi } from '@/lib/api';
import { uploadWithProgress } from '@/lib/upload-with-progress';
import type { SiteSettings } from '@/types/admin';

function Textarea({
  id,
  rows = 3,
  placeholder,
  value,
  onChange,
}: {
  id?: string;
  rows?: number;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <textarea
      id={id}
      rows={rows}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="flex min-h-15 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
    />
  );
}

function Switch({
  id,
  checked,
  onCheckedChange,
}: {
  id?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        checked ? 'bg-primary' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

type FormState = {
  // Үндсэн
  siteName: string;
  siteUrl: string;
  supportEmail: string;
  logoUrl: string;
  // Meta SEO
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  // Open Graph
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  twitterCardType: string;
  // Robots / Canonical
  robotsNoIndex: boolean;
  robotsNoFollow: boolean;
  canonicalUrl: string;
  // Analytics
  googleAnalyticsId: string;
  googleTagManagerId: string;
  fbPixelId: string;
  googleSiteVerification: string;
  naverSiteVerification: string;
  // Sitemap
  sitemapEnabled: boolean;
  sitemapChangeFreq: string;
  sitemapPriority: string;
};

const DEFAULT_FORM: FormState = {
  siteName: '',
  siteUrl: '',
  supportEmail: '',
  logoUrl: '',
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  ogTitle: '',
  ogDescription: '',
  ogImageUrl: '',
  twitterCardType: 'summary_large_image',
  robotsNoIndex: false,
  robotsNoFollow: false,
  canonicalUrl: '',
  googleAnalyticsId: '',
  googleTagManagerId: '',
  fbPixelId: '',
  googleSiteVerification: '',
  naverSiteVerification: '',
  sitemapEnabled: true,
  sitemapChangeFreq: 'weekly',
  sitemapPriority: '0.8',
};

function siteToForm(site: SiteSettings): FormState {
  return {
    siteName: site.siteName ?? '',
    siteUrl: site.siteUrl ?? '',
    supportEmail: site.supportEmail ?? '',
    logoUrl: site.logoUrl ?? '',
    metaTitle: site.metaTitle ?? '',
    metaDescription: site.metaDescription ?? '',
    metaKeywords: site.metaKeywords ?? '',
    ogTitle: site.ogTitle ?? '',
    ogDescription: site.ogDescription ?? '',
    ogImageUrl: site.ogImageUrl ?? '',
    twitterCardType: site.twitterCardType ?? 'summary_large_image',
    robotsNoIndex: site.robotsNoIndex ?? false,
    robotsNoFollow: site.robotsNoFollow ?? false,
    canonicalUrl: site.canonicalUrl ?? '',
    googleAnalyticsId: site.googleAnalyticsId ?? '',
    googleTagManagerId: site.googleTagManagerId ?? '',
    fbPixelId: site.fbPixelId ?? '',
    googleSiteVerification: site.googleSiteVerification ?? '',
    naverSiteVerification: site.naverSiteVerification ?? '',
    sitemapEnabled: site.sitemapEnabled ?? true,
    sitemapChangeFreq: site.sitemapChangeFreq ?? 'weekly',
    sitemapPriority: site.sitemapPriority ?? '0.8',
  };
}

function Section({
  icon: Icon,
  title,
  description,
  children,
  defaultOpen = true,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              {description && (
                <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
              )}
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
      </CardHeader>
      {open && (
        <>
          <Separator />
          <CardContent className="pt-5">{children}</CardContent>
        </>
      )}
    </Card>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function SeoPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [ogUploading, setOgUploading] = useState(false);

  const f = (key: keyof FormState) => ({
    id: key,
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminApi.settings.get(),
  });

  useEffect(() => {
    if (data?.site) setForm(siteToForm(data.site));
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => adminApi.settings.updateSite(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      toast.success('SEO тохиргоо хадгалагдлаа');
    },
    onError: () => toast.error('Хадгалахад алдаа гарлаа'),
  });

  if (isLoading) return <Loading label="SEO тохиргоо..." />;
  if (isError) return <ErrorState title="Ачаалахад алдаа" onRetry={() => refetch()} />;

  return (
    <form
      className="space-y-5 max-w-2xl"
      onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SEO & Тохиргоо</h1>
          <p className="text-sm text-muted-foreground">Сайтын мета тэг, analytics, sitemap тохируулах</p>
        </div>
        <Button type="submit" disabled={mutation.isPending} className="shrink-0">
          {mutation.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
        </Button>
      </div>

      {/* Үндсэн тохиргоо */}
      <Section icon={Settings} title="Үндсэн тохиргоо" description="Сайтын нэр, URL, лого">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="siteName" label="Сайтын нэр">
              <Input placeholder="DigitalGer" {...f('siteName')} />
            </Field>
            <Field id="supportEmail" label="Дэмжлэгийн и-мэйл">
              <Input type="email" placeholder="support@digitalger.mn" {...f('supportEmail')} />
            </Field>
          </div>
          <Field id="siteUrl" label="Сайтын URL" hint="Trailing slash-гүй байх ёстой: https://digitalger.mn">
            <Input placeholder="https://digitalger.mn" {...f('siteUrl')} />
          </Field>
          <Field id="logoUrl" label="Лого URL" hint="R2 эсвэл CDN холбоос">
            <Input placeholder="https://cdn.digitalger.mn/logo.svg" {...f('logoUrl')} />
          </Field>
        </div>
      </Section>

      {/* Meta SEO */}
      <Section icon={Search} title="Meta SEO" description="<title> болон <meta description> тэгүүд">
        <div className="grid gap-4">
          <Field id="metaTitle" label="Meta title" hint="Хэрэв хоосон бол сайтын нэрийг ашиглана. Зөвлөсөн: 50–60 тэмдэгт">
            <Input placeholder="DigitalGer — Монголын дижитал marketplace" {...f('metaTitle')} />
            <p className="text-[11px] text-muted-foreground text-right tabular-nums">
              {form.metaTitle.length} / 60
            </p>
          </Field>
          <Field id="metaDescription" label="Meta description" hint="Зөвлөсөн: 120–160 тэмдэгт">
            <Textarea
              id="metaDescription"
              rows={3}
              placeholder="Дижитал файл, загвар, курс, баримт зэрэг бүтээгдэхүүн худалдаж авах Монголын marketplace."
              value={form.metaDescription}
              onChange={(e) => setForm((p) => ({ ...p, metaDescription: e.target.value }))}
            />
            <p className="text-[11px] text-muted-foreground text-right tabular-nums">
              {form.metaDescription.length} / 160
            </p>
          </Field>
          <Field id="metaKeywords" label="Түлхүүр үгс" hint="Таслалаар тусгаарлана. Жишээ: дижитал бүтээгдэхүүн, загвар, курс">
            <Input placeholder="дижитал бүтээгдэхүүн, загвар, курс, файл" {...f('metaKeywords')} />
          </Field>
        </div>
      </Section>

      {/* Open Graph / Twitter */}
      <Section icon={Share2} title="Open Graph / Social" description="Facebook, Twitter, Telegram зэрэгт харагдах preview">
        <div className="grid gap-4">
          <Field id="ogTitle" label="OG Title" hint="Хэрэв хоосон бол Meta title ашиглана">
            <Input placeholder="DigitalGer — Монголын дижитал marketplace" {...f('ogTitle')} />
          </Field>
          <Field id="ogDescription" label="OG Description">
            <Textarea
              id="ogDescription"
              rows={2}
              placeholder="Дижитал бүтээгдэхүүн худалдаж авах тохиромжтой газар."
              value={form.ogDescription}
              onChange={(e) => setForm((p) => ({ ...p, ogDescription: e.target.value }))}
            />
          </Field>
          <Field id="ogImageUrl" label="OG Image" hint="Зөвлөмж: 1200×630px, PNG эсвэл JPG">
            {form.ogImageUrl ? (
              <div className="relative overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.ogImageUrl} alt="OG preview" className="max-h-48 w-full object-cover" referrerPolicy="no-referrer" />
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, ogImageUrl: '' }))}
                  className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className={cn(
                'flex flex-col items-center justify-center gap-2 h-36 w-full rounded-lg border-2 border-dashed border-border cursor-pointer transition-colors',
                ogUploading ? 'opacity-60 cursor-wait' : 'hover:border-primary/50 hover:bg-muted/30',
              )}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={ogUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setOgUploading(true);
                    try {
                      const result = await uploadWithProgress(file);
                      setForm((p) => ({ ...p, ogImageUrl: result.url }));
                    } catch {
                      toast.error('Зураг upload хийхэд алдаа гарлаа');
                    } finally {
                      setOgUploading(false);
                    }
                  }}
                />
                {ogUploading ? (
                  <span className="text-sm text-muted-foreground">Байршуулж байна...</span>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Зургаа энд дарж upload хийнэ</span>
                    <span className="text-xs text-muted-foreground/60">PNG, JPG, WEBP · 1200×630px</span>
                  </>
                )}
              </label>
            )}
          </Field>
          <Field id="twitterCardType" label="Twitter Card төрөл">
            <select
              id="twitterCardType"
              value={form.twitterCardType}
              onChange={(e) => setForm((p) => ({ ...p, twitterCardType: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="summary">summary — жижиг зураг</option>
              <option value="summary_large_image">summary_large_image — том зураг</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* Robots & Canonical */}
      <Section icon={Globe} title="Robots & Canonical" description="Хайлтын систем хэрхэн crawl хийхийг тохируулах" defaultOpen={false}>
        <div className="grid gap-5">
          <div className="flex items-start gap-4 rounded-lg border border-border p-4 bg-muted/30">
            <Switch
              id="robotsNoIndex"
              checked={form.robotsNoIndex}
              onCheckedChange={(v) => setForm((p) => ({ ...p, robotsNoIndex: v }))}
            />
            <div>
              <Label htmlFor="robotsNoIndex" className="font-medium cursor-pointer">noindex</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Хайлтын системд индекслэгдэхгүй болно (тест/dev орчинд ашигла)</p>
            </div>
          </div>
          <div className="flex items-start gap-4 rounded-lg border border-border p-4 bg-muted/30">
            <Switch
              id="robotsNoFollow"
              checked={form.robotsNoFollow}
              onCheckedChange={(v) => setForm((p) => ({ ...p, robotsNoFollow: v }))}
            />
            <div>
              <Label htmlFor="robotsNoFollow" className="font-medium cursor-pointer">nofollow</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Хуудасны линкүүдийг дагахгүй болно</p>
            </div>
          </div>
          <Field id="canonicalUrl" label="Canonical URL" hint="Хэрэв хоосон бол siteUrl ашиглана">
            <Input placeholder="https://digitalger.mn" {...f('canonicalUrl')} />
          </Field>
        </div>
      </Section>

      {/* Analytics */}
      <Section icon={BarChart2} title="Analytics & Tracking" description="Google Analytics, GTM, Facebook Pixel тохируулах" defaultOpen={false}>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="googleAnalyticsId" label="Google Analytics ID" hint="Жишээ: G-XXXXXXXXXX">
              <Input placeholder="G-XXXXXXXXXX" {...f('googleAnalyticsId')} />
            </Field>
            <Field id="googleTagManagerId" label="Google Tag Manager ID" hint="Жишээ: GTM-XXXXXXX">
              <Input placeholder="GTM-XXXXXXX" {...f('googleTagManagerId')} />
            </Field>
          </div>
          <Field id="fbPixelId" label="Facebook Pixel ID" hint="Meta Ads Manager-аас авна">
            <Input placeholder="123456789012345" {...f('fbPixelId')} />
          </Field>
          <Separator />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Сайт баталгаажуулалт</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="googleSiteVerification" label="Google Site Verification" hint="<meta name='google-site-verification'> утга">
              <Input placeholder="xxxxxxxxxxxxxxxxxxxxx" {...f('googleSiteVerification')} />
            </Field>
            <Field id="naverSiteVerification" label="Naver Site Verification">
              <Input placeholder="xxxxxxxxxxxxxxxxxxxxx" {...f('naverSiteVerification')} />
            </Field>
          </div>
        </div>
      </Section>

      {/* Sitemap */}
      <Section icon={Map} title="Sitemap" description="robots.txt болон sitemap.xml тохиргоо" defaultOpen={false}>
        <div className="grid gap-5">
          <div className="flex items-start gap-4 rounded-lg border border-border p-4 bg-muted/30">
            <Switch
              id="sitemapEnabled"
              checked={form.sitemapEnabled}
              onCheckedChange={(v) => setForm((p) => ({ ...p, sitemapEnabled: v }))}
            />
            <div>
              <Label htmlFor="sitemapEnabled" className="font-medium cursor-pointer">Sitemap идэвхтэй</Label>
              <p className="text-xs text-muted-foreground mt-0.5">/sitemap.xml хуудас хайлтын системд нээлттэй байна</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="sitemapChangeFreq" label="Шинэчлэлтийн давтамж">
              <select
                id="sitemapChangeFreq"
                value={form.sitemapChangeFreq}
                onChange={(e) => setForm((p) => ({ ...p, sitemapChangeFreq: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="always">always</option>
                <option value="hourly">hourly</option>
                <option value="daily">daily</option>
                <option value="weekly">weekly</option>
                <option value="monthly">monthly</option>
                <option value="yearly">yearly</option>
                <option value="never">never</option>
              </select>
            </Field>
            <Field id="sitemapPriority" label="Приоритет" hint="0.0 – 1.0 утга">
              <select
                id="sitemapPriority"
                value={form.sitemapPriority}
                onChange={(e) => setForm((p) => ({ ...p, sitemapPriority: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {['1.0', '0.9', '0.8', '0.7', '0.6', '0.5', '0.4', '0.3', '0.2', '0.1', '0.0'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </Section>

      {/* OG Image preview card */}
      {(form.metaTitle || form.metaDescription || form.ogImageUrl) && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              Social preview
            </CardTitle>
            <CardDescription className="text-xs">Google болон нийгмийн сүлжээнд ийн байдлаар харагдана</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border border-border bg-card max-w-sm shadow-sm">
              {form.ogImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.ogImageUrl} alt="OG" className="w-full aspect-video object-cover" referrerPolicy="no-referrer" />
              )}
              <div className="px-3 py-2.5">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">
                  {form.siteUrl ? new URL(form.siteUrl.startsWith('http') ? form.siteUrl : `https://${form.siteUrl}`).hostname : 'digitalger.mn'}
                </p>
                <p className="text-sm font-semibold leading-snug mt-0.5 line-clamp-2">
                  {form.ogTitle || form.metaTitle || form.siteName || 'DigitalGer'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {form.ogDescription || form.metaDescription}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end pb-6">
        <Button type="submit" disabled={mutation.isPending} size="lg">
          {mutation.isPending ? 'Хадгалж байна...' : 'Тохиргоо хадгалах'}
        </Button>
      </div>
    </form>
  );
}
