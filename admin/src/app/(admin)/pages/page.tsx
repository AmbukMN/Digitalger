'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type ChangeEvent } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Save, Upload, X, ImageIcon } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
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
import { RichEditor } from '@/components/ui/rich-editor';
import { TagInput } from '@/components/ui/tag-input';

const PRIVACY_DEFAULT = `<h2>1. Мэдээлэл цуглуулах</h2>
<p>DigitalGer нь үйлчилгээгээ үзүүлэхийн тулд дараах мэдээллийг цуглуулна: нэр, и-мэйл хаяг, утасны дугаар, төлбөрийн мэдээлэл.</p>

<h2>2. Мэдээлэл ашиглах</h2>
<p>Цуглуулсан мэдээллийг дараах зорилгоор ашиглана: захиалга биелүүлэх, хэрэглэгчтэй холбоо барих, үйлчилгээ сайжруулах, хуулийн шаардлага биелүүлэх.</p>

<h2>3. Мэдээлэл хамгаалах</h2>
<p>Бид таны хувийн мэдээллийг хамгаалахын тулд стандарт шифрлэлт болон аюулгүй байдлын арга хэмжээ авч ажиллана. Гуравдагч талд таны мэдээллийг борлуулахгүй.</p>

<h2>4. Күүки ашиглах</h2>
<p>Вэб сайт дээр хэрэглэгчийн туршлагыг сайжруулахын тулд күүки технологи ашигладаг. Та хөтөчийнхөө тохиргооноос күүкийг хаах боломжтой.</p>

<h2>5. Гуравдагч талын холбоосууд</h2>
<p>Манай вэб сайт гуравдагч талын вэб сайтруу чиглүүлэх холбоосыг агуулж болно. Тэдгээр вэб сайтуудын нууцлалын бодлогод хариуцлага хүлээхгүй.</p>

<h2>6. Холбоо барих</h2>
<p>Нууцлалын бодлоготой холбоотой асуулт байвал info@digitalger.mn хаягаар холбоо барина уу.</p>`;

const TERMS_DEFAULT = `<h2>1. Ерөнхий нөхцөл</h2>
<p>DigitalGer платформыг ашигласнаар та эдгээр үйлчилгээний нөхцөлийг хүлээн зөвшөөрч байна. Нөхцөлийг хүлээн зөвшөөрөхгүй бол платформыг ашиглахгүй байхыг хүсье.</p>

<h2>2. Бүртгэл ба аюулгүй байдал</h2>
<p>Та бүртгэлийн мэдээллээ нууцлан хадгалах үүрэгтэй. Бүртгэлийнхээ аюулгүй байдлыг хангах хариуцлагыг та бүрэн хүлээнэ. Зөвшөөрөлгүй ашиглалт илэрвэл нэн даруй мэдэгдэнэ үү.</p>

<h2>3. Оюуны өмч</h2>
<p>DigitalGer дээр байрлуулсан бүх контент (зураг, текст, видео, файл) нь оюуны өмчийн хуулиар хамгаалагдсан бөгөөд худалдаж авсан бүтээгдэхүүнийг зөвхөн хувийн хэрэгцээнд ашиглана.</p>

<h2>4. Буцаалт ба төлбөр</h2>
<p>Дижитал бүтээгдэхүүн нь худалдан авсны дараа буцаалт хийх боломжгүй. Техникийн асуудал үүссэн тохиолдолд 72 цагийн дотор холбоо барьж шийдвэрлүүлэх боломжтой.</p>

<h2>5. Хориглох зүйлс</h2>
<p>Платформ дээр худалдан авсан бүтээгдэхүүнийг дахин зарах, хуваалцах, нийтийн сүлжээнд байршуулах хатуу хориглоно. Зөрчил илэрвэл бүртгэлийг цуцлах эрхтэй.</p>

<h2>6. Нөхцөл өөрчлөх</h2>
<p>DigitalGer нь үйлчилгээний нөхцөлийг урьдчилан мэдэгдэлгүйгээр өөрчлөх эрхтэй. Өөрчлөлтийн дараа платформыг үргэлжлүүлэн ашигласан нь шинэ нөхцөлийг хүлээн зөвшөөрсөн гэж үзнэ.</p>`;

