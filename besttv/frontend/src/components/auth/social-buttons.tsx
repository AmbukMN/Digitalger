'use client';

import { useEffect, useState } from 'react';
import { getProviders, signIn } from 'next-auth/react';
import { cn } from '@besttv/shared';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.47c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.89c2.28-2.1 3.59-5.2 3.59-8.83z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.89-3.02c-1.08.72-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.94H1.27v3.11C3.25 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.39-2.28V6.61H1.27A11.97 11.97 0 0 0 0 12c0 1.93.46 3.76 1.27 5.39l4.01-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77z"
      />
    </svg>
  );
}

/** Цэнхэр товчин дээр — цагаан дүрс (цэнхэр дүрс уусаж алга болно) */
function FacebookIconWhite() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}

/** Google/Facebook OAuth товч — .env-д Client ID/Secret байвал л харагдана */
export function SocialButtons({ callbackUrl = '/' }: { callbackUrl?: string }) {
  const [available, setAvailable] = useState<{ google: boolean; facebook: boolean } | null>(null);

  useEffect(() => {
    getProviders().then((providers) => {
      setAvailable({
        google: !!providers?.google,
        facebook: !!providers?.facebook,
      });
    });
  }, []);

  if (!available || (!available.google && !available.facebook)) return null;

  // Хоёулаа байвал ЗЭРЭГЦЭЭ (нэг мөрөнд), нэг нь л байвал бүтэн өргөн
  const both = available.google && available.facebook;

  return (
    <div className="space-y-2.5">
      {/* ⚠️ Хуваагч нь товчнуудын ДЭЭР — компонент формын доор байрладаг */}
      <div className="flex items-center gap-3 pb-1">
        <div className="h-px flex-1 bg-foreground/10" />
        <span className="text-xs text-foreground/35">эсвэл</span>
        <div className="h-px flex-1 bg-foreground/10" />
      </div>

      <div className={cn('grid gap-2.5', both ? 'grid-cols-2' : 'grid-cols-1')}>
        {available.google && (
          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl })}
            aria-label="Google-ээр нэвтрэх"
            className="flex items-center justify-center gap-2 rounded-lg border border-foreground/14 bg-foreground/95 py-2.5 text-sm font-semibold text-black transition-all hover:bg-white active:scale-[0.99]"
          >
            <GoogleIcon />
            {/* Зэрэгцээ үед богино нэр (хоёр товч тэнцүү өргөнтэй байлгана) */}
            <span>{both ? 'Google' : 'Google-ээр нэвтрэх'}</span>
          </button>
        )}
        {available.facebook && (
          <button
            type="button"
            onClick={() => signIn('facebook', { callbackUrl })}
            aria-label="Facebook-ээр нэвтрэх"
            className="flex items-center justify-center gap-2 rounded-lg bg-[#1877F2] py-2.5 text-sm font-semibold text-foreground transition-all hover:brightness-110 active:scale-[0.99]"
          >
            <FacebookIconWhite />
            <span>{both ? 'Facebook' : 'Facebook-ээр нэвтрэх'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
