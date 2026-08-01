'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BrandLogo } from '@besttv/shared/ui';
import { Facebook, Instagram, Mail, Phone, Youtube } from 'lucide-react';
import { api } from '@/lib/api';
import { NewsletterForm } from '@/components/newsletter-form';
import { useBrand } from '@/lib/queries';

const FOOTER_LINKS = [
  {
    heading: 'Контент',
    links: [
      { href: '/movies', label: 'Кино' },
      { href: '/search', label: 'Хайлт' },
    ],
  },
  {
    heading: 'Данс',
    links: [
      { href: '/pricing', label: 'Багц авах' },
      { href: '/my-list', label: 'Дуртай кино' },
      { href: '/profile', label: 'Профайл' },
    ],
  },
  {
    heading: 'Тусламж',
    links: [
      { href: '/faq', label: 'Түгээмэл асуулт' },
      { href: '/blog', label: 'Блог' },
    ],
  },
];

interface Socials {
  facebook: string;
  instagram: string;
  youtube: string;
  twitter: string;
  tiktok: string;
  email: string;
  phone: string;
}

/** TikTok/X нь lucide-д байхгүй тул inline SVG */
function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1 0-5.18c.27 0 .52.04.76.12v-3.2a5.8 5.8 0 0 0-.76-.05A5.79 5.79 0 1 0 15.65 15.4V9.01a7.35 7.35 0 0 0 4.29 1.38V7.3a4.29 4.29 0 0 1-3.34-1.48Z" />
    </svg>
  );
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.9 2H22l-7.1 8.1L23 22h-6.6l-5.2-6.8L5.3 22H2.2l7.6-8.7L1.6 2h6.8l4.7 6.2L18.9 2Zm-1.1 18h1.7L7.3 3.8H5.5L17.8 20Z" />
    </svg>
  );
}

/**
 * Сайтын хөл.
 *
 * ⚠️ CLIENT компонент — сошиал холбоос, хууль эрх зүйн хуудсууд нь админаас
 * удирддаг тул build үед prerender хийгдвэл ХООСОН хөлддөг (build container-т
 * backend байхгүй → fetch унана → хоосон массив статикт бичигдэнэ). Client
 * талд татаж, админы өөрчлөлт шууд тусна.
 */
export function Footer() {
  const { data: brand } = useBrand();
  const logoUrl = brand?.logoUrl ?? null;
  const siteName = brand?.siteName ?? 'BestTV';

  const { data: socials } = useQuery({
    queryKey: ['socials'],
    queryFn: () => api<Socials>('/settings/socials'),
    staleTime: 300_000,
  });

  const { data: pages } = useQuery({
    queryKey: ['legal-pages'],
    queryFn: () => api<{ slug: string; title: string }[]>('/pages'),
    staleTime: 300_000,
  });

  // ⚠️ Зөвхөн ТОХИРУУЛСАН сүлжээ харагдана — хоосон нь огт гарахгүй
  const socialLinks = [
    { href: socials?.facebook, label: 'Facebook', Icon: Facebook },
    { href: socials?.instagram, label: 'Instagram', Icon: Instagram },
    { href: socials?.youtube, label: 'YouTube', Icon: Youtube },
    { href: socials?.twitter, label: 'X', Icon: XIcon },
    { href: socials?.tiktok, label: 'TikTok', Icon: TikTokIcon },
  ].filter((s): s is { href: string; label: string; Icon: typeof Facebook } => !!s.href);

  return (
    <footer className="mt-16 border-t border-white/8 bg-[#0a0a0a]">
      {/* ⚠️ pb — мобайлын bottom nav (h~60px + safe area) footer-ийн сүүлийн
          мөрийг бүрхэхээс сэргийлнэ */}
      <div className="mx-auto max-w-[1600px] px-4 pb-[calc(5rem+var(--safe-bottom))] pt-10 md:px-8 md:pb-12 md:pt-12">
        <div className="grid gap-8 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-10">
          <div>
            <Link href="/" className="inline-flex items-center">
              <BrandLogo logoUrl={logoUrl} siteName={siteName} imgClassName="h-9 w-auto" />
            </Link>
            {/*
              ⚠️ Тайлбар + форм:
                - МОБАЙЛ: нэг мөрөнд зэрэгцээ (footer урт болохгүй)
                - ДЕСКТОП: форм нь тайлбарын ЯГ ДООР, нарийхан
            */}
            <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-3 md:block">
              <p className="min-w-0 flex-1 max-w-xs text-sm leading-relaxed text-white/45">
                Үз, мэдэр, дахин үз. Монголын киноны стриминг платформ.
              </p>

              <div className="w-full max-w-[220px] shrink-0 md:mt-4">
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                  Шинэ кино авах
                </h3>
                <NewsletterForm />
              </div>
            </div>

            {(socials?.email || socials?.phone) && (
              <div className="mt-4 space-y-1.5 text-sm text-white/55">
                {socials.email && (
                  <a
                    href={`mailto:${socials.email}`}
                    className="flex items-center gap-2 transition-colors hover:text-white"
                  >
                    <Mail size={14} /> {socials.email}
                  </a>
                )}
                {socials.phone && (
                  <a
                    href={`tel:${socials.phone.replace(/\s/g, '')}`}
                    className="flex items-center gap-2 transition-colors hover:text-white"
                  >
                    <Phone size={14} /> {socials.phone}
                  </a>
                )}
              </div>
            )}

            {socialLinks.length > 0 && (
              <div className="mt-5 flex gap-3">
                {socialLinks.map(({ href, label, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="rounded-full bg-white/8 p-2.5 text-white/60 transition-colors hover:bg-primary hover:text-white"
                  >
                    <Icon size={16} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* ⚠️ Мобайл дээр 3 БАГАНА — нэг эгнээнд цуварвал footer хэт урт болно */}
          <div className="grid grid-cols-3 gap-4 sm:gap-8 md:contents">
            {FOOTER_LINKS.map((col) => (
              <nav key={col.heading} aria-label={col.heading}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 sm:text-sm">
                  {col.heading}
                </h3>
                <ul className="mt-3 space-y-2.5 md:mt-4">
                  {col.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link
                        href={l.href}
                        className="text-[13px] text-white/65 transition-colors hover:text-white sm:text-sm"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>

              </nav>
            ))}
          </div>
        </div>

        {/* ⚠️ Хууль эрх зүйн хуудсууд — доод мөрөнд, copyright-ийн хажууд */}
        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-white/8 pt-6 text-xs text-white/35 sm:flex-row md:mt-10">
          <p>
            © {new Date().getFullYear()} {siteName}. Бүх эрх хуулиар хамгаалагдсан.
          </p>
          {!!pages?.length && (
            <nav aria-label="Хууль эрх зүй" className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
              {pages.map((p, i) => (
                <span key={p.slug} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden>·</span>}
                  <Link href={`/p/${p.slug}`} className="transition-colors hover:text-white/70">
                    {p.title}
                  </Link>
                </span>
              ))}
            </nav>
          )}
        </div>
      </div>
    </footer>
  );
}
