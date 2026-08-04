'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { toast } from 'sonner';

export function ShareButton({
  title,
  slug,
  compact,
}: {
  title: string;
  slug: string;
  /** ⚠️ Мобайлд гарчигийн хажууд — жижиг хэмжээ (h-9), зай хэмнэнэ */
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}/movie/${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // хэрэглэгч цуцалсан — clipboard fallback руу шилжихгүй
        return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Холбоос хууллаа');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={share}
      aria-label="Хуваалцах"
      title="Хуваалцах"
      className={
        compact
          ? 'flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 active:scale-95'
          : 'flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 active:scale-95'
      }
    >
      {copied ? <Check size={compact ? 16 : 18} /> : <Share2 size={compact ? 16 : 18} />}
    </button>
  );
}