const ABOUT_DEFAULT = `<h2>DigitalGer-ийн тухай</h2>
<p>DigitalGer нь Монголын хамгийн том дижитал бүтээгдэхүүний зах зээл бөгөөд 2023 онд үүсгэн байгуулагдсан. Бид дижитал файл, загвар, хичээл болон бусад бүтээгдэхүүнийг нэг дороос татаж авах боломжийг олгодог.</p>

<h2>Манай зорилго</h2>
<p>Монгол хэрэглэгчдэд чанартай дижитал контентийг хялбар, аюулгүй байдлаар хүргэх замаар дижитал эдийн засгийг хөгжүүлэхэд хувь нэмэр оруулах.</p>

<h2>Бидний баг</h2>
<p>Бид дижитал хөгжлийг дэмжигч залуу баг бөгөөд Монголын контент бүтээгчдийг дэмжин, тэдний бүтээгдэхүүнийг дэлхийн зах зээлд гаргахад туслана.</p>

<h2>Холбоо барих</h2>
<p>И-мэйл: info@digitalger.mn<br/>Утас: +976 9999-0000</p>`;

const DATA_DELETION_DEFAULT = `<h2>Мэдээлэл устгах хүсэлт</h2>
<p>DigitalGer нь Facebook Login болон бусад OAuth үйлчилгээгээр дамжуулан нэвтрэх боломжийг олгодог. Та бүртгэлээ болон хувийн мэдээллээ бүрэн устгуулахыг хүсвэл доорх заавраар хүсэлт илгээнэ үү.</p>

<h2>Ямар мэдээлэл хадгалагддаг вэ?</h2>
<ul>
  <li>И-мэйл хаяг</li>
  <li>Нэр (Facebook-с авсан нийтийн нэр)</li>
  <li>Захиалга болон худалдан авалтын түүх</li>
  <li>Татаж авалтын бүртгэл</li>
  <li>Хадгалсан бүтээгдэхүүн (Wishlist)</li>
</ul>

<h2>Мэдээлэл устгах хүсэлт илгээх</h2>
<p>Та дараах хоёр аргаар мэдээлэл устгах хүсэлт илгээж болно:</p>
<ol>
  <li><strong>И-мэйлээр:</strong> <a href="mailto:info@digitalger.mn">info@digitalger.mn</a> хаягаар "Мэдээлэл устгах хүсэлт" гарчигтай и-мэйл илгээнэ үү. И-мэйл дотор бүртгэлтэй и-мэйл хаягаа заавал дурдана уу.</li>
  <li><strong>Профайл хуудсаар:</strong> Нэвтэрч <a href="/profile">Профайл</a> хуудас руу орж "Бүртгэл устгах" хэсгээс хүсэлт илгээнэ үү.</li>
</ol>

<h2>Устгах хугацаа</h2>
<p>Хүсэлт хүлээн авсны дараа <strong>30 хоногийн дотор</strong> таны бүх хувийн мэдээлэл манай системээс бүрэн устгагдана. Устгасан тухай и-мэйл мэдэгдэл хүлээн авах болно.</p>

<h2>Анхаарах зүйл</h2>
<p>Мэдээлэл устгагдсаны дараа худалдан авалтын түүх болон татаж авалтын эрх <strong>сэргээгдэхгүй</strong> тул болгоомжтой байна уу. Санхүүгийн бүртгэлтэй холбоотой мэдээллийг хуулийн шаардлагын дагуу тодорхой хугацаанд хадгалах боломжтой.</p>

<h2>Холбоо барих</h2>
<p>Асуулт байвал <a href="mailto:info@digitalger.mn">info@digitalger.mn</a> хаягаар эсвэл <a href="/privacy-policy">Нууцлалын бодлого</a> хуудсыг үзнэ үү.</p>`;

