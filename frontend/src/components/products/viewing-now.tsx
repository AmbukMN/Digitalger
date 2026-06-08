'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

interface ViewingNowProps {
  /** product id/slug — энэ seed-ээс тогтвортой тоо тооцоолно (product бүрд өөр) */
  seed: string;
  className?: string;
}

/** String seed-ээс тогтвортой hash (refresh болгонд их өөрчлөгдөхгүй) */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Хуурамч social-proof urgency badge — "🟢 {N} хүн үзэж байна".
 * N нь 3-12 хооронд, product seed-ээс тогтвортой (refresh болгонд тогтвортой,
 * гэхдээ product бүрд өөр). Хэрэглэгч санаатай хүссэн urgency badge.
 *
 * SSR/CSR hydration зөрөхөөс сэргийлж эхэндээ render хийхгүй (mount-ийн дараа л).
 */
export function ViewingNow({ seed, className = '' }: ViewingNowProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const count = useMemo(() => {
    // 3..12 хооронд (10 утга)
    return 3 + (hashSeed(seed) % 10);
  }, [seed]);

  if (!mounted) return null;

  return (
    <div
      className={`flex items-center gap-1 sm:gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 sm:px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0">
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full bg-emerald-500"
          animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className="relative inline-flex h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-500" />
      </span>
      <span>{count} хүн үзэж байна</span>
    </div>
  );
}
