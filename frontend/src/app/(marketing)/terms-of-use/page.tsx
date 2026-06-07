import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { pagesApi } from '@/lib/api';
import { buildPageMetadata } from '@/lib/page-metadata';
import { PageHeader } from '@/components/ui/page-header';
import { sanitizeHtml } from '@/lib/safe-html';

export async function generateMetadata(): Promise<Metadata> {
  // SEO-г page-аас, дутуу бол SiteSettings-ээс, эцэст нь hardcode fallback
  return buildPageMetadata(
    'terms-of-use',
    'Үйлчилгээний нөхцөл | DigitalGer',
    'DigitalGer үйлчилгээний нөхцөл',
  );
}

const DEFAULT_CONTENT = `<h2>1. Ерөнхий нөхцөл</h2>
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

export default async function TermsOfUsePage() {
  let content = DEFAULT_CONTENT;
  let title = 'Үйлчилгээний нөхцөл';

  try {
    const page = await pagesApi.bySlug('terms-of-use');
    if (page && page.content) {
      title = page.title;
      content = page.content;
    }
  } catch {
    // fallback to default content
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-8">
        <Link href="/" className="hover:text-foreground transition-colors">Нүүр</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{title}</span>
      </nav>

      <PageHeader title={title} />

      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 lg:p-10 shadow-sm">
        <div
          className="prose prose-base max-w-none font-sans text-muted-foreground
            prose-headings:font-sans prose-headings:text-foreground prose-headings:font-semibold
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-li:marker:text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
        />
      </div>
    </div>
  );
}