const CONTACT_DEFAULT = `<h2>Бидэнтэй холбоо барих</h2>
<p>Асуулт, санал хүсэлт, техникийн дэмжлэг хэрэгтэй бол доорх мэдээллээр бидэнтэй холбогдоорой. Бид ажлын цагаар хариу өгөхийг хичээнэ.</p>

<h2>Холбоо барих мэдээлэл</h2>
<ul>
  <li><strong>Имэйл:</strong> <a href="mailto:info@digitalger.mn">info@digitalger.mn</a></li>
  <li><strong>Утас:</strong> +976 9999-0000</li>
  <li><strong>Хаяг:</strong> Улаанбаатар хот, Монгол улс</li>
  <li><strong>Facebook:</strong> <a href="https://facebook.com/digitalger.mn" target="_blank" rel="noopener noreferrer">facebook.com/digitalger.mn</a></li>
</ul>

<h2>Ажлын цаг</h2>
<p>Даваа–Баасан: 09:00–18:00<br/>Бямба, Ням: Амралтын өдөр</p>`;

const PAGES = [
  {
    slug: 'about' as const,
    label: 'Бидний тухай',
    defaultTitle: 'Бидний тухай',
    defaultContent: ABOUT_DEFAULT,
  },
  {
    slug: 'privacy-policy' as const,
    label: 'Нууцлалын бодлого',
    defaultTitle: 'Нууцлалын бодлого',
    defaultContent: PRIVACY_DEFAULT,
  },
  {
    slug: 'terms-of-use' as const,
    label: 'Үйлчилгээний нөхцөл',
    defaultTitle: 'Үйлчилгээний нөхцөл',
    defaultContent: TERMS_DEFAULT,
  },
  {
    slug: 'data-deletion' as const,
    label: 'Мэдээлэл устгах',
    defaultTitle: 'Мэдээлэл устгах',
    defaultContent: DATA_DELETION_DEFAULT,
  },
  {
    slug: 'contact' as const,
    label: 'Холбоо барих',
    defaultTitle: 'Холбоо барих',
    defaultContent: CONTACT_DEFAULT,
  },
] as const;

// Native textarea — shared UI-д Textarea байхгүй тул local тодорхойлов (seo page-тэй ижил)
function Textarea({
  rows = 3,
  placeholder,
  value,
  onChange,
}: {
  rows?: number;
  placeholder?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <textarea
      rows={rows}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="flex min-h-15 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
    />
  );
}

type PageSlug = (typeof PAGES)[number]['slug'];

interface PageData {
  slug: string;
  title: string;
  content: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  ogImageUrl?: string | null;
}

interface PageForm {
  title: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  ogImageUrl: string;
}

