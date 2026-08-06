'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { User } from 'lucide-react';
import type { CastMember } from '@/lib/queries';
import { useWheelScroll } from '@/lib/use-wheel-scroll';

export function CastRow({ cast }: { cast: CastMember[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Хулганы дугуйгаар хэвтээ гүйлгэнэ (desktop)
  useWheelScroll(trackRef);

  if (cast.length === 0) return null;

  return (
    <section aria-labelledby="cast-heading">
      <h2 id="cast-heading" className="mb-3 text-lg font-semibold text-foreground/95">
        Жүжигчид
      </h2>
      <div
        ref={trackRef}
        className="hide-scrollbar flex gap-4 overflow-x-auto pb-1">
        {cast.map((c, i) => (
          <div key={`${c.name}-${i}`} className="w-24 shrink-0 text-center">
            <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full bg-foreground/10">
              {c.photoUrl ? (
                <Image src={c.photoUrl} alt={c.name} fill sizes="96px" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-foreground/30">
                  <User size={32} />
                </div>
              )}
            </div>
            <p className="mt-2 truncate text-sm font-medium text-foreground/90">{c.name}</p>
            {c.character && <p className="truncate text-xs text-foreground/50">{c.character}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
