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
      } catch (e) {
        /**
         * ⚠️⚠️ ЦУЦАЛСАН ба БҮТЭЛГҮЙТСЭНИЙГ ЯЛГАНА.
         *
         * FB/IG webview-д `navigator.share` ОРШИН БАЙДАГ ч
         * `NotAllowedError` шидэж бүтэлгүйтдэг. Өмнө нь хоёуланг
         * чимээгүй залгидаг байсан тул хэрэглэгч товч дараад ЮУ Ч
         * болохгүй — «эвдэрсэн» гэж бодно.
         *
         * `AbortError` = хэрэглэгч өөрөө цуцалсан → юу ч хийхгүй зөв.
         * Бусад алдаа → clipboard руу унана.
         */
        if ((e as Error)?.name === 'AbortError') return;
      }
    }

    /* ⚠️ `clipboard` нь HTTPS-гүй / хуучин webview-д undefined —
       шалгалтгүй бол шидэгдээгүй TypeError болж дахин чимээгүй унана */
    try {
      if (!navigator.clipboard) throw new Error('clipboard дэмжигдэхгүй');
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Холбоос хууллаа');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info('Хуулж чадсангүй. Хаягийн мөрнөөс гараар хуулна уу.');
    }
  };

  return (
    <button
      onClick={share}
      aria-label="Хуваалцах"
      title="Хуваалцах"
      className={
        compact
          ? 'flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 text-foreground transition-all hover:bg-foreground/20 active:scale-95'
          : 'flex h-11 w-11 items-center justify-center rounded-full bg-foreground/10 text-foreground transition-all hover:bg-foreground/20 active:scale-95'
      }
    >
      {copied ? <Check size={compact ? 16 : 18} /> : <Share2 size={compact ? 16 : 18} />}
    </button>
  );
}
