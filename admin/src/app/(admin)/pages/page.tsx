'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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

const PAGES = [
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
] as const;

type PageSlug = (typeof PAGES)[number]['slug'];

interface PageData {
  slug: string;
  title: string;
  content: string;
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

  const [form, setForm] = useState<{ title: string; content: string } | null>(null);

  const currentData = form ?? {
    title: (data as PageData | null)?.title ?? defaultTitle,
    content: (data as PageData | null)?.content ?? defaultContent,
  };

  const saveMut = useMutation({
    mutationFn: () =>
      adminApi.pages.update(slug, {
        title: currentData.title,
        content: currentData.content,
      }),
    onSuccess: () => {
      toast.success('Хуудас хадгалагдлаа');
      queryClient.invalidateQueries({ queryKey: ['admin', 'pages', slug] });
    },
    onError: () => toast.error('Алдаа гарлаа'),
  });

  if (isLoading) return <Loading label="Ачаалж байна..." />;

  const title = form?.title ?? (data as PageData | null)?.title ?? defaultTitle;
  const content = form?.content ?? (data as PageData | null)?.content ?? defaultContent;

  return (
    <div className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label>Хуудасны гарчиг</Label>
        <Input
          value={title}
          onChange={(e) => setForm((f) => ({ title: e.target.value, content: f?.content ?? content }))}
          placeholder={defaultTitle}
        />
      </div>
      <div className="space-y-2">
        <Label>Агуулга</Label>
        <RichEditor
          key={isLoading ? 'loading' : 'loaded'}
          value={content}
          onChange={(v) => setForm((f) => ({ title: f?.title ?? title, content: v }))}
          placeholder="Хуудасны агуулгыг оруулна уу..."
          minHeight="400px"
        />
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
