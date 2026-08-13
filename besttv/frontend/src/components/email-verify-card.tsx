'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, MailCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

/**
 * Имэйл баталгаажуулах карт (профайл хуудсанд).
 *
 * ⚠️ Зөвхөн имэйл/нууц үгээр бүртгүүлсэн (`provider === 'LOCAL'`) бөгөөд
 * баталгаажаагүй хэрэглэгчид харагдана. Google/FB-ээр нэвтэрсэн хаяг нь
 * тухайн үйлчилгээгээр аль хэдийн баталгаажсан.
 */
export function EmailVerifyCard() {
  const { user, refreshMe } = useAuth();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Дахин илгээх хүлээлтийн тоолуур.
   *
   * ⚠️⚠️ Dependency нь `[cooldown]` байсан нь АЛДАА: тоолуур 1 буурах
   * бүрд effect дахин ажиллаж, хуучин interval-аа цэвэрлээд ШИНЭ
   * 1000ms interval үүсгэдэг байв. Ингэснээр 60 секундийн cooldown
   * бодитоор 60-аас удаан үргэлжилж (drift), жигд бус ажиллана.
   *
   * ⚠️ `cooldown > 0` гэсэн НӨХЦӨЛӨӨР асаана — тоо өөрчлөгдөхөд биш.
   * `setCooldown(c => ...)` нь хуучин утгыг хараат бус уншина.
   */
  const ticking = cooldown > 0;
  useEffect(() => {
    if (!ticking) return;
    timerRef.current = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [ticking]);

  if (!user || user.emailVerified || user.provider !== 'LOCAL') return null;

  const request = async () => {
    setBusy(true);
    try {
      await api('/email/otp/request', { method: 'POST', body: JSON.stringify({}) });
      setSent(true);
      setCooldown(60);
      toast.success('Баталгаажуулах код илгээлээ');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6) return toast.error('6 оронтой код оруулна уу');
    setBusy(true);
    try {
      await api('/email/otp/verify', { method: 'POST', body: JSON.stringify({ code }) });
      await refreshMe();
      toast.success('Имэйл амжилттай баталгаажлаа ✅');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Код буруу байна');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-premium/30 bg-premium-solid/8 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-premium-solid/15 text-premium">
          <ShieldAlert size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">Имэйл баталгаажаагүй байна</p>
          <p className="mt-0.5 text-sm text-foreground/55">
            {sent
              ? `${user.email} хаяг руу илгээсэн 6 оронтой кодыг оруулна уу`
              : 'Аюулгүй байдлын үүднээс имэйл хаягаа баталгаажуулна уу'}
          </p>

          {sent ? (
            <div className="mt-3 space-y-2.5">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label="Баталгаажуулах код"
                className="w-full rounded-lg border border-foreground/14 bg-black/30 px-3 py-2.5 text-center text-lg font-bold tracking-[0.4em] text-foreground placeholder:tracking-normal placeholder:text-foreground/25 outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                <button
                  onClick={verify}
                  disabled={busy || code.length !== 6}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  Баталгаажуулах
                </button>
                <button
                  onClick={request}
                  disabled={busy || cooldown > 0}
                  className={cn(
                    'rounded-lg bg-foreground/8 px-4 py-2.5 text-sm font-medium text-foreground/70 hover:bg-foreground/14 disabled:opacity-50',
                  )}
                >
                  {cooldown > 0 ? `${cooldown}с` : 'Дахин'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={request}
              disabled={busy}
              className="mt-3 flex items-center gap-1.5 rounded-lg bg-premium-solid px-4 py-2 text-sm font-bold text-premium-foreground hover:brightness-110 disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <MailCheck size={14} />}
              Код илгээх
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
