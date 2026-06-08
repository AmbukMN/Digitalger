import { ImageResponse } from 'next/og';
import { loadOgFonts, loadOgLogo, OG_FONT_FAMILY } from '@/lib/og-fonts';

export const alt = 'DigitalGer ангилал';
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

type Props = { params: Promise<{ slug: string }> };

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const [category, fonts, logo] = await Promise.all([
    getCategory(slug),
    loadOgFonts(),
    loadOgLogo(),
  ]);

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
          flexDirection: 'column',
          fontFamily: OG_FONT_FAMILY,
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
            background: `linear-gradient(145deg, ${NAVY_DARK} 0%, ${NAVY} 55%, #0d3399 100%)`,
            display: 'flex',
          }}
        />

        {/* ── Decorative soft glows ─────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: '-220px',
            right: '-160px',
            width: '620px',
            height: '620px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,190,0,0.12) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-160px',
            left: '-120px',
            width: '460px',
            height: '460px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(26,92,200,0.28) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* ── Gold top accent bar ───────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '8px',
            background: `linear-gradient(90deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`,
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
            padding: '64px 72px 60px 72px',
          }}
        >
          {/* Brand row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {logo ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '14px 22px',
                  boxShadow: '0 8px 28px rgba(0,0,0,0.25)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt="DigitalGer" height={48} style={{ height: '48px' }} />
              </div>
            ) : (
              <span style={{ fontSize: '30px', fontWeight: 900, color: '#fff' }}>DigitalGer</span>
            )}

            {/* "Ангилал" badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '9px 20px',
                borderRadius: '100px',
                background: 'rgba(255,190,0,0.16)',
                border: `1px solid rgba(255,190,0,0.4)`,
                color: GOLD,
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '1px',
              }}
            >
              АНГИЛАЛ
            </div>
          </div>

          {/* Category name + description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '980px' }}>
            <div
              style={{
                fontSize: name.length > 24 ? '64px' : name.length > 14 ? '76px' : '88px',
                fontWeight: 900,
                color: '#ffffff',
                lineHeight: 1.05,
                letterSpacing: '-2px',
                display: 'flex',
              }}
            >
              {name}
            </div>

            {description && (
              <div
                style={{
                  fontSize: '24px',
                  color: 'rgba(255,255,255,0.62)',
                  lineHeight: 1.5,
                  fontWeight: 400,
                  display: 'flex',
                }}
              >
                {description.length > 120 ? description.slice(0, 120) + '…' : description}
              </div>
            )}
          </div>

          {/* Bottom stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            {productCount > 0 && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '44px', fontWeight: 900, color: GOLD, lineHeight: 1 }}>
                    {productCount}+
                  </span>
                  <span style={{ fontSize: '17px', color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                    бүтээгдэхүүн
                  </span>
                </div>
                <div style={{ width: '1px', height: '48px', background: 'rgba(255,255,255,0.18)', display: 'flex' }} />
              </>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '44px', fontWeight: 900, color: 'rgba(255,255,255,0.92)', lineHeight: 1 }}>
                4.8★
              </span>
              <span style={{ fontSize: '17px', color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                дундаж үнэлгээ
              </span>
            </div>
            <div style={{ flex: 1, display: 'flex' }} />
            <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.42)', fontWeight: 500, letterSpacing: '0.5px' }}>
              digitalger.mn
            </span>
          </div>
        </div>

        {/* ── Gold bottom bar ───────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '5px',
            background: `linear-gradient(90deg, ${GOLD}, transparent)`,
            display: 'flex',
          }}
        />
      </div>
    ),
    { ...size, fonts },
  );
}
