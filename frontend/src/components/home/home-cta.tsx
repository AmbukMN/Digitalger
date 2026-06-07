'use client';

import { NewsletterSignup } from './newsletter-signup';

export function HomeCta() {
  return (
    <section className="py-8 sm:py-10 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-linear-to-r from-primary to-accent p-6 sm:p-8 md:p-12 text-primary-foreground flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">
              И-мэйлээ бүртгүүлээд 10% хөнгөлөлт аваарай 🎁
            </h2>
            <p className="mt-2 text-sm sm:text-base text-primary-foreground/80">
              Та мэйлээ бүртгүүлэхээр таны мэйл руу автоматаар 10%-н хөнглөлтийн купон код болон ҮНЭГҮЙ бүтээгдэхүүний татах линк очих болно. Та мэйлээ шалгаад татаж авах боломжтой!
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
            <NewsletterSignup />
          </div>
        </div>
      </div>
    </section>
  );
}
