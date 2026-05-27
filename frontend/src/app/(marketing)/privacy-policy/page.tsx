import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { pagesApi } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { sanitizeHtml } from '@/lib/safe-html';

export const metadata: Metadata = {
  title: 'Нууцлалын бодлого | DigitalGer',
  description: 'DigitalGer нууцлалын бодлого',
};

const DEFAULT_CONTENT = `<h2>1. Мэдээлэл цуглуулах</h2>
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

export default async function PrivacyPolicyPage() {
  let content = DEFAULT_CONTENT;
  let title = 'Нууцлалын бодлого';

  try {
    const page = await pagesApi.bySlug('privacy-policy');
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
