import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SITE_URL, SITE_NAME } from '@/lib/constants';
import { buildPageMetadata } from '@/lib/page-metadata';
import { PageHeader } from '@/components/ui/page-header';
import { sanitizeHtml } from '@/lib/safe-html';
import { ContactForm } from '@/components/contact/contact-form';
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

// Идэвхтэй social холбоосыг admin SiteSettings-ээс динамикаар татна (footer-тэй ижил).
interface SocialLinks {
  socialFacebook?: string | null;
  socialInstagram?: string | null;
  socialTwitter?: string | null;
  socialThreads?: string | null;
  socialTelegram?: string | null;
  socialWhatsapp?: string | null;
  socialTiktok?: string | null;
  socialYoutube?: string | null;
  socialLinkedin?: string | null;
}
async function getSocialLinks(): Promise<SocialLinks> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    const res = await fetch(`${apiUrl}/api/settings/public`, { next: { revalidate: 300 } });
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}
const SOCIAL_ITEMS = [
  { key: 'socialFacebook' as const, label: 'Facebook', Icon: FacebookIcon },
  { key: 'socialInstagram' as const, label: 'Instagram', Icon: InstagramIcon },
  { key: 'socialTwitter' as const, label: 'Twitter / X', Icon: TwitterXIcon },
  { key: 'socialThreads' as const, label: 'Threads', Icon: ThreadsIcon },
  { key: 'socialTelegram' as const, label: 'Telegram', Icon: TelegramIcon },
  { key: 'socialWhatsapp' as const, label: 'WhatsApp', Icon: WhatsAppIcon },
  { key: 'socialTiktok' as const, label: 'TikTok', Icon: TikTokIcon },
  { key: 'socialYoutube' as const, label: 'YouTube', Icon: YouTubeIcon },
  { key: 'socialLinkedin' as const, label: 'LinkedIn', Icon: LinkedInIcon },
];

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
  const [page, social] = await Promise.all([getContactPage(), getSocialLinks()]);
  const title = page?.title || DEFAULT_TITLE;
  const content = page?.content || DEFAULT_CONTENT;
  const activeSocials = SOCIAL_ITEMS.filter(({ key }) => !!social[key]);

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
        {/* Зүүн тал: DB-ээс ирэх холбоо барих мэдээлэл/HTML + social icon */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          <div
            className="prose prose-base max-w-none font-sans text-muted-foreground
              prose-headings:font-sans prose-headings:text-foreground prose-headings:font-semibold
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-li:marker:text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
          />
          {/* Социал сүлжээ — admin SiteSettings-ээс динамик. Idэвхтэйг нь icon-оор. */}
          {activeSocials.length > 0 && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-sm font-semibold text-foreground mb-3">Биднийг дагаарай</p>
              <div className="flex flex-wrap gap-2.5">
                {activeSocials.map(({ key, label, Icon }) => (
                  <a
                    key={key}
                    href={social[key]!}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Баруун тал: хүсэлт илгээх маягт */}
        <ContactForm />
      </div>
    </div>
  );
}