function PageEditor({
  slug,
  defaultTitle,
  defaultContent,
}: {
  slug: PageSlug;
  defaultTitle: string;
  defaultContent: string;
}) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'pages', slug],
    queryFn: () => adminApi.pages.get(slug),
  });

  const [form, setForm] = useState<PageForm | null>(null);
  const [uploading, setUploading] = useState(false);
  const ogFileRef = useRef<HTMLInputElement>(null);

  const d = data as PageData | null;
  // form (засагдсан) > DB утга > default
  const current: PageForm = form ?? {
    title: d?.title ?? defaultTitle,
    content: d?.content ?? defaultContent,
    metaTitle: d?.metaTitle ?? '',
    metaDescription: d?.metaDescription ?? '',
    metaKeywords: d?.metaKeywords ?? '',
    ogImageUrl: d?.ogImageUrl ?? '',
  };

  const patch = (p: Partial<PageForm>) => setForm({ ...current, ...p });

  const handleOgUpload = async (file: File) => {
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
      const result = await uploadWithProgress(file, 'pages');
      patch({ ogImageUrl: result.url });
      toast.success('Зураг байршлаа');
    } catch {
      toast.error('Зураг байршуулахад алдаа гарлаа');
    } finally {
      setUploading(false);
    }
  };

  const saveMut = useMutation({
    mutationFn: () =>
      adminApi.pages.update(slug, {
        title: current.title,
        content: current.content,
        // Хоосон утгыг дамжуулахгүй (DB-д null хадгалагдана)
        metaTitle: current.metaTitle || undefined,
        metaDescription: current.metaDescription || undefined,
        metaKeywords: current.metaKeywords || undefined,
        ogImageUrl: current.ogImageUrl || undefined,
      }),
    onSuccess: () => {
      toast.success('Хуудас хадгалагдлаа');
      queryClient.invalidateQueries({ queryKey: ['admin', 'pages', slug] });
    },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  if (isLoading) return <Loading label="Ачаалж байна..." />;

  return (
    <div className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label>Хуудасны гарчиг</Label>
        <Input
          value={current.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder={defaultTitle}
        />
      </div>
      <div className="space-y-2">
        <Label>Агуулга</Label>
        <RichEditor
          key={isLoading ? 'loading' : 'loaded'}
          value={current.content}
          onChange={(v) => patch({ content: v })}
          placeholder="Хуудасны агуулгыг оруулна уу..."
          minHeight="400px"
        />
      </div>

      {/* —— SEO тохиргоо —— */}
      <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-sm font-semibold">SEO тохиргоо (хайлтын систем)</p>
        <div className="space-y-2">
          <Label>Meta гарчиг (Title)</Label>
          <Input
            value={current.metaTitle}
            onChange={(e) => patch({ metaTitle: e.target.value })}
            placeholder={`${current.title || defaultTitle} | DigitalGer`}
          />
          <p className="text-xs text-muted-foreground">Хоосон бол хуудасны гарчгийг ашиглана.</p>
        </div>
        <div className="space-y-2">
          <Label>Meta тайлбар (Description)</Label>
          <Textarea
            value={current.metaDescription}
            onChange={(e) => patch({ metaDescription: e.target.value })}
            placeholder="Хайлтын үр дүнд харагдах товч тайлбар (150-160 тэмдэгт)"
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>Түлхүүр үгс (Keywords)</Label>
          <TagInput
            value={current.metaKeywords ? current.metaKeywords.split(',').map((k) => k.trim()).filter(Boolean) : []}
            onChange={(tags) => patch({ metaKeywords: tags.join(', ') })}
            placeholder="дижитал, бүтээгдэхүүн... (Enter дарна уу)"
          />
        </div>
        <div className="space-y-2">
          <Label>OG зураг (нийгмийн сүлжээ — 1200x630)</Label>
          <input
            ref={ogFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleOgUpload(file);
              e.target.value = '';
            }}
          />
          {current.ogImageUrl ? (
            <div className="flex items-start gap-4">
              <div className="relative h-32 w-60 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                <Image
                  src={current.ogImageUrl}
                  alt="OG зураг"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => ogFileRef.current?.click()}
                  className="gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? 'Байршуулж байна...' : 'Солих'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => patch({ ogImageUrl: '' })}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" /> Устгах
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => ogFileRef.current?.click()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleOgUpload(file);
              }}
              onDragOver={(e) => e.preventDefault()}
              disabled={uploading}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/50 disabled:opacity-60"
            >
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                {uploading ? 'Байршуулж байна...' : 'Зураг чирж тавих эсвэл сонгох'}
              </p>
              <p className="text-xs text-muted-foreground">PNG, JPG, WEBP — дээд тал 5MB</p>
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="gap-2">
          <Save className="h-4 w-4" />
          {saveMut.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
        </Button>
      </div>
    </div>
  );
}

export default function PagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Хуудас удирдлага</h1>
        <p className="text-muted-foreground">Нууцлалын бодлого болон үйлчилгээний нөхцөлийг засварлах</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="privacy-policy">
            <TabsList>
              {PAGES.map((page) => (
                <TabsTrigger key={page.slug} value={page.slug}>
                  {page.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {PAGES.map((page) => (
              <TabsContent key={page.slug} value={page.slug}>
                <PageEditor
                  slug={page.slug}
                  defaultTitle={page.defaultTitle}
                  defaultContent={page.defaultContent}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
