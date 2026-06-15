import Link from 'next/link';
import { SmartImage } from '@/components/ui/smart-image';
import { Avatar } from '@digitalger/shared/ui';
import { productsApi } from '@/lib/api';
import { SITE_URL } from '@/lib/constants';
import { PurchaseCard, MobileBuyBar } from '@/components/products/purchase-card';
import { ProductTitleActions } from '@/components/products/product-title-actions';
import { FaqAccordion } from '@/components/products/faq-accordion';
import { ReviewsSection } from '@/components/products/reviews-section';
import { TestimonialsGate } from '@/components/products/testimonials-gate';
import { MediaGallery } from '@/components/products/media-gallery';
import { CourseCurriculum } from '@/components/products/course-curriculum';
import { WatchCourseButton } from '@/components/products/watch-course-button';
import { BundleList } from '@/components/products/bundle-list';
import { DownloadAllButton } from '@/components/products/download-all-button';
import { ProductSwiper } from '@/components/products/product-swiper';
import {
  Star,
  Package,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Quote,
  Flame,
} from 'lucide-react';
import { ViewingNow } from '@/components/products/viewing-now';
import { formatPrice } from '@digitalger/shared';
import { sanitizeHtml } from '@/lib/safe-html';
import { ProductTracker } from '@/components/products/product-tracker';
import { RecentlyViewedSection } from '@/components/products/recently-viewed-section';
import { FreeSubscribeModal } from '@/components/products/free-subscribe-modal';
import { AdminOnlyBadge } from '@/components/products/admin-only-badge';

type ProductDetail = Awaited<ReturnType<typeof productsApi.bySlug>>;

