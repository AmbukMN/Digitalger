import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadOgFonts, loadOgLogo, OG_FONT_FAMILY } from '@/lib/og-fonts';

export const alt = 'DigitalGer бүтээгдэхүүн';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

const API_BASE =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000';

// ── Brand ────────────────────────────────────────────────────────────────────
const NAVY = '#022179';
const NAVY_DARK = '#011660';
const GOLD = '#ffbe00';
const GOLD_LIGHT = '#ffd84d';

interface Product {
  title: string;
  description: string;
  price: number | string;
  compareAtPrice?: number | string | null;
  rating: number;
  ratingCount: number;
  downloadCount: number;
  thumbnailUrl: string | null;
  type: string;
  category?: { name: string } | null;
}

async function getProductTypeLabel(type: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/api/product-types`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return type;
    const list: { value: string; label: string }[] = await res.json();
    return list.find((t) => t.value === type)?.label ?? type;
  } catch {
    return type;
  }
}

async function getProduct(slug: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_BASE}/api/products/${slug}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatMNT(value: number | string): string {
  const n = Number(value);
  if (n === 0) return 'Үнэгүй';
  return `₮${n.toLocaleString('mn-MN')}`;
}

function clamp(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function getFallbackImageData(): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'brand', 'og-default.jpg');
    const buf = await readFile(filePath);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

type Props = { params: Promise<{ slug: string }> };

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const [product, fonts, logo] = await Promise.all([
    getProduct(slug),
    loadOgFonts(),
    loadOgLogo(),
  ]);

  // Product олдоогүй → static fallback OG зураг
  if (!product) {
    const fallbackSrc = await getFallbackImageData();
    if (fallbackSrc) {
      return new ImageResponse(
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fallbackSrc} alt="DigitalGer" width={1200} height={630} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />,
        { ...size },
      );
    }
  }

  // Thumbnail байвал letterbox: blur background + contain foreground
  // → ямар ч aspect ratio-д бүх агуулга харагдана, crop болохгүй
  if (product?.thumbnailUrl) {
    return new ImageResponse(
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: NAVY }}>
        {/* Blur background layer — fill the gaps with the same image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.thumbnailUrl} alt="" width={1200} height={630}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(28px) brightness(0.55) saturate(1.2)', transform: 'scale(1.08)' }} />
        {/* Dark overlay to improve contrast */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,33,121,0.35)', display: 'flex' }} />
        {/* Main image — cover, fills full 1200x630 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.thumbnailUrl} alt={product.title} width={1200} height={630}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      </div>,
      { ...size },
    );
  }

  const title = product?.title ?? 'Дижитал бүтээгдэхүүн';
  const description = product
    ? clamp(stripHtml(product.description ?? ''), 150)
    : '';
  const price = product ? formatMNT(product.price) : '';
  const compareAt = product?.compareAtPrice ? Number(product.compareAtPrice) : 0;
  const priceNum = product ? Number(product.price) : 0;
  const discountPct =
    compareAt > priceNum && compareAt > 0
      ? Math.round(((compareAt - priceNum) / compareAt) * 100)
      : 0;
  const rating = product?.rating ?? 0;
  const ratingCount = product?.ratingCount ?? 0;
  const downloads = product?.downloadCount ?? 0;
  const typeLabel = product ? await getProductTypeLabel(product.type) : '';
  const categoryName = product?.category?.name ?? null;

  // ── Star rendering (5 stars, filled vs outline) ──────────────────────────
  const fullStars = Math.round(rating);
  const stars = Array.from({ length: 5 }, (_, i) => i < fullStars ? '★' : '☆');

  // Hero нэрийн хэмжээ — бүх дэлгэцийг эзэлнэ
  const titleLen = title.length;
  const titleSize =
    titleLen > 60 ? 50 : titleLen > 42 ? 60 : titleLen > 26 ? 72 : 84;

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: OG_FONT_FAMILY,
          background: NAVY_DARK,
          overflow: 'hidden',
        }}
      >
        {/* ── Abstract background ───────────────────────────────────────── */}
        {/* Base mesh gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(140deg, #010f44 0%, ${NAVY_DARK} 42%, ${NAVY} 80%, #0a3199 100%)`,
            display: 'flex',
          }}
        />
        {/* Gold mesh blob — top right */}
        <div
          style={{
            position: 'absolute',
            top: '-280px',
            right: '-180px',
            width: '760px',
            height: '760px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,190,0,0.22) 0%, rgba(255,190,0,0.05) 42%, transparent 70%)',
            display: 'flex',
          }}
        />
        {/* Blue mesh blob — bottom left */}
        <div
          style={{
            position: 'absolute',
            bottom: '-260px',
            left: '-180px',
            width: '680px',
            height: '680px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(40,110,235,0.40) 0%, rgba(40,110,235,0.08) 45%, transparent 72%)',
            display: 'flex',
          }}
        />
        {/* Dot grid texture */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            opacity: 0.45,
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><circle cx='2' cy='2' r='1.4' fill='white' fill-opacity='0.10'/></svg>\")",
            backgroundRepeat: 'repeat',
          }}
        />
        {/* Concentric outlined rings — top right */}
        <div
          style={{
            position: 'absolute',
            top: '-160px',
            right: '110px',
            width: '440px',
            height: '440px',
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.06)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '-60px',
            right: '220px',
            width: '260px',
            height: '260px',
            borderRadius: '50%',
            border: '2px solid rgba(255,190,0,0.10)',
            display: 'flex',
          }}
        />
        {/* Tilted rounded square — bottom right */}
        <div
          style={{
            position: 'absolute',
            bottom: '-90px',
            right: '-70px',
            width: '320px',
            height: '320px',
            borderRadius: '60px',
            border: '2px solid rgba(255,255,255,0.05)',
            transform: 'rotate(28deg)',
            display: 'flex',
          }}
        />

        {/* ── Gold top bar ─────────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '8px',
            background: `linear-gradient(90deg, ${GOLD} 0%, ${GOLD_LIGHT} 55%, ${GOLD} 100%)`,
            display: 'flex',
          }}
        />

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div
          style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '58px 72px 56px 72px',
          }}
        >
          {/* ── Brand row ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {logo ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '14px 22px',
                  boxShadow: '0 10px 34px rgba(0,0,0,0.35)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt="DigitalGer" height={46} style={{ height: '46px' }} />
              </div>
            ) : (
              <span style={{ fontSize: '30px', fontWeight: 900, color: '#fff' }}>DigitalGer</span>
            )}
            {/* Category + type badge */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {categoryName && (
                <div
                  style={{
                    padding: '8px 18px',
                    borderRadius: '100px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.16)',
                    color: 'rgba(255,255,255,0.72)',
                    fontSize: '15px',
                    fontWeight: '600',
                    display: 'flex',
                  }}
                >
                  {categoryName}
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  padding: '9px 20px',
                  borderRadius: '100px',
                  background: 'rgba(255,190,0,0.14)',
                  border: `1px solid rgba(255,190,0,0.45)`,
                  boxShadow: '0 4px 20px rgba(255,190,0,0.12)',
                  color: GOLD,
                  fontSize: '15px',
                  fontWeight: '800',
                  letterSpacing: '1px',
                }}
              >
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: GOLD, display: 'flex' }} />
                {typeLabel || 'БҮТЭЭГДЭХҮҮН'}
              </div>
            </div>
          </div>

          {/* ── Title + description — HERO ─────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '1020px' }}>
            {/* Gold eyebrow accent line */}
            <div
              style={{
                width: '72px',
                height: '6px',
                borderRadius: '100px',
                background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`,
                display: 'flex',
              }}
            />
            <div
              style={{
                fontSize: `${titleSize}px`,
                fontWeight: '900',
                color: '#ffffff',
                lineHeight: 1.04,
                letterSpacing: '-2px',
                textShadow: '0 6px 40px rgba(0,0,0,0.45)',
                display: 'flex',
              }}
            >
              {clamp(title, 78)}
            </div>
            {description && (
              <div
                style={{
                  fontSize: '24px',
                  color: 'rgba(255,255,255,0.64)',
                  lineHeight: 1.45,
                  maxWidth: '880px',
                  display: 'flex',
                }}
              >
                {description}
              </div>
            )}
          </div>

          {/* ── Bottom: rating + price ────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Stars row */}
              {rating > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {stars.map((s, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '28px',
                          color: s === '★' ? GOLD : 'rgba(255,255,255,0.2)',
                          lineHeight: 1,
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <span style={{ fontSize: '22px', fontWeight: '800', color: GOLD }}>
                    {rating.toFixed(1)}
                  </span>
                  <span style={{ fontSize: '17px', color: 'rgba(255,255,255,0.5)' }}>
                    ({ratingCount.toLocaleString()} сэтгэгдэл)
                  </span>
                  {downloads > 0 && (
                    <span style={{ fontSize: '17px', color: 'rgba(255,255,255,0.4)', marginLeft: '6px' }}>
                      · {downloads.toLocaleString()} таталт
                    </span>
                  )}
                </div>
              )}

              {/* Price row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                <span
                  style={{
                    fontSize: '56px',
                    fontWeight: '900',
                    color: GOLD,
                    letterSpacing: '-1.5px',
                    lineHeight: 1,
                    textShadow: '0 4px 30px rgba(255,190,0,0.25)',
                    display: 'flex',
                  }}
                >
                  {price}
                </span>
                {compareAt > priceNum && (
                  <span
                    style={{
                      fontSize: '28px',
                      fontWeight: '500',
                      color: 'rgba(255,255,255,0.4)',
                      textDecoration: 'line-through',
                      lineHeight: 1,
                      display: 'flex',
                    }}
                  >
                    {formatMNT(compareAt)}
                  </span>
                )}
                {discountPct > 0 && (
                  <div
                    style={{
                      padding: '8px 18px',
                      borderRadius: '100px',
                      background: '#e11d48',
                      color: '#fff',
                      fontSize: '20px',
                      fontWeight: '900',
                      display: 'flex',
                      letterSpacing: '0.3px',
                    }}
                  >
                    -{discountPct}%
                  </div>
                )}
              </div>
            </div>

            {/* CTA + domain */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '14px' }}>
              <div
                style={{
                  padding: '14px 30px',
                  borderRadius: '100px',
                  background: GOLD,
                  color: NAVY,
                  fontSize: '20px',
                  fontWeight: '900',
                  display: 'flex',
                  letterSpacing: '0.3px',
                  boxShadow: '0 8px 28px rgba(255,190,0,0.3)',
                }}
              >
                Худалдан авах
              </div>
              <span style={{ fontSize: '17px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: '0.3px' }}>
                digitalger.mn
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
