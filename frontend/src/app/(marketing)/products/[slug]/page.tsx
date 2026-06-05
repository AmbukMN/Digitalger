import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@digitalger/shared/ui';
import { productsApi } from '@/lib/api';
import { SITE_URL } from '@/lib/constants';
import { PurchaseCard, MobileBuyBar } from '@/components/products/purchase-card';
import { ProductTitleActions } from '@/components/products/product-title-actions';
import { FaqAccordion } from '@/components/products/faq-accordion';
import { ReviewsSection } from '@/components/products/reviews-section';
import { ProductTestimonialsSection } from '@/components/products/testimonials-section';
import { MediaGallery } from '@/components/products/media-gallery';
import { CourseCurriculum } from '@/components/products/course-curriculum';
import { BundleList } from '@/components/products/bundle-list';
import { DownloadAllButton } from '@/components/products/download-all-button';
import { ProductSwiper } from '@/components/products/product-swiper';
import {
  Star,
  Download,
  FileText,
  Package,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Quote,
} from 'lucide-react';
import { formatPrice } from '@digitalger/shared';
import { sanitizeHtml } from '@/lib/safe-html';
import { ProductTracker } from '@/components/products/product-tracker';

type Props = { params: Promise<{ slug: string }> };

function stripHtmlForMeta(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await productsApi.bySlug(slug);
    const seo = product as { seoTitle?: string; seoDescription?: string };
    const title = seo.seoTitle ?? product.title;
    const rawDesc = seo.seoDescription ?? product.description;
    const description = stripHtmlForMeta(rawDesc).slice(0, 160);
    const canonicalUrl = `${SITE_URL}/products/${product.slug}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        type: 'website',
        title,
        description,
        url: canonicalUrl,
        ...(product.thumbnailUrl ? { images: [{ url: product.thumbnailUrl, alt: title }] } : {}),
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        ...(product.thumbnailUrl ? { images: [product.thumbnailUrl] } : {}),
      },
    };
  } catch {
    return { title: 'Бүтээгдэхүүн' };
  }
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hasRealContent(html: string | null | undefined): boolean {
  if (!html) return false;
  return html.replace(/<[^>]*>/g, '').trim().length > 0;
}


export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  let product: Awaited<ReturnType<typeof productsApi.bySlug>>;
  try {
    product = await productsApi.bySlug(slug);
  } catch {
    notFound();
  }

  const [suggestedProducts] = await Promise.all([
    productsApi.suggested(slug, 8).catch(() => []),
  ]);

  const hasFiles = product.files && product.files.length > 0;
  const allLessons = [
    ...(product.course?.lessons ?? []),
    ...(product.course?.modules?.flatMap((m) => m.lessons) ?? []),
  ];
  const hasLessons = allLessons.length > 0;
  const hasFaqs = product.faqs && product.faqs.length > 0;
  const hasReviews = product.reviews && product.reviews.length > 0;
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

  return (
    <>
      <ProductTracker productId={product.id} productSlug={product.slug} price={Number(product.price) || 0} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />}

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
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl font-bold leading-snug sm:text-3xl flex-1">{product.title}</h1>
                <ProductTitleActions product={product} />
              </div>

              {/* Rating + download row */}
              <div className="mt-2 sm:mt-3 flex items-center gap-2 sm:gap-4 text-xs sm:text-sm flex-nowrap overflow-hidden">
                <a href="#reviews" className="flex items-center gap-1 sm:gap-1.5 hover:opacity-80 transition-opacity shrink-0">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
                        star <= Math.round(product.rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground/30'
                      }`}
                    />
                  ))}
                  <span className="font-semibold">{product.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground">({product.ratingCount} үнэлгээ)</span>
                </a>
                <span className="text-muted-foreground/40 shrink-0">·</span>
                <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                  <Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {product.downloadCount} удаа татсан
                </div>
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
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Хичээлийн хөтөлбөр
                </h2>
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

            {/* Testimonials */}
            {hasTestimonials && (
              <section>
                <div className="mb-4">
                  <h2 className="text-lg font-bold">Худалдан авагчид юу гэж хэлэв?</h2>
                  <p className="text-xs text-muted-foreground mt-1">Мянга мянган хэрэглэгчид DigitalGer-ээр дамжуулан хэрэгтэй файл, сургалт, бэлэн шийдлүүдээ олж, цаг хугацаа болон зардлаа хэмнэж байна. Бодит хэрэглэгчдийн туршлага танд зөв сонголт хийхэд тусална.</p>
                </div>
                <ProductTestimonialsSection testimonials={product.testimonials!} />
              </section>
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
              <section className="rounded-2xl overflow-hidden border border-border bg-linear-to-br from-primary/5 via-card to-primary/3 shadow-sm">
                <div className="flex flex-row gap-0">
                  {product.proofImageUrl && (
                    <div className="w-36 sm:w-44 shrink-0">
                      <div className="relative h-full min-h-40 sm:min-h-48 overflow-hidden bg-muted">
                        <Image
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
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                            {product.proofAuthorName?.charAt(0) ?? '?'}
                          </div>
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

            {/* Reviews */}
            {hasReviews && (
              <div id="reviews">
                <ReviewsSection reviews={product.reviews!} rating={product.rating} ratingCount={product.ratingCount} />
              </div>
            )}
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

      {/* Mobile sticky bottom bar */}
      <MobileBuyBar product={product} />
    </>
  );
}
