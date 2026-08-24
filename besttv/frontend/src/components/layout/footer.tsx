'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BrandLogo } from '@besttv/shared/ui';
import { Facebook, Instagram, Mail, Phone, Youtube } from 'lucide-react';
import { api } from '@/lib/api';
import { NewsletterForm } from '@/components/newsletter-form';
import { FooterPaymentMarks } from '@/components/payment/footer-payment-marks';
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

  /**
   * ⚠️⚠️ ХУУЛЬ ЭРХ ЗҮЙН ЛИНК НЬ API-ААС ХАМААРАХГҮЙ.
   *
   * БОДИТ АЛДАА: `{!!pages?.length && ...}` гэсэн болзол нь API удаан
   * хариулах / SSR-ийн үед / query унасан тохиолдолд линкийг БҮРМӨСӨН
   * АЛГА болгодог байв (хэрэглэгч «privacy, term алга» гэж 2 удаа
   * мэдээлсэн). Энэ 3 хуудас нь ҮРГЭЛЖ байдаг ба Meta/Apple зэрэг
   * платформын ЗААВАЛ ШААРДЛАГА тул хэзээ ч алга болж болохгүй.
   *
   * Тиймээс: API ирвэл түүнийг (админ гарчгийг өөрчилж болно),
   * ирээгүй бол доорх тогтмол жагсаалтыг харуулна.
   * ⚠️ slug-ууд backend-ийн seed-тэй ТААРНА (/p/terms, /p/privacy,
   *    /p/data-deletion) — өөрчилвөл хоёуланг нь зэрэг зас.
   */
  const legalPages =
    pages?.length
      ? pages
      : [
          { slug: 'terms', title: 'Үйлчилгээний нөхцөл' },
          { slug: 'privacy', title: 'Нууцлалын бодлого' },
          { slug: 'data-deletion', title: 'Мэдээлэл устгах хүсэлт' },
        ];

  // ⚠️ Зөвхөн ТОХИРУУЛСАН сүлжээ харагдана — хоосон нь огт гарахгүй
  const socialLinks = [
    { href: socials?.facebook, label: 'Facebook', Icon: Facebook },
    { href: socials?.instagram, label: 'Instagram', Icon: Instagram },
    { href: socials?.youtube, label: 'YouTube', Icon: Youtube },
    { href: socials?.twitter, label: 'X', Icon: XIcon },
    { href: socials?.tiktok, label: 'TikTok', Icon: TikTokIcon },
  ].filter((s): s is { href: string; label: string; Icon: typeof Facebook } => !!s.href);

  return (
    <footer /* ⚠️ THEME ДАГАНА — `bg-[#0a0a0a]` хатуу байсан тул гэрэл горимд
         footer ГАНЦААРАА хар үлдэж, хуудасны доод хэсэг тасарсан мэт
         харагддаг байв. `bg-muted` нь хоёр горимд ч зөв ялгарна. */
      className="mt-16 border-t border-foreground/8 bg-muted">
      {/* ⚠️ pb — мобайлын bottom nav (h~60px + safe area) footer-ийн сүүлийн
          мөрийг бүрхэхээс сэргийлнэ */}
      <div className="mx-auto max-w-[1600px] px-4 pb-[calc(var(--mobile-nav-h)+1.5rem)] pt-10 md:px-8 md:pb-12 md:pt-12">
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
            {/*
              ⚠️ МОБАЙЛ 60/40: тайлбар 60%, имэйл хэсэг 40%. Өмнө нь
              `flex-wrap` + `max-w-[220px]` байсан тул тайлбар ~60%-ийг
              эзлээд input давчуурч байв. Одоо тогтмол харьцаа.
            */}
            <div className="mt-3 flex items-stretch gap-3 md:block">
              <p className="min-w-0 basis-[58%] self-start text-sm leading-relaxed text-foreground/45 md:max-w-xs md:basis-auto">
                Үз, мэдэр, дахин үз. Монголын киноны стриминг платформ.
              </p>

              {/*
                ⚠️ Тусгаарлагч зураас — ЗӨВХОН МОБАЙЛ (md:hidden).
                Десктоп дээр форм нь тайлбарын доор босдог тул зураас утгагүй.
              */}
              <div
                aria-hidden="true"
                className="w-px shrink-0 self-stretch bg-foreground/10 md:hidden"
              />

              <div className="min-w-0 basis-[42%] md:mt-4 md:w-full md:max-w-[220px] md:basis-auto">
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/40">
                  Шинэ кино авах
                </h3>
                <NewsletterForm />
              </div>
            </div>

            {/*
              ⚠️ Холбоо барих (имэйл/утас) болон сошиал холбоос нь ЭНД БИШ
              — «Тусламж» баганын 3 дахь мөрөнд зөөгдсөн. Хэрэглэгч
              холбоо барих мэдээллийг ТУСЛАМЖ хэсгээс хайдаг.
            */}
          </div>

          {/* ⚠️ Мобайл дээр 3 БАГАНА — нэг эгнээнд цуварвал footer хэт урт болно */}
          <div className="grid grid-cols-3 gap-4 sm:gap-8 md:contents">
            {FOOTER_LINKS.map((col) => (
              <nav key={col.heading} aria-label={col.heading}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/40 sm:text-sm">
                  {col.heading}
                </h3>
                <ul className="mt-3 space-y-2.5 md:mt-4">
                  {col.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link
                        href={l.href}
                        className="text-[13px] text-foreground/65 transition-colors hover:text-foreground sm:text-sm"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>

                {/*
                  ⚠️⚠️ ХОЛБОО БАРИХ — ЗӨВХӨН «Тусламж» баганад, 3 дахь мөрөнд.
                  Хэрэглэгч холбоо барих мэдээллийг энэ хэсгээс хайдаг
                  (өмнө нь зүүн талын лого доор байсан тул анзаарагддаггүй).

                  ⚠️ Мобайл vs Десктоп ЯЛГААТАЙ:
                    • МОБАЙЛ — багана нарийн (дэлгэцийн 1/3) тул урт имэйл
                      хаяг тасарч «support@bes…» болно. Тиймээс ICON.
                    • ДЕСКТОП — зай хангалттай тул бүтэн хаяг.

                  ⚠️ Утга нь АДМИН панелиас (`/settings/socials`) ирнэ —
                     хатуу бичээгүй. Тохируулаагүй бол огт харагдахгүй.
                */}
                {col.heading === 'Тусламж' && (socials?.email || socials?.phone || socialLinks.length > 0) && (
                  /**
                   * ⚠️⚠️ МОБАЙЛ = НЭГ ЭГНЭЭ, ДЕСКТОП = БОСОО.
                   *
                   * БОДИТ АЛДАА: `space-y-2.5` нь БҮГДИЙГ доош цувруулдаг
                   * байсан тул мобайлд имэйл icon, дараа нь Facebook icon
                   * тус тусдаа мөр эзэлж, footer дэмий урт болж байв
                   * (2 icon → 2 мөр).
                   *
                   * Одоо:
                   *   МОБАЙЛ  — flex-row, icon-ууд зэрэгцээ (нэг эгнээ)
                   *   ДЕСКТОП — flex-col, имэйл бүтэн хаягтай ДЭЭР,
                   *             сошиал icon-ууд ДООР (md:)
                   */
                  /**
                   * ⚠️ ЯАГААД FLEX-WRAP (grid БИШ):
                   *   МОБАЙЛ  — бүх icon НЭГ эгнээнд урсана
                   *   ДЕСКТОП — имэйл нь `md:basis-full` тул БҮТЭН мөр
                   *             эзэлж, сошиал icon-ууд ДООД мөрөнд
                   *             зэрэгцээ үлдэнэ (босоо цуварахгүй)
                   */
                  <div className="mt-3 flex flex-row flex-wrap items-center gap-2 md:mt-4 md:gap-x-2 md:gap-y-2.5">
                    {socials?.email && (
                      <a
                        href={`mailto:${socials.email}`}
                        aria-label={`Имэйл: ${socials.email}`}
                        title={socials.email}
                        className="group flex items-center gap-2 text-[13px] text-foreground/65 transition-colors hover:text-foreground md:basis-full md:text-sm"
                      >
                        {/* ⚠️ Мобайлд дугуй товч (дарахад хялбар), десктопт энгийн icon */}
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/8 transition-colors group-hover:bg-primary group-hover:text-primary-foreground md:h-auto md:w-auto md:rounded-none md:bg-transparent group-hover:md:bg-transparent group-hover:md:text-foreground">
                          <Mail size={14} />
                        </span>
                        {/* ⚠️ Хаяг ЗӨВХӨН md+ — мобайлд багана нарийн тул тасарна */}
                        <span className="hidden min-w-0 truncate md:inline">{socials.email}</span>
                      </a>
                    )}

                    {socials?.phone && (
                      <a
                        href={`tel:${socials.phone.replace(/\s/g, '')}`}
                        aria-label={`Утас: ${socials.phone}`}
                        title={socials.phone}
                        className="group flex items-center gap-2 text-[13px] text-foreground/65 transition-colors hover:text-foreground md:basis-full md:text-sm"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/8 transition-colors group-hover:bg-primary group-hover:text-primary-foreground md:h-auto md:w-auto md:rounded-none md:bg-transparent group-hover:md:bg-transparent group-hover:md:text-foreground">
                          <Phone size={14} />
                        </span>
                        <span className="hidden min-w-0 truncate md:inline">{socials.phone}</span>
                      </a>
                    )}

                    {/*
                      ⚠️ Сошиал нь ҮРГЭЛЖ icon — нэр бичих шаардлагагүй.

                      ⚠️ ЭНЭ НЬ ЗАВСРЫН DIV-ГҮЙ — icon бүр эцэг flex-ийн
                         ШУУД хүүхэд байна. Тиймээс:
                           МОБАЙЛ  (flex-row) → имэйлтэй НЭГ ЭГНЭЭНД
                           ДЕСКТОП (flex-col) → доор нь босоо
                         Завсрын div тавибал мобайлд тусдаа МӨР үүсгэдэг
                         (яг тэр алдаа гарч байсан).

                      ⚠️ Десктопт icon-ууд хоорондоо зэрэгцээ байхын тулд
                         сүүлийн icon бүрийг нэг мөрөнд багтаах хэрэгтэй —
                         `md:-mr-1` нь хажуугийн зайг арилгаж, дараагийн
                         icon шууд наалдана.
                    */}
                    {socialLinks.map(({ href, label, Icon }) => (
                      <a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={label}
                        title={label}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/8 text-foreground/60 transition-colors hover:bg-primary hover:text-primary-foreground"
                      >
                        <Icon size={14} />
                      </a>
                    ))}
                  </div>
                )}
              </nav>
            ))}
          </div>
        </div>

        {/*
          ⚠️ Хууль эрх зүйн хуудсууд — доод мөрөнд, copyright-ийн хажууд.
          МОБАЙЛД голлуулна (текст зүүн тийш нийлж эмх замбараагүй харагдаж
          байсан); ДЕСКТОПТ хуучнаар зүүн/баруун.
        */}
        {/*
          ⚠️ pb — мобайлд баруун доод буланд ХӨВӨГЧ чат товч байдаг тул
          сүүлийн мөрийг халхлахаас сэргийлж доод зай нэмнэ.
        */}
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-foreground/8 pb-14 pt-6 text-center text-xs text-foreground/35 sm:flex-row sm:items-start sm:pb-0 sm:text-left md:mt-10">
          <p>
            © {new Date().getFullYear()} {siteName}. Бүх эрх хуулиар хамгаалагдсан.
          </p>
          {/*
            ⚠️ Хууль эрх зүй + ТӨЛБӨРИЙН ЛОГО нэг баганад.
            ДЕСКТОПТ: линкүүдийн ДООД талд (баруун тийш),
            МОБАЙЛД: голд (доод талд) — тайлбарыг `PaymentMarks` дээр үз.
          */}
          {/*
            ⚠️⚠️ Хууль эрх зүйн линк нь заавал ХАРАГДАХ ёстой (Meta/Apple
            зэрэг платформ шалгадаг, хэрэглэгчийн эрхийн шаардлага).
            Тиймээс төлбөрийн логотой НЭГ баганад хийхдээ линкийг ДЭЭР,
            логог ДООР нь тавьж, `shrink-0` өгч дарагдахаас хамгаална.
          */}
          <div className="flex shrink-0 flex-col items-center gap-2.5 sm:items-end">
            {!!legalPages.length && (
              <nav
                aria-label="Хууль эрх зүй"
                className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 sm:justify-end"
              >
                {legalPages.map((p, i) => (
                  <span key={p.slug} className="flex items-center gap-1.5">
                    {i > 0 && <span aria-hidden className="text-foreground/20">·</span>}
                    <Link
                      href={`/p/${p.slug}`}
                      className="whitespace-nowrap transition-colors hover:text-foreground/70"
                    >
                      {p.title}
                    </Link>
                  </span>
                ))}
              </nav>
            )}
            <FooterPaymentMarks />
          </div>
        </div>
      </div>
    </footer>
  );
}
