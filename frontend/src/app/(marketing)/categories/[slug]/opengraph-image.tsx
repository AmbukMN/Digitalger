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

  // Hero текстийн хэмжээ — урт нэрэнд багасгаж, бүх дэлгэцийг эзэлнэ
  const nameLen = name.length;
  const heroSize =
    nameLen > 28 ? 68 : nameLen > 20 ? 84 : nameLen > 12 ? 104 : 120;

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
        {/* ── Abstract background ───────────────────────────────────────── */}
        {/* Base mesh gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(135deg, #010f44 0%, ${NAVY_DARK} 40%, ${NAVY} 78%, #0a3199 100%)`,
            display: 'flex',
          }}
        />
        {/* Mesh blob — gold, top right */}
        <div
          style={{
            position: 'absolute',
            top: '-280px',
            right: '-200px',
            width: '760px',
            height: '760px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,190,0,0.22) 0%, rgba(255,190,0,0.05) 42%, transparent 70%)',
            display: 'flex',
          }}
        />
        {/* Mesh blob — blue, bottom left */}
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
        {/* Mesh blob — soft cyan accent center */}
        <div
          style={{
            position: 'absolute',
            top: '40%',
            left: '46%',
            width: '520px',
            height: '520px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(90,160,255,0.16) 0%, transparent 68%)',
            display: 'flex',
          }}
        />

        {/* Dot grid texture (SVG data-uri) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            opacity: 0.5,
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><circle cx='2' cy='2' r='1.4' fill='white' fill-opacity='0.10'/></svg>\")",
            backgroundRepeat: 'repeat',
          }}
        />

        {/* Diagonal geometric shapes — outlined rings */}
        <div
          style={{
            position: 'absolute',
            top: '-160px',
            right: '120px',
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
            right: '230px',
            width: '260px',
            height: '260px',
            borderRadius: '50%',
            border: '2px solid rgba(255,190,0,0.10)',
            display: 'flex',
          }}
        />
        {/* Tilted rounded square */}
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

        {/* ── Gold top accent bar ───────────────────────────────────────── */}
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
            padding: '60px 72px 58px 72px',
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
                  boxShadow: '0 10px 34px rgba(0,0,0,0.35)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt="DigitalGer" height={46} style={{ height: '46px' }} />
              </div>
            ) : (
              <span style={{ fontSize: '30px', fontWeight: 900, color: '#fff' }}>DigitalGer</span>
            )}

            {/* "Ангилал" badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '11px 22px',
                borderRadius: '100px',
                background: 'rgba(255,190,0,0.14)',
                border: `1px solid rgba(255,190,0,0.45)`,
                boxShadow: '0 4px 20px rgba(255,190,0,0.12)',
                color: GOLD,
                fontSize: '17px',
                fontWeight: 800,
                letterSpacing: '2px',
              }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: GOLD, display: 'flex' }} />
              АНГИЛАЛ
            </div>
          </div>

          {/* Category name + description — HERO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1040px' }}>
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
                fontSize: `${heroSize}px`,
                fontWeight: 900,
                color: '#ffffff',
                lineHeight: 1.0,
                letterSpacing: '-3px',
                textShadow: '0 6px 40px rgba(0,0,0,0.45)',
                display: 'flex',
              }}
            >
              {name}
            </div>

            {description && (
              <div
                style={{
                  fontSize: '26px',
                  color: 'rgba(255,255,255,0.66)',
                  lineHeight: 1.45,
                  fontWeight: 400,
                  maxWidth: '880px',
                  display: 'flex',
                }}
              >
                {description.length > 120 ? description.slice(0, 120) + '…' : description}
              </div>
            )}
          </div>

          {/* Bottom stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
            {productCount > 0 && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontSize: '48px', fontWeight: 900, color: GOLD, lineHeight: 1, letterSpacing: '-1px' }}>
                    {productCount}+
                  </span>
                  <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                    бүтээгдэхүүн
                  </span>
                </div>
                <div style={{ width: '1px', height: '54px', background: 'rgba(255,255,255,0.18)', display: 'flex' }} />
              </>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontSize: '48px', fontWeight: 900, color: 'rgba(255,255,255,0.94)', lineHeight: 1, letterSpacing: '-1px' }}>
                4.8★
              </span>
              <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                дундаж үнэлгээ
              </span>
            </div>
            <div style={{ flex: 1, display: 'flex' }} />
            <span style={{ fontSize: '19px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: '0.5px' }}>
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
