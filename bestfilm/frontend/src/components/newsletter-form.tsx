'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

/**
 * Мэдээллийн товхимолд бүртгүүлэх (footer).
 *
 * ⚠️ Идемпотент — аль хэдийн бүртгэлтэй хаяг ч алдаа өгөхгүй (жагсаалтад
 * хэн байгааг гуравдагч этгээдэд задлахгүйн тулд).
 */
export function NewsletterForm({ source = 'footer' }: { source?: string }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  /**
   * ⚠️ HONEYPOT — хүнд харагдахгүй талбар. Бот бүх input-ыг дүүргэдэг тул
   * энд утга орвол сервер талд шууд хаяна (хэрэглэгчид саад учруулахгүй).
   */
  const [website, setWebsite] = useState('');
  /** Форм анх render хийгдсэн мөч — бот шууд илгээхийг илрүүлнэ */
  const mountedAt = useRef(Date.now());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      toast.error('Имэйл хаяг буруу байна');
      return;
    }
    setBusy(true);
    try {
      await api('/email/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          email: value,
          source,
          website, // honeypot — хоосон байх ёстой
          elapsedMs: Date.now() - mountedAt.current,
        }),
      });
      setDone(true);
      setEmail('');
      toast.success('Баярлалаа! Бүртгэгдлээ');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-success sm:text-sm">
        <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> Бүртгэгдлээ
      </p>
    );
  }

  /**
   * ⚠️ НЭГ МӨРӨНД, НАРИЙХАН — input дотор товч суусан хэлбэр.
   * Мобайл/десктоп ижил: товч нь зөвхөн icon, input-ийн баруун ирмэгт
   * багтсан (тусдаа мөр эзлэхгүй, footer цэвэрхэн).
   */
  return (
    <form onSubmit={submit} className="relative w-full max-w-[220px]">
      {/*
        ⚠️ HONEYPOT — CSS-ээр нуусан. Хүн харахгүй, бот дүүргэнэ.
        `display:none` биш `absolute + opacity-0` — зарим бот
        display:none талбарыг алгасдаг.
      */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-0 w-0 opacity-0"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="имэйл хаяг"
        aria-label="Имэйл хаяг"
        className="w-full rounded-lg border border-foreground/12 bg-foreground/5 py-2 pl-3 pr-9 text-xs text-foreground placeholder:text-foreground/35 outline-none transition-colors focus:border-primary"
      />
      <button
        type="submit"
        disabled={busy}
        aria-label="Бүртгүүлэх"
        title="Бүртгүүлэх"
        className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-primary text-primary-foreground transition-all hover:brightness-110 active:scale-90 disabled:opacity-50"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
      </button>
    </form>
  );
}
