import type { Metadata } from 'next';
import { SERVER_API_URL } from '@/lib/server-api';
import { buildPageMetadata, jsonLd } from '@/lib/seo';


/**
 * ⚠️ ISR — 10 минут тутам шинэчилнэ.
 *
 * Асуудал байсан: build үед backend унтарсан байдаг тул FAQ хоосон буцаж,
 * FAQPage JSON-LD статик HTML-д ОГТ ОРОХГҮЙ байв.
 *
 * ⚠️⚠️ Өмнө нь `force-dynamic` + `revalidate` ХОЁУЛАА тавьсан нь ЗӨРЧИЛ:
 * `force-dynamic` нь `revalidate`-ыг ХҮЧИНГҮЙ болгодог тул кэш ОГТ
 * ажиллахгүй, хүсэлт БҮРД backend дуудагдана (удаан). ISR ганцаараа
 * асуудлыг шийднэ — build-д амжилтгүй болбол эхний бодит хүсэлтээр
 * үүсгээд кэшлэнэ.
 */
export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    path: '/faq',
    title: 'Түгээмэл асуулт',
    description:
      'BestTV-ийн багц, төлбөр, тоглуулалт, бүртгэлтэй холбоотой түгээмэл асуултын хариулт.',
  });
}

interface Faq {
  question: string;
  answer: string;
}

/** ⚠️ FAQ уншиж чадахгүй бол JSON-LD-гүй — хуудас унах ёсгүй */
async function getFaqs(): Promise<Faq[]> {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/faqs`, { next: { revalidate: 600 } });
    if (!res.ok) return [];
    const json = await res.json();
    const rows = Array.isArray(json) ? json : (json.items ?? []);
    return rows.filter((f: Faq) => f?.question && f?.answer);
  } catch {
    return [];
  }
}

export default async function FaqLayout({ children }: { children: React.ReactNode }) {
  const faqs = await getFaqs();

  return (
    <>
      {/* FAQPage structured data — Google хайлтад асуулт/хариулт задарч харагдана */}
      {faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqs.slice(0, 30).map((f) => ({
                '@type': 'Question',
                name: f.question,
                acceptedAnswer: {
                  '@type': 'Answer',
                  // HTML тэгийг арилгана — schema.org-д цэвэр текст
                  text: f.answer.replace(/<[^>]*>/g, '').trim(),
                },
              })),
            }),
          }}
        />
      )}
      {children}
    </>
  );
}
