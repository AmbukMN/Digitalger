import { ImageResponse } from 'next/og';

/**
 * Сайтын АНХДАГЧ OG зураг — динамикаар үүснэ.
 *
 * ⚠️ Яагаад хэрэгтэй вэ: SEO тохиргоонд ogImageUrl нь null байсан тул
 * /movies, /blog, /pricing зэрэг жагсаалтын хуудсыг Facebook/Twitter-т
 * хуваалцахад ЗУРАГГҮЙ, өнгөгүй линк гардаг байв.
 *
 * Админ SEO-д зураг оруулбал ТЭР давуу — энэ нь зөвхөн fallback.
 */
export const runtime = 'edge';
export const alt = 'BestTV — Үз, мэдэр, дахин үз';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #16161f 55%, #2a1015 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontSize: 128, fontWeight: 900, color: '#fff', letterSpacing: -4 }}>
            Best
          </span>
          <span style={{ fontSize: 128, fontWeight: 900, color: '#e11d48', letterSpacing: -4 }}>
            TV
          </span>
        </div>
        <div style={{ marginTop: 24, fontSize: 40, color: 'rgba(255,255,255,0.72)' }}>
          Үз, мэдэр, дахин үз
        </div>
        <div style={{ marginTop: 14, fontSize: 26, color: 'rgba(255,255,255,0.42)' }}>
          Монголын киноны стриминг платформ
        </div>
        <div
          style={{
            marginTop: 48,
            width: 180,
            height: 5,
            borderRadius: 3,
            background: '#e11d48',
          }}
        />
      </div>
    ),
    size,
  );
}
