'use client';

import { useSession } from 'next-auth/react';
import { AuthModal } from '@/components/auth/auth-modal';
import { useState } from 'react';
import { NewsletterSignup } from './newsletter-signup';

export function HomeCta() {
  const { status } = useSession();
  const isLoggedIn = status === 'authenticated';
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <section className="py-8 sm:py-10 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-linear-to-r from-primary to-accent p-6 sm:p-8 md:p-12 text-primary-foreground flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">
              Долоо хоног бүр шинэ бүтээгдэхүүн нэмэгддэг
            </h2>
            <p className="mt-2 text-sm sm:text-base text-primary-foreground/80">
              {isLoggedIn
                ? 'Шинэ бүтээгдэхүүн гарах бүрт хамгийн түрүүнд мэдэгдэнэ — Боломжийг бүү алд.'
                : 'Бүртгүүлээд 10% хөнгөлөлт авдаг. Шинэ бүтээгдэхүүн гарах бүрт хамгийн түрүүнд мэдэгдэнэ — Боломжийг бүү алд.'}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
            <NewsletterSignup />
            {!isLoggedIn && (
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="text-sm font-semibold text-primary-foreground/90 underline-offset-4 hover:text-white hover:underline"
              >
                Бүртгүүлээд 10% хөнгөлөлт авах →
              </button>
            )}
          </div>
        </div>
      </div>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultTab="signup"
        callbackUrl="/"
      />
    </section>
  );
}
