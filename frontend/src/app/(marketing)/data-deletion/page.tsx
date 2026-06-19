import type { Metadata } from 'next';
import { pagesApi } from '@/lib/api';
import { buildPageMetadata } from '@/lib/page-metadata';
import { PageHero } from '@/components/ui/page-hero';
import { sanitizeHtml } from '@/lib/safe-html';

export async function generateMetadata(): Promise<Metadata> {
  // SEO-г page-аас, дутуу бол SiteSettings-ээс, эцэст нь hardcode fallback
  return buildPageMetadata(
    'data-deletion',
    'Мэдээлэл устгах | DigitalGer',
    'DigitalGer — хэрэглэгчийн мэдээлэл устгах хүсэлт',
  );
}

const DEFAULT_CONTENT = `<h2>Мэдээлэл устгах хүсэлт</h2>
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

export default async function DataDeletionPage() {
  let content = DEFAULT_CONTENT;
  let title = 'Мэдээлэл устгах';

  try {
    const page = await pagesApi.bySlug('data-deletion');
    if (page && page.content) {
      title = page.title;
      content = page.content;
    }
  } catch {
    // fallback to default content
  }

  return (
    <>
      <PageHero title={title} />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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
    </>
  );
}
