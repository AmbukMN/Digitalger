import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

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
  const product = await getProduct(slug);

  // Product олдоогүй → static fallback OG зураг
  if (!product) {
    const fallbackSrc = await getFallbackImageData();
    if (fallbackSrc) {
      return new ImageResponse(
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fallbackSrc} alt="DigitalGer" width={1200} height={630} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />,
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
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>,
      { ...size },
    );
  }

  const title = product?.title ?? 'Дижитал бүтээгдэхүүн';
  const description = product
    ? clamp(stripHtml(product.description ?? ''), 110)
    : '';
  const price = product ? formatMNT(product.price) : '';
  const rating = product?.rating ?? 0;
  const ratingCount = product?.ratingCount ?? 0;
  const downloads = product?.downloadCount ?? 0;
  const typeLabel = product ? await getProductTypeLabel(product.type) : '';
  const thumbnail = product?.thumbnailUrl ?? null;
  const categoryName = product?.category?.name ?? null;

  // ── Star rendering (5 stars, filled vs outline) ──────────────────────────
  const fullStars = Math.round(rating);
  const stars = Array.from({ length: 5 }, (_, i) => i < fullStars ? '★' : '☆');

  // ── Content column width depends on whether thumbnail exists ─────────────
  const LEFT_W = thumbnail ? 580 : 1200;
  const RIGHT_W = thumbnail ? 620 : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: NAVY,
          overflow: 'hidden',
        }}
      >
        {/* ── LEFT: Content panel ──────────────────────────────────────── */}
        <div
          style={{
            width: `${LEFT_W}px`,
            minWidth: `${LEFT_W}px`,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '52px 52px 48px 60px',
            background: `linear-gradient(160deg, ${NAVY_DARK} 0%, ${NAVY} 60%, #0b2d8a 100%)`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Gold left accent line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: '5px',
              background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`,
              display: 'flex',
            }}
          />

          {/* Subtle glow */}
          <div
            style={{
              position: 'absolute',
              bottom: '-120px',
              right: '-80px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,190,0,0.07) 0%, transparent 70%)',
              display: 'flex',
            }}
          />

          {/* ── Brand ─────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: GOLD,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: '900',
                  color: NAVY,
                }}
              >
                DG
              </div>
              <span
                style={{
                  fontSize: '24px',
                  fontWeight: '800',
                  color: '#fff',
                  letterSpacing: '-0.3px',
                }}
              >
                DigitalGer
              </span>
            </div>
            {/* Type + category badge */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {categoryName && (
                <div
                  style={{
                    padding: '5px 14px',
                    borderRadius: '100px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '13px',
                    fontWeight: '500',
                    display: 'flex',
                  }}
                >
                  {categoryName}
                </div>
              )}
              {typeLabel && (
                <div
                  style={{
                    padding: '5px 14px',
                    borderRadius: '100px',
                    background: 'rgba(255,190,0,0.18)',
                    border: `1px solid rgba(255,190,0,0.4)`,
                    color: GOLD,
                    fontSize: '13px',
                    fontWeight: '600',
                    display: 'flex',
                  }}
                >
                  {typeLabel}
                </div>
              )}
            </div>
          </div>

          {/* ── Title + description ────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, justifyContent: 'center', padding: '24px 0' }}>
            <div
              style={{
                fontSize: title.length > 50 ? '30px' : title.length > 35 ? '35px' : '40px',
                fontWeight: '800',
                color: '#ffffff',
                lineHeight: 1.18,
                letterSpacing: '-0.8px',
              }}
            >
              {clamp(title, 70)}
            </div>
            {description && (
              <div
                style={{
                  fontSize: '16px',
                  color: 'rgba(255,255,255,0.58)',
                  lineHeight: 1.55,
                }}
              >
                {description}
              </div>
            )}
          </div>

          {/* ── Rating + price ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Stars row */}
            {rating > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {stars.map((s, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '22px',
                        color: s === '★' ? GOLD : 'rgba(255,255,255,0.2)',
                        lineHeight: 1,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: '18px', fontWeight: '700', color: GOLD }}>
                  {rating.toFixed(1)}
                </span>
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)' }}>
                  ({ratingCount.toLocaleString()} сэтгэгдэл)
                </span>
                {downloads > 0 && (
                  <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)', marginLeft: '8px' }}>
                    · {downloads.toLocaleString()} таталт
                  </span>
                )}
              </div>
            )}

            {/* Price row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span
                style={{
                  fontSize: '38px',
                  fontWeight: '900',
                  color: '#ffffff',
                  letterSpacing: '-1px',
                  lineHeight: 1,
                }}
              >
                {price}
              </span>
              <div
                style={{
                  padding: '8px 20px',
                  borderRadius: '100px',
                  background: GOLD,
                  color: NAVY,
                  fontSize: '14px',
                  fontWeight: '800',
                  display: 'flex',
                  letterSpacing: '0.3px',
                }}
              >
                Худалдан авах
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Thumbnail panel ───────────────────────────────────── */}
        {thumbnail && RIGHT_W > 0 && (
          <div
            style={{
              width: `${RIGHT_W}px`,
              height: '100%',
              display: 'flex',
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnail}
              alt={title}
              width={600}
              height={630}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
              }}
            />
            {/* Left-edge gradient blending into content panel */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '100px',
                background: `linear-gradient(to right, ${NAVY_DARK}, transparent)`,
                display: 'flex',
              }}
            />
            {/* Bottom-left price badge (redundancy for visual scan) */}
            <div
              style={{
                position: 'absolute',
                bottom: '28px',
                right: '28px',
                padding: '10px 22px',
                borderRadius: '14px',
                background: 'rgba(2,33,121,0.88)',
                border: `1px solid rgba(255,190,0,0.4)`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '2px',
              }}
            >
              <span style={{ fontSize: '22px', fontWeight: '900', color: '#fff', lineHeight: 1 }}>
                {price}
              </span>
              {rating > 0 && (
                <span style={{ fontSize: '13px', color: GOLD }}>
                  {stars.slice(0, Math.round(rating)).join('')} {rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Fallback pattern when no thumbnail ───────────────────────── */}
        {!thumbnail && (
          <div
            style={{
              position: 'absolute',
              right: '80px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '180px',
              fontWeight: '900',
              color: 'rgba(255,190,0,0.06)',
              display: 'flex',
              letterSpacing: '-4px',
            }}
          >
            DG
          </div>
        )}

        {/* ── Gold top bar ─────────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '5px',
            background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`,
            display: 'flex',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