function stripHtmlForMeta(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasRealContent(html: string | null | undefined): boolean {
  if (!html) return false;
  return html.replace(/<[^>]*>/g, '').trim().length > 0;
}

/**
 * Бүтээгдэхүүний дэлгэрэнгүй (detail) бүх UI-г render хийдэг хуваалцсан компонент.
 * - Public ISR static хуудас (`products/[slug]/page.tsx`) — token-гүй
 * - Admin preview dynamic хуудас (`products/[slug]/preview/page.tsx`) — token-тэй
 * хоёул энэ компонентыг ашиглана. Token-той эсэхээс хамаарахгүй ижил render.
 */
export function ProductDetailView({
  product,
  suggestedProducts,
}: {
  product: ProductDetail;
  suggestedProducts: Awaited<ReturnType<typeof productsApi.suggested>>;
}) {
  const hasFiles = product.files && product.files.length > 0;
  const allLessons = [
    ...(product.course?.lessons ?? []),
    ...(product.course?.modules?.flatMap((m) => m.lessons) ?? []),
  ];
  const hasLessons = allLessons.length > 0;
  const hasFaqs = product.faqs && product.faqs.length > 0;
  const hasTestimonials = product.testimonials && product.testimonials.length > 0;
  const hasProof = Boolean(product.proofQuote || product.proofImageUrl);
  const galleryItems = (product.images ?? []).map((img) => ({
    id: img.id,
    url: img.url,
    alt: img.alt,
    videoUrl: img.videoUrl ?? null,
    isPrimary: img.isPrimary,
  }));

  const canonicalUrl = `${SITE_URL}/products/${product.slug}`;
  const plainDesc = stripHtmlForMeta(product.description);

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: plainDesc.slice(0, 500),
    image: product.thumbnailUrl ?? undefined,
    url: canonicalUrl,
    sku: product.id,
    brand: { '@type': 'Organization', name: 'DigitalGer', url: SITE_URL },
    offers: {
      '@type': 'Offer',
      price: Number(product.price),
      priceCurrency: 'MNT',
      availability: 'https://schema.org/InStock',
      url: canonicalUrl,
      seller: { '@type': 'Organization', name: 'DigitalGer' },
    },
    ...(product.ratingCount > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.rating.toFixed(1),
        reviewCount: product.ratingCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };

  const breadcrumbItems = [
    { '@type': 'ListItem', position: 1, name: 'Нүүр', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Бүтээгдэхүүн', item: `${SITE_URL}/products` },
    ...(product.category
      ? [{ '@type': 'ListItem', position: 3, name: product.category.name, item: `${SITE_URL}/categories/${product.category.slug}` }]
      : []),
    { '@type': 'ListItem', position: product.category ? 4 : 3, name: product.title, item: canonicalUrl },
  ];

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  };

  const faqJsonLd = hasFaqs ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: product.faqs!.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  } : null;

  // Course JSON-LD — зөвхөн сургалт (LESSON) төрлийн бүтээгдэхүүнд.
  // Google Course rich result: name, description, provider ЗААВАЛ; offers/aggregateRating optional.
  // courseWorkload — хичээлийн нийт хугацааг ISO 8601 duration (PT#H#M) хэлбэрээр (байвал).
  const isLessonCourse = product.type === 'LESSON';
  const totalDurationSec = allLessons.reduce((sum, l) => sum + (l.durationSec ?? 0), 0);
  let courseWorkload: string | null = null;
  if (totalDurationSec > 0) {
    const hours = Math.floor(totalDurationSec / 3600);
    const minutes = Math.round((totalDurationSec % 3600) / 60);
    courseWorkload = `PT${hours > 0 ? `${hours}H` : ''}${minutes > 0 ? `${minutes}M` : ''}` || 'PT0M';
  }
  const courseDescription = (stripHtmlForMeta(
    (product as { seoDescription?: string }).seoDescription ?? product.description,
  )).slice(0, 500);
  const courseJsonLd = isLessonCourse ? {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: product.title,
    description: courseDescription,
    ...(product.thumbnailUrl ? { image: product.thumbnailUrl } : {}),
    url: canonicalUrl,
    provider: { '@type': 'Organization', name: 'DigitalGer', url: SITE_URL },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      ...(courseWorkload ? { courseWorkload } : {}),
    },
    offers: {
      '@type': 'Offer',
      price: Number(product.price) || 0,
      priceCurrency: 'MNT',
      availability: 'https://schema.org/InStock',
      url: canonicalUrl,
    },
    ...(product.ratingCount > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.rating.toFixed(1),
        reviewCount: product.ratingCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  } : null;

  const isFree = product.price == null || Number(product.price) === 0;

  return (
    <>
      <ProductTracker
        productId={product.id}
        productSlug={product.slug}
        price={Number(product.price) || 0}
        title={product.title}
        compareAtPrice={product.compareAtPrice != null ? Number(product.compareAtPrice) : null}
        thumbnailUrl={product.thumbnailUrl}
        type={product.type}
        featured={product.featured}
        rating={product.rating}
        ratingCount={product.ratingCount}
        downloadCount={product.downloadCount}
      />
      {/* Үнэгүй бүтээгдэхүүн дээр 2 сек дараа имэйл subscribe popup (7 хоногт 1 удаа) */}
      {isFree && <FreeSubscribeModal slug={product.slug} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />}
      {courseJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }} />}

      {/* Breadcrumb */}
      <div className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2.5">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Нүүр</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/products" className="hover:text-foreground transition-colors">Бүтээгдэхүүн</Link>
            {product.category && (
              <>
                <ChevronRight className="h-3 w-3" />
                <Link href={`/categories/${product.category.slug}`} className="hover:text-foreground transition-colors">
                  {product.category.name}
                </Link>
              </>
            )}
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium truncate max-w-48">{product.title}</span>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 pb-[calc(6rem+env(safe-area-inset-bottom,0))] md:pb-10">
        <div className="grid gap-8 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px]">
          {/* Left column */}
          <div className="space-y-8 min-w-0">
            {/* Media gallery */}
            <MediaGallery
              items={galleryItems}
              title={product.title}
              thumbnailUrl={product.thumbnailUrl}
              mainVideoUrl={product.videoUrl ?? null}
            />

            {/* Title + meta */}
            <div>
              {/* adminOnly бол ADMIN-д "Зөвхөн админд" badge (туршилтад ялгаж мэдэх) */}
              {product.adminOnly && (
                <div className="mb-2">
                  <AdminOnlyBadge adminOnly={product.adminOnly} />
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl font-bold leading-snug sm:text-3xl flex-1">{product.title}</h1>
                <ProductTitleActions product={product} />
              </div>

              {/* Rating + download + viewing-now row — mobile-д нэг мөрөнд багтана
                  (flex-nowrap + жижиг текст). Review нь гараар бус тул дарах/hover БАЙХГҮЙ. */}
              <div className="mt-2 sm:mt-3 flex items-center gap-1.5 sm:gap-3 text-[11px] sm:text-sm flex-nowrap">
                <div className="flex items-center gap-1 rounded-full bg-yellow-400/10 border border-yellow-400/25 px-2 sm:px-2.5 py-1 shrink-0">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-3 w-3 sm:h-4 sm:w-4 ${
                          star <= Math.round(product.rating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground/30'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-bold text-foreground">{product.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground">({product.ratingCount})</span>
                </div>
                {product.downloadCount > 0 && (
                  <div className="flex items-center gap-1 rounded-full bg-orange-500/10 border border-orange-500/25 px-2 sm:px-2.5 py-1 font-medium text-orange-600 dark:text-orange-400 shrink-0">
                    <Flame className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    {/* Сургалт (LESSON) бол "элссэн", бусад "татсан" (тоо хэвээр) */}
                    {product.downloadCount} {product.type === 'LESSON' ? 'элссэн' : 'татсан'}
                  </div>
                )}
                {/* Хуурамч social-proof urgency — "X хүн үзэж байна" (хэрэглэгч хүссэн).
                    Сургалт (LESSON) бол арай олон (10-20), бусад 3-12 (lesson prop). */}
                <ViewingNow seed={product.id} lesson={product.type === 'LESSON'} className="shrink-0" />
              </div>
              {/* Price — mobile only, shown below rating row */}
              <div className="mt-2 flex items-baseline gap-2 lg:hidden">
                {(product.price == null || Number(product.price) === 0) ? (
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">Үнэгүй</p>
                ) : (
                  <>
                    <p className="text-lg font-bold text-primary">{formatPrice(Number(product.price))}</p>
                    {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price) && (
                      <p className="text-sm text-muted-foreground line-through">{formatPrice(Number(product.compareAtPrice))}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            <section>
              <h2 className="text-lg font-bold mb-3">Бүтээгдэхүүний тухай</h2>
              {product.description.startsWith('<') ? (
                <div
                  className="prose prose-sm max-w-none text-muted-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
                />
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground text-sm sm:text-base">
                  {product.description}
                </p>
              )}
            </section>

            {/* What's included — зөвхөн whatsIncluded text байвал харуулна, bundle байвал file list давхарлахгүй */}
            {hasRealContent(product.whatsIncluded) && (
              <section className="rounded-2xl border border-border bg-muted/30 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Багцад юу багтсан вэ?
                  </h2>
                  {hasFiles && (!product.bundles || product.bundles.length === 0) && (
                    <DownloadAllButton
                      productId={product.id}
                      downloadFileKey={product.downloadFileKey}
                      zipName={`${product.slug}.zip`}
                    />
                  )}
                </div>
                {product.whatsIncluded && (
                  product.whatsIncluded.startsWith('<') ? (
                    <div
                      className="prose prose-sm max-w-none text-muted-foreground leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.whatsIncluded) }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {product.whatsIncluded}
                    </p>
                  )
                )}
              </section>
            )}

            {/* Course curriculum */}
            {hasLessons && (
              <section>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Хичээлийн хөтөлбөр
                  </h2>
                  <WatchCourseButton
                    productId={product.id}
                    productSlug={product.slug}
                    modules={product.course!.modules ?? []}
                    lessons={product.course!.lessons ?? []}
                  />
                </div>
                <CourseCurriculum
                  modules={product.course!.modules ?? []}
                  lessons={product.course!.lessons ?? []}
                  productId={product.id}
                  productSlug={product.slug}
                />
              </section>
            )}

            {/* Bundles — before how-to-use */}
            {product.bundles && product.bundles.length > 0 && (
              <BundleList
                bundles={product.bundles}
                productId={product.id}
                productFiles={product.files ?? []}
                isFree={product.price == null || Number(product.price) === 0}
              />
            )}

            {/* How to use — зөвхөн ҮНЭТЭЙ бүтээгдэхүүнд (үнэгүйд нуугдана) */}
            {Number(product.price) > 0 &&
              (product.howToUse || (product.howToUseSteps && product.howToUseSteps.length > 0)) && (
              <section>
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Хэрхэн ашиглах вэ?
                </h2>
                {product.howToUse && (
                  product.howToUse.startsWith('<') ? (
                    <div
                      className="prose prose-sm max-w-none text-muted-foreground leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.howToUse) }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground text-sm">{product.howToUse}</p>
                  )
                )}
                {product.howToUseSteps && product.howToUseSteps.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
                    {product.howToUseSteps.map((step, i) => (
                      <div key={i} className="rounded-xl border border-primary/15 bg-card p-5 shadow-sm">
                        <div className="mb-3 text-3xl font-black text-primary/50 leading-none tabular-nums">
                          {String(i + 1).padStart(2, '0')}
                        </div>
                        <h4 className="font-semibold text-sm mb-1">{step.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Testimonials — сургалтыг ХУДАЛДАЖ АВСАН үед нуудаг (gate, client) */}
            {hasTestimonials && (
              <TestimonialsGate
                productId={product.id}
                isLesson={product.type === 'LESSON'}
                testimonials={product.testimonials!}
              />
            )}

            {/* FAQ */}
            {hasFaqs && (
              <section>
                <div className="mb-4">
                  <h2 className="text-lg font-bold">Түгээмэл асуулт</h2>
                  <p className="text-xs text-muted-foreground mt-1">Таны дотоод эргэлзээг тайлж, бүх асуултад тодорхой хариулт өгье. Хэрвээ танд энд багтаагүй өөр нэмэлт асуулт гарвал <a href="mailto:info@digitalger.mn" className="text-primary hover:underline">info@digitalger.mn</a> хаягаар эсвэл баруун доод буланд байрлах AI чат зөвлөхтэй харилцаарай!</p>
                </div>
                <FaqAccordion faqs={product.faqs!} />
              </section>
            )}

            {/* Social proof — at the very bottom, below FAQ */}
            {hasProof && (
              <section className="rounded-2xl overflow-hidden border border-border bg-card shadow-sm">
                <div className="flex flex-row gap-0">
                  {product.proofImageUrl && (
                    <div className="w-36 sm:w-44 shrink-0">
                      <div className="relative h-full min-h-40 sm:min-h-48 overflow-hidden bg-muted">
                        <SmartImage
                          src={product.proofImageUrl}
                          alt={product.proofAuthorName ?? 'Social proof'}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 144px, 176px"
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex-1 px-4 py-5 sm:px-6 sm:py-7 flex flex-col justify-center gap-3">
                    <Quote className="h-7 w-7 text-primary/30 shrink-0" />
                    {product.proofQuote && (
                      <p className="text-sm sm:text-base lg:text-lg font-semibold leading-snug text-foreground">
                        {product.proofQuote}
                      </p>
                    )}
                    {product.proofText && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {product.proofText}
                      </p>
                    )}
                    {(product.proofAuthorName || product.proofAuthorRole) && (
                      <div className="flex items-center gap-2 mt-1">
                        {!product.proofImageUrl && (
                          <Avatar name={product.proofAuthorName} size={32} />
                        )}
                        <div>
                          {product.proofAuthorName && (
                            <p className="text-sm font-semibold">{product.proofAuthorName}</p>
                          )}
                          {product.proofAuthorRole && (
                            <p className="text-xs text-muted-foreground">{product.proofAuthorRole}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Reviews — нэвтэрсэн хэрэглэгч эхний сэтгэгдэл үлдээж болохоор үргэлж харуулна */}
            <div id="reviews">
              <ReviewsSection
                slug={product.slug}
                initialReviews={product.reviews ?? []}
                rating={product.rating}
                ratingCount={product.ratingCount}
              />
            </div>
          </div>

          {/* Right sidebar — md+ */}
          <div className="hidden md:block">
            <PurchaseCard product={product} />
          </div>
        </div>

        {/* Suggested products */}
        {suggestedProducts.length > 0 && (
          <div className="mt-12">
            <div className="h-px bg-border mb-8" />
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">Санал болгох бүтээгдэхүүн</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Ижил төрөл, ангиллын бүтээгдэхүүнүүд</p>
              </div>
              <div className="flex items-center gap-3">
                {product.category && (
                  <Link href={`/categories/${product.category.slug}`} className="text-sm text-primary hover:underline hidden sm:block">
                    {product.category.name} →
                  </Link>
                )}
                <Link href={`/products?type=${product.type}`} className="text-sm text-muted-foreground hover:text-primary hover:underline hidden sm:block">
                  Ижил төрлүүд →
                </Link>
              </div>
            </div>
            <ProductSwiper products={suggestedProducts} />
          </div>
        )}
      </div>

      {/* Таны саяхан үзсэн — localStorage (одоогийн product-ийг хасна, хоосон бол харагдахгүй) */}
      <RecentlyViewedSection excludeId={product.id} />

      {/* Mobile sticky bottom bar */}
      <MobileBuyBar product={product} />
    </>
  );
}
