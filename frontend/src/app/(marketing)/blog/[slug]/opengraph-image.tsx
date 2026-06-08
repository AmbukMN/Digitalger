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
  // → ямар ч aspect ratio-д бүх агуулга харагдана, crop болохгүй
  if (post?.coverImageUrl) {
    return new ImageResponse(
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: NAVY }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.coverImageUrl} alt="" width={1200} height={630}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(28px) brightness(0.55) saturate(1.2)', transform: 'scale(1.08)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,33,121,0.35)', display: 'flex' }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.coverImageUrl} alt={post.title} width={1200} height={630}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      </div>,
      { ...size },
    );
  }

  const title = post?.title ?? 'DigitalGer блог';
  const excerpt = post?.excerpt ? clamp(post.excerpt, 130) : '';
  const author = post?.authorName ?? 'DigitalGer';
  const date = formatDate(post?.publishedAt ?? post?.createdAt);
  const cover = null;
  const tags = (post?.tags ?? []).slice(0, 3);
  const hasImage = false;

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
        {/* ── Cover image (full bleed background) ──────────────────────── */}
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover!}
            alt=""
            width={1200}
            height={630}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center top',
            }}
          />
        )}

        {/* ── Gradient overlays ─────────────────────────────────────────── */}
        {/* Dark base layer */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: hasImage
              ? 'rgba(2,33,121,0.72)'
              : `linear-gradient(160deg, #011660 0%, ${NAVY} 50%, #0b2d8a 100%)`,
            display: 'flex',
          }}
        />
        {/* Bottom-up gradient so text is always readable */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(1,22,96,0.97) 0%, rgba(2,33,121,0.6) 45%, rgba(2,33,121,0.2) 100%)',
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
            height: '5px',
            background: `linear-gradient(90deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`,
            display: 'flex',
          }}
        />

        {/* ── Top: DigitalGer brand ─────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: '44px',
            left: '60px',
            right: '60px',
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
                borderRadius: '12px',
                padding: '10px 18px',
                boxShadow: '0 6px 22px rgba(0,0,0,0.28)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="DigitalGer" height={40} style={{ height: '40px' }} />
            </div>
          ) : (
            <span style={{ fontSize: '28px', fontWeight: 900, color: '#fff' }}>DigitalGer</span>
          )}

          {/* "Блог" label */}
          <div
            style={{
              padding: '6px 18px',
              borderRadius: '100px',
              background: 'rgba(255,190,0,0.18)',
              border: `1px solid rgba(255,190,0,0.45)`,
              color: GOLD,
              fontSize: '14px',
              fontWeight: '700',
              display: 'flex',
              letterSpacing: '0.5px',
            }}
          >
            БЛОГ
          </div>
        </div>

        {/* ── Center: Tags (optional) ───────────────────────────────────── */}
        {tags.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '60px',
              transform: 'translateY(-170px)',
              display: 'flex',
              gap: '8px',
            }}
          >
            {tags.map((tag) => (
              <div
                key={tag}
                style={{
                  padding: '4px 12px',
                  borderRadius: '100px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: '13px',
                  fontWeight: '500',
                  display: 'flex',
                }}
              >
                #{tag}
              </div>
            ))}
          </div>
        )}

        {/* ── Bottom: Article content ───────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            bottom: '52px',
            left: '60px',
            right: '60px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Title */}
          <div
            style={{
              fontSize: title.length > 60 ? '36px' : title.length > 40 ? '42px' : '48px',
              fontWeight: '900',
              color: '#ffffff',
              lineHeight: 1.15,
              letterSpacing: '-1px',
              maxWidth: '900px',
            }}
          >
            {clamp(title, 80)}
          </div>

          {/* Excerpt */}
          {excerpt && (
            <div
              style={{
                fontSize: '17px',
                color: 'rgba(255,255,255,0.62)',
                lineHeight: 1.5,
                maxWidth: '820px',
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
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: '800',
                color: NAVY,
                flexShrink: 0,
              }}
            >
              {author.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <span style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>
                {author}
              </span>
              {date && (
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>
                  {date}
                </span>
              )}
            </div>
            {/* Vertical divider */}
            <div
              style={{
                width: '1px',
                height: '32px',
                background: 'rgba(255,255,255,0.18)',
                display: 'flex',
                marginLeft: '4px',
              }}
            />
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.3px' }}>
              digitalger.mn
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
