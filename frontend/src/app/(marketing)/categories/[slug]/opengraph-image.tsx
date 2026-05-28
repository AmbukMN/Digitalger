import { ImageResponse } from 'next/og';

export const alt = 'DigitalGer ангилал';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';

const API_BASE =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000';

// ── Brand ────────────────────────────────────────────────────────────────────
const NAVY = '#022179';
const NAVY_DARK = '#011660';
const GOLD = '#ffbe00';
const GOLD_LIGHT = '#ffd84d';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  _count?: { products: number };
}

async function getCategory(slug: string): Promise<Category | null> {
  try {
    const res = await fetch(`${API_BASE}/api/categories/${slug}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Product type icons for decorative grid
const TYPE_TILES = [
  { label: 'Файл', icon: '📄' },
  { label: 'Загвар', icon: '🎨' },
  { label: 'Курс', icon: '🎓' },
  { label: 'Видео', icon: '🎬' },
  { label: 'Баримт', icon: '📋' },
  { label: 'Хосолсон', icon: '📦' },
];

type Props = { params: Promise<{ slug: string }> };

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const category = await getCategory(slug);

  const name = category?.name ?? 'Ангилал';
  const description = category?.description ?? null;
  const productCount = category?._count?.products ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: NAVY_DARK,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* ── Background gradient ───────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(150deg, ${NAVY_DARK} 0%, ${NAVY} 55%, #0d3399 100%)`,
            display: 'flex',
          }}
        />

        {/* ── Decorative geometric shapes ───────────────────────────────── */}
        {/* Large circle top-right */}
        <div
          style={{
            position: 'absolute',
            top: '-180px',
            right: '-180px',
            width: '540px',
            height: '540px',
            borderRadius: '50%',
            border: `2px solid rgba(255,190,0,0.12)`,
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-120px',
            width: '380px',
            height: '380px',
            borderRadius: '50%',
            border: `1px solid rgba(255,190,0,0.08)`,
            display: 'flex',
          }}
        />
        {/* Gold glow */}
        <div
          style={{
            position: 'absolute',
            top: '-80px',
            right: '80px',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,190,0,0.1) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        {/* Bottom-left glow */}
        <div
          style={{
            position: 'absolute',
            bottom: '-100px',
            left: '-60px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(26,92,200,0.25) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* ── Right: decorative product type tiles ─────────────────────── */}
        <div
          style={{
            position: 'absolute',
            right: '60px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {[TYPE_TILES.slice(0, 3), TYPE_TILES.slice(3, 6)].map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: '12px' }}>
              {row.map((tile) => (
                <div
                  key={tile.label}
                  style={{
                    width: '120px',
                    height: '90px',
                    borderRadius: '16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{ fontSize: '26px', lineHeight: 1 }}>{tile.icon}</span>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontWeight: '500' }}>
                    {tile.label}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ── Gold top accent bar ───────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            background: `linear-gradient(90deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`,
            display: 'flex',
          }}
        />

        {/* ── Left accent line ─────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: '60px',
            left: 0,
            bottom: '60px',
            width: '5px',
            background: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`,
            borderRadius: '0 4px 4px 0',
            display: 'flex',
          }}
        />

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            left: '72px',
            right: '460px',
            top: '60px',
            bottom: '52px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Brand */}
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
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '22px', fontWeight: '800', color: '#fff', lineHeight: 1 }}>
                DigitalGer
              </span>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                digitalger.mn
              </span>
            </div>
          </div>

          {/* Category name + product count */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* "Ангилал" label */}
            <div
              style={{
                padding: '5px 14px',
                borderRadius: '100px',
                background: 'rgba(255,190,0,0.15)',
                border: `1px solid rgba(255,190,0,0.35)`,
                color: GOLD,
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignSelf: 'flex-start',
                letterSpacing: '0.8px',
              }}
            >
              АНГИЛАЛ
            </div>

            {/* Category name */}
            <div
              style={{
                fontSize: name.length > 20 ? '52px' : name.length > 14 ? '60px' : '68px',
                fontWeight: '900',
                color: '#ffffff',
                lineHeight: 1.05,
                letterSpacing: '-2px',
              }}
            >
              {name}
            </div>

            {/* Description */}
            {description && (
              <div
                style={{
                  fontSize: '18px',
                  color: 'rgba(255,255,255,0.58)',
                  lineHeight: 1.5,
                  maxWidth: '480px',
                }}
              >
                {description.length > 100 ? description.slice(0, 100) + '…' : description}
              </div>
            )}
          </div>

          {/* Bottom stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {productCount > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <span style={{ fontSize: '36px', fontWeight: '900', color: GOLD, lineHeight: 1 }}>
                  {productCount}+
                </span>
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>
                  бүтээгдэхүүн
                </span>
              </div>
            )}
            {productCount > 0 && (
              <div
                style={{
                  width: '1px',
                  height: '40px',
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex',
                }}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '36px', fontWeight: '900', color: 'rgba(255,255,255,0.8)', lineHeight: 1 }}>
                4.8★
              </span>
              <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>
                дундаж үнэлгээ
              </span>
            </div>
          </div>
        </div>

        {/* ── Gold bottom bar ───────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: `linear-gradient(90deg, ${GOLD}, transparent)`,
            display: 'flex',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
