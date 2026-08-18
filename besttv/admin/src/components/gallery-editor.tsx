'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadImage } from '@/lib/upload';

export interface GalleryEntry {
  key: string;
  url: string | null;
  /**
   * ⚠️ Видеоны thumbnail (`<key>.poster.jpg`). `<video>` тагийн эхний
   * кадр нь browser/codec-ээс хамаарч ХАРАГДАХГҮЙ байж болох тул
   * `poster` атрибутад өгнө.
   */
  posterUrl?: string | null;
}

/**
 * ⚠️⚠️ ВИДЕО ЭСЭХ — `next/image` нь `.mp4`-ыг харуулж ЧАДАХГҮЙ.
 *
 * БОДИТ АЛДАА: Facebook-ээс импортолсон постуудын ИХЭНХ нь видео
 * атал галерей нь бүгдийг `<Image>`-ээр харуулдаг байсан тул
 * АГУУЛГАГҮЙ хар дөрвөлжин гарч, админ «видео орж ирээгүй» гэж
 * бодох болов. Бодит байдал дээр R2-д хадгалагдсан байсан.
 */
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|avi|mkv)$/i;

export function isVideoEntry(e: { key: string }): boolean {
  return VIDEO_EXT.test(e.key);
}

export function GalleryEditor({
  images,
  onChange,
}: {
  images: GalleryEntry[];
  onChange: (images: GalleryEntry[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // Олон файлын нийт явц (3/7 гэх мэт)
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);

  const upload = async (files: FileList) => {
    const list = Array.from(files);
    setUploading(true);
    setDone(0);
    setTotal(list.length);
    try {
      const uploaded: GalleryEntry[] = [];
      // ⚠️ Дараалан — зэрэг явуулбал progress toast-ууд зөрчилдөнө
      for (let i = 0; i < list.length; i++) {
        try {
          const res = await uploadImage(list[i], 'gallery').promise;
          uploaded.push({ key: res.key, url: res.url });
        } catch {
          // Нэг файл унасан ч бусдыг үргэлжлүүлнэ
        }
        setDone(i + 1);
      }
      if (uploaded.length) onChange([...images, ...uploaded]);
      if (list.length > 1) {
        toast.success(`${uploaded.length}/${list.length} зураг нэмэгдлээ`);
      }
    } finally {
      setTotal(0);
      setDone(0);
      setUploading(false);
    }
  };

  const remove = (i: number) => onChange(images.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-wrap gap-3">
      {images.map((img, i) => (
        <div key={img.key} className="group relative h-24 w-40 shrink-0 overflow-hidden rounded-md bg-muted">
          {img.url &&
            (isVideoEntry(img) ? (
              /* ⚠️ `preload="metadata"` — эхний кадрыг л татна, бүтэн
                 видеог БИШ (10 видеотой хуудас 500МБ татахгүй) */
              <video
                src={img.url}
                poster={img.posterUrl ?? undefined}
                muted
                playsInline
                controls
                preload="metadata"
                className="h-full w-full object-cover"
              />
            ) : (
              <Image src={img.url} alt="" fill sizes="160px" className="object-cover" />
            ))}
          {isVideoEntry(img) && (
            <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
              ВИДЕО
            </span>
          )}
          <button
            type="button"
            onClick={() => remove(i)}
            className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 group-hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) upload(e.target.files);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex h-24 w-40 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input bg-muted/30 text-muted-foreground hover:border-primary"
      >
        {uploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
        <span className="text-xs">
          {/* Олон файл байвал нийт явцыг харуулна (3/7) */}
          {uploading && total > 1 ? `${done}/${total} ачаалж байна` : 'Зураг нэмэх'}
        </span>
      </button>
    </div>
  );
}
