'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { CheckCircle2, Film, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { uploadImage, uploadVideo } from '@/lib/upload';
import { UploadProgress } from '@/components/upload-progress';

/**
 * Backdrop zone — зураг БОЛОН трейлер видео хоёуланг нэг slot-д зэрэг
 * удирдана (DigitalGer-ийн product gallery загвар): зураг сонговол шууд
 * WebP болгож R2-д, видео сонговол HLS queue-д (trailer) илгээнэ.
 */
export function BackdropMediaUpload({
  titleId,
  backdropUrl,
  onBackdropChange,
  trailerAvailable,
  onTrailerDone,
}: {
  titleId?: string;
  backdropUrl: string | null;
  onBackdropChange: (key: string, url: string) => void;
  trailerAvailable?: boolean;
  onTrailerDone?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<'image' | 'video' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Идэвхтэй upload-ыг цуцлах бариул
  const abortRef = useRef<(() => void) | null>(null);

  const handleFile = async (file: File) => {
    const isVideo = file.type.startsWith('video/');

    if (isVideo && !titleId) {
      toast.error('Эхлээд контентоо хадгална уу, дараа нь трейлер оруулна');
      return;
    }

    setMode(isVideo ? 'video' : 'image');
    setUploading(true);
    setProgress(0);

    try {
      if (isVideo) {
        const h = uploadVideo(file, { target: 'trailer', targetId: titleId! }, setProgress);
        abortRef.current = h.abort;
        await h.promise;
        onTrailerDone?.();
      } else {
        const h = uploadImage(file, 'backdrop', setProgress);
        abortRef.current = h.abort;
        const res = await h.promise;
        onBackdropChange(res.key, res.url);
      }
    } catch {
      // Алдаа/цуцлалтын toast-ыг helper дотор аль хэдийн харуулсан
    } finally {
      abortRef.current = null;
      setUploading(false);
      setMode(null);
      setProgress(0);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
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
          'relative aspect-video w-full overflow-hidden rounded-lg border border-dashed border-input bg-muted/30 transition-colors hover:border-primary',
        )}
      >
        {backdropUrl && !uploading ? (
          <Image src={backdropUrl} alt="" fill sizes="600px" className="object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
            {uploading ? (
              <>
                <Loader2 size={22} className="animate-spin" />
                <span className="text-xs">
                  {mode === 'video' ? 'Трейлер ачаалж байна' : 'Зураг ачаалж байна'}... {progress}%
                </span>
              </>
            ) : (
              <>
                <UploadCloud size={22} />
                <span className="text-xs">Зураг эсвэл видео (трейлер) сонгох</span>
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
          label={
            progress >= 100
              ? mode === 'video'
                ? 'HLS болгож байна...'
                : 'Боловсруулж байна...'
              : mode === 'video'
                ? 'Трейлер байршуулж байна...'
                : 'Зураг байршуулж байна...'
          }
          onCancel={progress < 100 ? () => abortRef.current?.() : undefined}
        />
      )}

      <div className="mt-2 flex items-center gap-1.5 text-xs">
        {trailerAvailable ? (
          <span className="flex items-center gap-1 text-success">
            <CheckCircle2 size={13} /> Трейлер бэлэн
          </span>
        ) : (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Film size={13} /> Трейлер оруулаагүй (заавал биш)
          </span>
        )}
      </div>
    </div>
  );
}
