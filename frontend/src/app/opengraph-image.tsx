import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadOgFonts, loadOgLogo, OG_FONT_FAMILY } from '@/lib/og-fonts';

export const alt = 'DigitalGer — Монголын дижитал бүтээгдэхүүний marketplace';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

const API_BASE =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000';

interface Banner {
  title: string;
  subtitle: string | null;
  imageUrl: string;
}

interface PublicSettings {
  ogImageUrl?: string | null;
  metaTitle?: string | null;
  ogTitle?: string | null;
}

async function getPublicSettings(): Promise<PublicSettings | null> {
  try {
    const res = await fetch(`${API_BASE}/api/settings/public`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getHeroBanner(): Promise<Banner | null> {
  try {
    const res = await fetch(`${API_BASE}/api/banners`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data: Banner[] = await res.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch {
    return null;
  }
}

// ── Brand constants ──────────────────────────────────────────────────────────
const NAVY = '#022179';
const GOLD = '#ffbe00';
const GOLD_LIGHT = '#ffd84d';

async function getFallbackImageData(): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'brand', 'og-default.jpg');
    const buf = await readFile(filePath);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

export default async function Image() {
  const [settings, banner, fonts, logo] = await Promise.all([
    getPublicSettings(),
    getHeroBanner(),
    loadOgFonts(),
    loadOgLogo(),
  ]);

  // 1. Admin panel-аас upload хийсэн OG image байвал full-bleed ашиглана
  if (settings?.ogImageUrl) {
    return new ImageResponse(
      // eslint-disable-next-line @next/next/no-img-element
      <img src={settings.ogImageUrl} alt={alt} width={1200} height={630} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />,
      { ...size },
    );
  }

  // 2. Backend хариулаагүй, banner ч байхгүй → static fallback зураг (public/brand/og-default.jpg)
  if (!banner) {
    const fallbackSrc = await getFallbackImageData();
    if (fallbackSrc) {
      return new ImageResponse(
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fallbackSrc} alt={alt} width={1200} height={630} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />,
        { ...size },
      );
    }
  }

  const hasImage = !!banner?.imageUrl;

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          overflow: 'hidden',
          fontFamily: OG_FONT_FAMILY,
          background: NAVY,
        }}
      >
        {/* ── Hero background image ─────────────────────────────────────── */}
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner!.imageUrl}
            alt=""
            width={1200}
            height={630}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center',
            }}
          />
        )}

        {/* ── Dark gradient overlay for readability ────────────────────── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: hasImage
              ? 'linear-gradient(105deg, rgba(2,33,121,0.93) 0%, rgba(2,33,121,0.82) 45%, rgba(2,33,121,0.55) 100%)'
              : `linear-gradient(145deg, ${NAVY} 0%, #0d2d8a 50%, #1040a0 100%)`,
            display: 'flex',
          }}
        />

        {/* ── Subtle radial light at top-right ─────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: '-200px',
            right: '-100px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(255,190,0,0.08) 0%, transparent 70%)`,
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
            height: '6px',
            background: `linear-gradient(90deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`,
            display: 'flex',
          }}
        />

        {/* ── Content ──────────────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            left: '72px',
            right: '72px',
            top: '60px',
            bottom: '60px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Brand */}
          {logo ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#ffffff',
                borderRadius: '16px',
                padding: '14px 24px',
                alignSelf: 'flex-start',
                boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="DigitalGer" height={52} style={{ height: '52px' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '34px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                DigitalGer
              </span>
              <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', marginTop: '4px' }}>
                digitalger.mn
              </span>
            </div>
          )}

          {/* Main headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div
              style={{
                fontSize:
                  banner?.title && banner.title.length > 40 ? '48px' : '56px',
                fontWeight: '900',
                color: '#ffffff',
                lineHeight: 1.1,
                letterSpacing: '-1.5px',
                maxWidth: '860px',
              }}
            >
              {banner?.title ?? 'Монголын дижитал бүтээгдэхүүний marketplace'}
            </div>
            <div
              style={{
                fontSize: '22px',
                color: 'rgba(255,255,255,0.72)',
                lineHeight: 1.4,
                maxWidth: '720px',
              }}
            >
              {banner?.subtitle ?? 'Файл • Загвар • Курс • Дижитал бүтээгдэхүүн'}
            </div>
          </div>

          {/* Bottom pills */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'nowrap' }}>
            {[
              '500+ бүтээгдэхүүн',
              'Шууд татах',
              'QPay • Карт',
              '4.8★ үнэлгээ',
            ].map((label) => (
              <div
                key={label}
                style={{
                  padding: '9px 22px',
                  borderRadius: '100px',
                  background: 'rgba(255,190,0,0.15)',
                  border: '1px solid rgba(255,190,0,0.45)',
                  color: GOLD,
                  fontSize: '15px',
                  fontWeight: '600',
                  display: 'flex',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Gold bottom accent ────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
            display: 'flex',
          }}
        />
      </div>
    ),
    { ...size, fonts },
  );
}
