import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SITE_URL, SITE_NAME } from '@/lib/constants';
import { buildPageMetadata } from '@/lib/page-metadata';
import { PageHeader } from '@/components/ui/page-header';
import { sanitizeHtml } from '@/lib/safe-html';
import { ContactForm } from '@/components/contact/contact-form';

export const revalidate = 60;

interface ContactPage {
  title: string;
  content: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  ogImageUrl?: string | null;
}

const DEFAULT_TITLE = 'Холбоо барих';
const DEFAULT_DESCRIPTION =
  'DigitalGer-тэй холбоо барих — имэйл, утас, хаяг болон ажлын цаг. Асуулт, санал, дэмжлэгийн талаар бидэнтэй холбогдоорой.';
const DEFAULT_CONTENT = `<h2>Бидэнтэй холбоо барих</h2>
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

async function getContactPage(): Promise<ContactPage | null> {
  try {
    const apiUrl =
      process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const res = await fetch(`${apiUrl}/api/pages/contact`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as ContactPage | null;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  // SEO-г page-аас, дутуу бол SiteSettings-ээс, эцэст нь hardcode fallback
  return buildPageMetadata(
    'contact',
    `${DEFAULT_TITLE} | ${SITE_NAME}`,
    DEFAULT_DESCRIPTION,
  );
}

export default async function ContactPage() {
  const page = await getContactPage();
  const title = page?.title || DEFAULT_TITLE;
  const content = page?.content || DEFAULT_CONTENT;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: title,
    url: `${SITE_URL}/contact`,
    description: page?.metaDescription || DEFAULT_DESCRIPTION,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      email: 'info@digitalger.mn',
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-8">
        <Link href="/" className="hover:text-foreground transition-colors">Нүүр</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{title}</span>
      </nav>

      <PageHeader title={title} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        {/* Зүүн тал: DB-ээс ирэх холбоо барих мэдээлэл/HTML */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          <div
            className="prose prose-base max-w-none font-sans text-muted-foreground
              prose-headings:font-sans prose-headings:text-foreground prose-headings:font-semibold
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-li:marker:text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
          />
        </div>

        {/* Баруун тал: хүсэлт илгээх маягт */}
        <ContactForm />
      </div>
    </div>
  );
}
