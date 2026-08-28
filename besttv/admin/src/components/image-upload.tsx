'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Loader2, UploadCloud } from 'lucide-react';
import { uploadImage } from '@/lib/upload';
import { UploadProgress } from '@/components/upload-progress';

/** Poster/backdrop upload — жижиг зураг тул backend-ээр дамжина (sharp WebP хөрвүүлнэ) */
export function ImageUpload({
  kind,
  value,
  onChange,
  aspect = 'poster',
}: {
  kind: 'poster' | 'backdrop' | 'still' | 'gallery';
  value?: string | null;
  onChange: (key: string, url: string) => void;
  aspect?: 'poster' | 'backdrop';
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setProgress(0);
    try {
      const h = uploadImage(file, kind, setProgress);
      abortRef.current = h.abort;
      const res = await h.promise;
      onChange(res.key, res.url);
    } catch {
      // toast-ыг helper харуулсан
    } finally {
      abortRef.current = null;
      setProgress(0);
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`group relative w-full overflow-hidden rounded-md border border-dashed border-input bg-muted/30 hover:border-primary ${
          aspect === 'poster' ? 'aspect-2/3' : 'aspect-video'
        }`}
      >
        {value ? (
          <>
            <Image src={value} alt="" fill sizes="300px" className="object-cover" />
            {/*
              ⚠️⚠️ «СОЛИХ» ДАВХАРГА — зураг БАЙГАА үед ч солих боломжтой
              гэдгийг ХАРУУЛНА.

              БОДИТ ГОМДОЛ: постертой кинон дээр «зураг upload хийхээр
              орохгүй» — учир нь `<Image fill>` нь товчийг БҮРЭН бүрхэж,
              ямар ч тэмдэг үлдээдэггүй байв. Админ дарж болохыг мэдэхгүй,
              дарсан ч хариу өгсөн эсэх нь харагдахгүй.

              ⚠️ `pointer-events-none` — давхарга нь дарагдалтыг ЗАЛГИХГҮЙ,
                 эцэг `<button>` руу дамжуулна.
              ⚠️ Ачаалж байх үед ҮРГЭЛЖ харагдана (hover шаардахгүй) —
                 эс бөгөөс явц огт мэдэгдэхгүй.
            */}
            <span
              className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 text-white transition-opacity ${
                uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              {uploading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <UploadCloud size={20} />
              )}
              <span className="text-xs font-medium">
                {uploading ? `Ачаалж байна... ${progress}%` : 'Зураг солих'}
              </span>
            </span>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
            {uploading ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} />}
            <span className="text-xs">
              {uploading ? `Ачаалж байна... ${progress}%` : 'Зураг сонгох'}
            </span>
          </div>
        )}
      </button>

      {uploading && (
        <UploadProgress
          className="mt-2"
          percent={progress}
          phase={progress >= 100 ? 'processing' : 'uploading'}
          onCancel={progress < 100 ? () => abortRef.current?.() : undefined}
        />
      )}
    </div>
  );
}
