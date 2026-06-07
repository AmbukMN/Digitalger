'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
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
import { RichEditor } from '@/components/ui/rich-editor';

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
          <Input
            value={current.metaKeywords}
            onChange={(e) => patch({ metaKeywords: e.target.value })}
            placeholder="дижитал, бүтээгдэхүүн, ... (таслалаар тусгаарлана)"
          />
        </div>
        <div className="space-y-2">
          <Label>OG зургийн URL (нийгмийн сүлжээ)</Label>
          <Input
            value={current.ogImageUrl}
            onChange={(e) => patch({ ogImageUrl: e.target.value })}
            placeholder="https://...   (1200x630)"
          />
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
