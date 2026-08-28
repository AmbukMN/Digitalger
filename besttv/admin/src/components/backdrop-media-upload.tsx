'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Loader2, UploadCloud } from 'lucide-react';
import { cn } from '@besttv/shared';
import { uploadImage } from '@/lib/upload';
import { UploadProgress } from '@/components/upload-progress';

/**
 * Backdrop zone — 16:9 hero зураг.
 *
 * ⚠️⚠️ ТРЕЙЛЕР ЭНДЭЭС ХАСАГДСАН (`trailer-field.tsx` руу).
 *
 * Өмнө нь энэ slot нь зураг БОЛОН трейлер видео хоёуланг хүлээж авдаг
 * байв. Үр дүнд:
 *   · Админ трейлер оруулж болохыг МЭДЭХГҮЙ (зөвхөн «Зураг эсвэл видео»
 *     гэсэн бүдэг бичиг), тиймээс 185 кинооос ердөө 1 нь л трейлертэй.
 *   · Байршуулсан трейлерийг СОЛИХ/УСТГАХ ямар ч зам байгаагүй.
 *   · YouTube талбар тусдаа доор сууж, аль нь тоглохыг таамаглах ёстой.
 *
 * Одоо энэ нь ЗӨВХӨН зураг — трейлер нь өөрийн тодорхой хэсэгтэй.
 */
export function BackdropMediaUpload({
  backdropUrl,
  onBackdropChange,
}: {
  backdropUrl: string | null;
  onBackdropChange: (key: string, url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Идэвхтэй upload-ыг цуцлах бариул
  const abortRef = useRef<(() => void) | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setProgress(0);
    try {
      const h = uploadImage(file, 'backdrop', setProgress);
      abortRef.current = h.abort;
      const res = await h.promise;
      onBackdropChange(res.key, res.url);
    } catch {
      // Алдаа/цуцлалтын toast-ыг helper дотор аль хэдийн харуулсан
    } finally {
      abortRef.current = null;
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        /* ⚠️ ЗӨВХӨН зураг — видео нь трейлерийн хэсэгт орно */
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          'group relative aspect-video w-full overflow-hidden rounded-lg border border-dashed border-input bg-muted/30 transition-colors hover:border-primary',
        )}
      >
        {backdropUrl && !uploading ? (
          <>
            <Image src={backdropUrl} alt="" fill sizes="600px" className="object-cover" />
            {/*
              ⚠️ «СОЛИХ» ДАВХАРГА — `image-upload.tsx`-тэй ИЖИЛ шалтгаан:
              `<Image fill>` нь товчийг бүрэн бүрхэж, админ дарж болохыг
              МЭДЭХГҮЙ байв (постер дээр гарсан бодит гомдол).
              ⚠️ `pointer-events-none` — дарагдалт эцэг товч руу дамжина.
            */}
            <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <UploadCloud size={20} />
              <span className="text-xs font-medium">Зураг солих</span>
            </span>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
            {uploading ? (
              <>
                <Loader2 size={22} className="animate-spin" />
                <span className="text-xs">Зураг ачаалж байна... {progress}%</span>
              </>
            ) : (
              <>
                <UploadCloud size={22} />
                <span className="text-xs">Дэвсгэр зураг сонгох (16:9)</span>
              </>
            )}
          </div>
        )}
      </button>

      {/* Явцын мөр — цуцлах товчтой */}
      {uploading && (
        <UploadProgress
          className="mt-2"
          percent={progress}
          phase={progress >= 100 ? 'processing' : 'uploading'}
          label={progress >= 100 ? 'Боловсруулж байна...' : 'Зураг байршуулж байна...'}
          onCancel={progress < 100 ? () => abortRef.current?.() : undefined}
        />
      )}
    </div>
  );
}
