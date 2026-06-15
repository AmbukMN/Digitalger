import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadOgFonts, loadOgLogo, OG_FONT_FAMILY } from '@/lib/og-fonts';

export const alt = 'DigitalGer блог';
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

interface BlogPost {
  title: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  authorName: string;
  tags: string[];
}

async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${API_BASE}/api/blog/${slug}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('mn-MN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

function clamp(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + '…' : str;
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

/**
 * Cover зургийг сервер дээр урьдчилан татаж data URI болгоно.
 * ⚠️ Яагаад: ImageResponse дотор шууд <img src={R2_URL}> өгвөл next/og нь FB
 * crawl хийх агшинд R2 руу fetch хийдэг — R2 удаан/тасарвал OG зураг бүхэлдээ
 * ҮҮСЭХГҮЙ, Facebook ЦАГААН preview авдаг (SS5 facebook алдаа).
 * Тиймээс эндээ timeout-той татаж, АМЖИЛТТАЙ бол data URI (FB найдвартай авна),
 * амжилтгүй бол null → текст OG руу аюулгүй уналт хийнэ.
 */
async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3500), next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? 'image/jpeg';
    if (!type.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 6_000_000) return null; // хоосон/хэт том → текст OG
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ slug: string }> };

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const [post, fonts, logo] = await Promise.all([
    getBlogPost(slug),
    loadOgFonts(),
    loadOgLogo(),
  ]);

  // Post олдоогүй → static fallback OG зураг
  if (!post) {
    const fallbackSrc = await getFallbackImageData();
    if (fallbackSrc) {
      return new ImageResponse(
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fallbackSrc} alt="DigitalGer" width={1200} height={630} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />,
        { ...size },
      );
    }
  }

  // Cover image байвал letterbox: blur background + contain foreground
  // → ямар ч aspect ratio-д бүх агуулга харагдана, crop болохгүй.
  // Cover-ийг урьдчилан data URI болгож татна (R2 удаан байвал FB цагаан авахаас
  // сэргийлж). Татаж чадвал зурагтай OG, чадахгүй бол доорх текст OG руу унана.
  if (post?.coverImageUrl) {
    const coverData = await fetchImageAsDataUri(post.coverImageUrl);
    if (coverData) {
      return new ImageResponse(
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: NAVY }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverData} alt="" width={1200} height={630}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(28px) brightness(0.55) saturate(1.2)', transform: 'scale(1.08)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,33,121,0.35)', display: 'flex' }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverData} alt={post.title} width={1200} height={630}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        </div>,
        { ...size },
      );
    }
    // coverData=null → доорх текст (brand) OG руу унана (цагаан биш!)
  }

  const title = post?.title ?? 'DigitalGer блог';
  const excerpt = post?.excerpt ? clamp(post.excerpt, 150) : '';
  const author = post?.authorName ?? 'DigitalGer';
  const date = formatDate(post?.publishedAt ?? post?.createdAt);
  const tags = (post?.tags ?? []).slice(0, 3);

  // Hero гарчгийн хэмжээ — урт бол багасгана (2-3 мөр truncate)
  const titleLen = title.length;
  const titleSize =
    titleLen > 72 ? 48 : titleLen > 50 ? 58 : titleLen > 32 ? 68 : 78;

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
        {/* ── Abstract background ───────────────────────────────────────── */}
        {/* Base mesh gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(150deg, #010f44 0%, ${NAVY_DARK} 44%, ${NAVY} 80%, #0a3199 100%)`,
            display: 'flex',
          }}
        />
        {/* Gold mesh blob — top right */}
        <div
          style={{
            position: 'absolute',
            top: '-260px',
            right: '-160px',
            width: '720px',
            height: '720px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,190,0,0.20) 0%, rgba(255,190,0,0.04) 44%, transparent 70%)',
            display: 'flex',
          }}
        />
        {/* Blue mesh blob — bottom left */}
        <div
          style={{
            position: 'absolute',
            bottom: '-240px',
            left: '-160px',
            width: '640px',
            height: '640px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(40,110,235,0.38) 0%, rgba(40,110,235,0.07) 46%, transparent 72%)',
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
            top: '-150px',
            right: '90px',
            width: '420px',
            height: '420px',
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.06)',
            display: 'flex',
          }}
        />
        {/* Tilted rounded square — bottom right */}
        <div
          style={{
            position: 'absolute',
            bottom: '-90px',
            right: '-60px',
            width: '300px',
            height: '300px',
            borderRadius: '56px',
            border: '2px solid rgba(255,190,0,0.08)',
            transform: 'rotate(24deg)',
            display: 'flex',
          }}
        />
        {/* Bottom-up readability gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(1,15,68,0.82) 0%, rgba(2,33,121,0.25) 50%, transparent 100%)',
            display: 'flex',
          }}
        />

        {/* ── Gold top accent ───────────────────────────────────────────── */}
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

        {/* ── Top: DigitalGer brand ─────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: '52px',
            left: '64px',
            right: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {logo ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#ffffff',
                borderRadius: '14px',
                padding: '12px 20px',
                boxShadow: '0 8px 28px rgba(0,0,0,0.32)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="DigitalGer" height={42} style={{ height: '42px' }} />
            </div>
          ) : (
            <span style={{ fontSize: '28px', fontWeight: 900, color: '#fff' }}>DigitalGer</span>
          )}

          {/* "Нийтлэл" label */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '10px 20px',
              borderRadius: '100px',
              background: 'rgba(255,190,0,0.14)',
              border: `1px solid rgba(255,190,0,0.45)`,
              boxShadow: '0 4px 20px rgba(255,190,0,0.12)',
              color: GOLD,
              fontSize: '15px',
              fontWeight: '800',
              letterSpacing: '2px',
            }}
          >
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: GOLD, display: 'flex' }} />
            НИЙТЛЭЛ
          </div>
        </div>

        {/* ── Bottom: Article content ───────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            bottom: '56px',
            left: '64px',
            right: '64px',
            display: 'flex',
            flexDirection: 'column',
            gap: '22px',
          }}
        >
          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: '10px' }}>
              {tags.map((tag) => (
                <div
                  key={tag}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '100px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: '15px',
                    fontWeight: '600',
                    display: 'flex',
                  }}
                >
                  #{tag}
                </div>
              ))}
            </div>
          )}

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

          {/* Title — HERO */}
          <div
            style={{
              fontSize: `${titleSize}px`,
              fontWeight: '900',
              color: '#ffffff',
              lineHeight: 1.08,
              letterSpacing: '-1.8px',
              maxWidth: '1020px',
              textShadow: '0 6px 40px rgba(0,0,0,0.45)',
              display: 'flex',
            }}
          >
            {clamp(title, 96)}
          </div>

          {/* Excerpt */}
          {excerpt && (
            <div
              style={{
                fontSize: '22px',
                color: 'rgba(255,255,255,0.66)',
                lineHeight: 1.45,
                maxWidth: '900px',
                display: 'flex',
              }}
            >
              {excerpt}
            </div>
          )}

          {/* Author + date divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginTop: '4px',
            }}
          >
            {/* Author avatar circle */}
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '19px',
                fontWeight: '900',
                color: NAVY,
                flexShrink: 0,
                boxShadow: '0 4px 16px rgba(255,190,0,0.3)',
              }}
            >
              {author.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>
                {author}
              </span>
              {date && (
                <span style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)' }}>
                  {date}
                </span>
              )}
            </div>
            {/* Vertical divider */}
            <div
              style={{
                width: '1px',
                height: '36px',
                background: 'rgba(255,255,255,0.18)',
                display: 'flex',
                marginLeft: '6px',
              }}
            />
            <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: '0.3px' }}>
              digitalger.mn
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
