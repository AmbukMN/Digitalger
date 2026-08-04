'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { getAccessToken } from '@/lib/api';

type Kind = 'movie' | 'episode' | 'trailer';

/**
 * АДМИН PREVIEW — байршуулсан видеогоо ШАЛГАХ.
 *
 * ⚠️ Яагаад тусдаа endpoint (/admin/stream/...) вэ:
 *   Нийтийн /stream нь эрх (багц/түрээс) шалгадаг тул админ өөрийн
 *   контентоо үзэхийн тулд багц худалдаж авах шаардлагатай болно.
 *   Админ preview нь ADMIN role-оор хамгаалагдана.
 *
 * ⚠️ Зөвхөн дарсны ДАРАА ачаална (lazy) — нэг хуудсанд 12 анги байхад
 *   бүгдийг зэрэг ачаалбал R2-оос олон зуун segment татаж эхэлнэ.
 */
export function VideoPreview({ kind, id }: { kind: Kind; id: string }) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!active || !videoRef.current) return;

    const video = videoRef.current;
    const token = getAccessToken();
    /**
     * ⚠️ SAME-ORIGIN — cross-origin үед hls.js-ийн `Authorization` header
     * preflight дээр алдагдаж 401 буцдаг (upload-тай яг ижил шалтгаан).
     * Next rewrite `/api/*`-ыг backend руу дамжуулна.
     */
    const src = `/api/admin/stream/${kind}/${id}/playlist.m3u8`;

    let hls: import('hls.js').default | null = null;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const HlsMod = (await import('hls.js')).default;
      if (cancelled) return;

      if (HlsMod.isSupported()) {
        hls = new HlsMod({
          // ⚠️ m3u8 нь Bearer token шаардана (segment нь presigned тул шаардахгүй)
          xhrSetup: (xhr, url) => {
            if (token && url.includes('/admin/stream/')) {
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
          },
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(HlsMod.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          video.play().catch(() => {
            /* autoplay блоклогдвол хэрэглэгч дарна */
          });
        });
        hls.on(HlsMod.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          setLoading(false);
          setError(
            data.response?.code === 404
              ? 'Видео олдсонгүй — хөрвүүлэлт дуусаагүй байж болно'
              : 'Видео ачаалахад алдаа гарлаа',
          );
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari — HLS-ийг өөрөө дэмжинэ (гэхдээ header тавих боломжгүй)
        video.src = src;
        setLoading(false);
      } else {
        setLoading(false);
        setError('Энэ браузер HLS дэмжихгүй');
      }
    })();

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [active, kind, id]);

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-muted/30 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
      >
        <Play size={14} /> Урьдчилан харах
      </button>
    );
  }

  return (
    <div className="mt-2">
      {/*
        ⚠️ `max-h` — модал доторх preview нь дэлгэцээс ХАЛЬДАГ байсан
        (aspect-video нь зөвхөн ӨРГӨНӨӨС тооцдог тул өндөр дэлгэцэнд
        60vh-аас өндөр болж, доод товчнууд харагдахаа болино).
        `object-contain` — өөр харьцаатай видеог тайрахгүй, бүтнээр нь багтаана.
      */}
      <div className="relative flex max-h-[60vh] items-center justify-center overflow-hidden rounded-md bg-black">
        <video
          ref={videoRef}
          controls
          playsInline
          className="max-h-[60vh] w-full object-contain"
          controlsList="nodownload"
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 size={22} className="animate-spin text-white" />
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-[11px] text-destructive">{error}</p>}
      <button
        type="button"
        onClick={() => setActive(false)}
        className="mt-1.5 text-[11px] text-muted-foreground hover:text-foreground"
      >
        Хаах
      </button>
    </div>
  );
}
