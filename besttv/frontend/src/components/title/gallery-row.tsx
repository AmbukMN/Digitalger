'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useWheelScroll } from '@/lib/use-wheel-scroll';

export function GalleryRow({ images }: { images: (string | null)[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Хулганы дугуйгаар хэвтээ гүйлгэнэ (desktop)
  useWheelScroll(trackRef);

  const [active, setActive] = useState<string | null>(null);
  const valid = images.filter((u): u is string => !!u);
  if (valid.length === 0) return null;

  return (
    <section aria-labelledby="gallery-heading">
      <h2 id="gallery-heading" className="mb-3 text-lg font-semibold text-foreground/95">
        Зургийн цомог
      </h2>
      <div
        ref={trackRef}
        className="hide-scrollbar flex gap-3 overflow-x-auto pb-1">
        {valid.map((url, i) => (
          <button
            key={url}
            onClick={() => setActive(url)}
            aria-label={`Зураг ${i + 1}-г томруулж харах`}
            className="relative h-32 w-56 shrink-0 overflow-hidden rounded-md bg-foreground/10"
          >
            <Image src={url} alt={`Зураг ${i + 1}`} fill sizes="224px" className="object-cover" />
          </button>
        ))}
      </div>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setActive(null)}
        >
          <button
            onClick={() => setActive(null)}
            aria-label="Хаах"
            className="absolute right-4 top-4 rounded-full bg-foreground/10 p-2 text-foreground hover:bg-foreground/20"
          >
            <X size={22} />
          </button>
          <div className="relative h-[80vh] w-full max-w-4xl">
            <Image src={active} alt="" fill sizes="90vw" className="object-contain" />
          </div>
        </div>
      )}
    </section>
  );
}
