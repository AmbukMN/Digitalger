'use client';

import { Button } from '@digitalger/shared/ui';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { AuthModal } from '@/components/auth/auth-modal';
import { useState } from 'react';

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
          <div className="flex gap-3 shrink-0 flex-wrap">
            {!isLoggedIn && (
              <Button
                size="lg"
                className="font-bold bg-[#ffbe00] text-[#022179] hover:bg-[#ffd84d] dark:bg-[#ffbe00] dark:text-[#022179] dark:hover:bg-[#ffd84d]"
                onClick={() => setAuthOpen(true)}
              >
                Бүртгүүлэх
              </Button>
            )}
            <Button asChild size="lg" className="bg-white/15 border border-white/40 text-white hover:bg-white/25 font-semibold">
              <Link href="/products">
                {isLoggedIn ? 'Бүтээгдэхүүн үзэх' : 'Бүтээгдэхүүн'}
              </Link>
            </Button>
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
