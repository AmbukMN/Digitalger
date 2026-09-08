'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@besttv/shared';

/**
 * Гэрэл/бараан горим сэлгэх товч (header-д).
 *
 * ⚠️⚠️ `mounted` ЗААВАЛ — сервер дээр идэвхтэй theme МЭДЭГДЭХГҮЙ
 * (localStorage зөвхөн браузарт байдаг). Шалгалтгүй бол сервер "dark"
 * гэж бодоод нар зурна, клиент "light" гэж бодоод сар зурж, React
 * hydration зөрчил өгнө. Тиймээс эхний render-д БАЙРЛАЛЫГ нь эзэлсэн
 * хоосон товч гаргаж, mount болсны дараа жинхэнэ дүрсийг харуулна
 * (ингэснээр layout ҮСРЭХГҮЙ).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme !== 'light';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      /* ⚠️ Хүрэх талбар ≥36px — мобайлд хуруугаар оноход хангалттай */
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground',
        className,
      )}
      aria-label={isDark ? 'Гэрэл горимд шилжих' : 'Бараан горимд шилжих'}
      title={isDark ? 'Гэрэл горим' : 'Бараан горим'}
    >
      {!mounted ? (
        /* Байрлал эзэлнэ — hydration хүртэл юу ч харагдахгүй */
        <span className="h-[18px] w-[18px]" />
      ) : isDark ? (
        <Sun size={18} />
      ) : (
        <Moon size={18} />
      )}
    </button>
  );
}
