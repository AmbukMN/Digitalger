import { ImageResponse } from 'next/og';

/**
 * Сайтын НӨӨЦ OG зураг — динамикаар зурагдана. Хаяг: `/opengraph-image`
 *
 * ⚠️ Яагаад хэрэгтэй вэ: админ SEO-д зураг оруулаагүй бол `/movies`,
 * `/blog`, `/pricing` зэрэг жагсаалтын хуудсыг Facebook/Twitter-т
 * хуваалцахад ЗУРАГГҮЙ, өнгөгүй линк гардаг байв.
 *
 * ⚠️⚠️ ЯАГААД `route.tsx` (route handler) болгосон бэ — `opengraph-image.tsx`
 * БИШ:
 *
 * БОДИТ АЛДАА: Next-ийн ФАЙЛЫН КОНВЕНЦ ёсоор `app/opengraph-image.tsx`
 * байвал Next нь тухайн segment-ийн `metadata.openGraph.images`-ыг
 * ЧИМЭЭГҮЙ ДАРЖ БИЧДЭГ. Тиймээс админ панелиас Open Graph зураг
 * тохируулсан ч нүүр хуудсанд ҮРГЭЛЖ энэ кодоор зурсан зураг гарч
 * байв (`og:image=/opengraph-image?<хэш>`) — админ юу ч хийсэн
 * өөрчлөгдөхгүй.
 *
 * ⚠️ Дэд хуудсууд (`/movies` г.м.) нөлөөлөөгүй нь тэдэнд өөрийн
 *    `opengraph-image` файл БАЙХГҮЙ учраас — зөвхөн НҮҮР л эвдэрсэн.
 *
 * Route handler болгосноор конвенц идэвхжихгүй: хаяг ЯГ ХЭВЭЭР ажиллана
 * (`${SITE_URL}/opengraph-image`), гэхдээ metadata-г дарахаа болино.
 * Одоо эрэмбэ зөв: админы зураг → энэ нөөц.
 */
export const runtime = 'edge';

const SIZE = { width: 1200, height: 630 };

export async function GET() {
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
          /* ⚠️ BestFilm-ийн улаан (#F80010) руу татсан градиент */
          background: 'linear-gradient(135deg, #0a0a0f 0%, #16161f 55%, #2e0a0e 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/*
          ⚠️⚠️ «Best» + «Film» — BestTV-д «TV» байсан.
          Facebook/Twitter-т хуваалцахад БУРУУ БРЭНД харагдах байв.

          ⚠️ Логоны PNG-г ЭНД ХЭРЭГЛЭХГҮЙ: `next/og` нь гадаад
          зургийг татахад build/runtime-д сүлжээ шаардана. Текст
          хувилбар нь ҮРГЭЛЖ ажиллана (BestTV-ийн шийдэлтэй ижил).
        */}
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontSize: 128, fontWeight: 900, color: '#F8F8F8', letterSpacing: -4 }}>
            best
          </span>
          <span style={{ fontSize: 128, fontWeight: 900, color: '#F80010', letterSpacing: -4 }}>
            Film
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
            background: '#F80010',
          }}
        />
      </div>
    ),
    SIZE,
  );
}
