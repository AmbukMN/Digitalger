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
const NAVY_DARK = '#011660';
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
  const headline = banner?.title ?? 'Дижитал бүтээгдэхүүний платформ';
  const subtitle =
    banner?.subtitle ?? 'Файл • Загвар • Сургалт • Дижитал бүтээгдэхүүн';

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
          background: NAVY_DARK,
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

        {/* ── Abstract background (when no banner image) ────────────────── */}
        {/* Base mesh gradient / dark overlay over banner image */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: hasImage
              ? 'linear-gradient(105deg, rgba(2,33,121,0.93) 0%, rgba(2,33,121,0.82) 45%, rgba(2,33,121,0.55) 100%)'
              : `linear-gradient(135deg, #010f44 0%, ${NAVY_DARK} 42%, ${NAVY} 80%, #0a3199 100%)`,
            display: 'flex',
          }}
        />

        {!hasImage && (
          <>
            {/* Gold mesh blob — top right */}
            <div
              style={{
                position: 'absolute',
                top: '-300px',
                right: '-180px',
                width: '800px',
                height: '800px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,190,0,0.22) 0%, rgba(255,190,0,0.05) 42%, transparent 70%)',
                display: 'flex',
              }}
            />
            {/* Blue mesh blob — bottom left */}
            <div
              style={{
                position: 'absolute',
                bottom: '-280px',
                left: '-200px',
                width: '720px',
                height: '720px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(40,110,235,0.42) 0%, rgba(40,110,235,0.08) 46%, transparent 72%)',
                display: 'flex',
              }}
            />
            {/* Dot grid texture */}
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
            {/* Concentric outlined rings — top right */}
            <div
              style={{
                position: 'absolute',
                top: '-180px',
                right: '60px',
                width: '480px',
                height: '480px',
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.06)',
                display: 'flex',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '-80px',
                right: '180px',
                width: '280px',
                height: '280px',
                borderRadius: '50%',
                border: '2px solid rgba(255,190,0,0.10)',
                display: 'flex',
              }}
            />
            {/* Tilted rounded square — bottom right */}
            <div
              style={{
                position: 'absolute',
                bottom: '-110px',
                right: '-60px',
                width: '340px',
                height: '340px',
                borderRadius: '64px',
                border: '2px solid rgba(255,255,255,0.05)',
                transform: 'rotate(26deg)',
                display: 'flex',
              }}
            />
          </>
        )}

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

        {/* ── Content ──────────────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            left: '72px',
            right: '72px',
            top: '60px',
            bottom: '58px',
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
                borderRadius: '18px',
                padding: '16px 28px',
                alignSelf: 'flex-start',
                boxShadow: '0 10px 34px rgba(0,0,0,0.35)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="DigitalGer" height={58} style={{ height: '58px' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '38px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                DigitalGer
              </span>
              <span style={{ fontSize: '15px', color: 'rgba(255,255,255,0.55)', marginTop: '4px' }}>
                digitalger.mn
              </span>
            </div>
          )}

          {/* Main headline — HERO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* Gold eyebrow accent line */}
            <div
              style={{
                width: '80px',
                height: '6px',
                borderRadius: '100px',
                background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`,
                display: 'flex',
              }}
            />
            <div
              style={{
                fontSize: headline.length > 40 ? '64px' : headline.length > 28 ? '76px' : '88px',
                fontWeight: '900',
                color: '#ffffff',
                lineHeight: 1.02,
                letterSpacing: '-2.5px',
                maxWidth: '960px',
                textShadow: '0 6px 40px rgba(0,0,0,0.45)',
                display: 'flex',
              }}
            >
              {headline}
            </div>
            <div
              style={{
                fontSize: '26px',
                color: 'rgba(255,255,255,0.74)',
                lineHeight: 1.4,
                maxWidth: '760px',
                display: 'flex',
              }}
            >
              {subtitle}
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
                  padding: '11px 24px',
                  borderRadius: '100px',
                  background: 'rgba(255,190,0,0.15)',
                  border: '1px solid rgba(255,190,0,0.45)',
                  color: GOLD,
                  fontSize: '16px',
                  fontWeight: '700',
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
            height: '5px',
            background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
            display: 'flex',
          }}
        />
      </div>
    ),
    { ...size, fonts },
  );
}
