'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Ban, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { api } from '@/lib/api';
import type { AdminPlan } from '@/lib/queries';

/**
 * ⚠️⚠️ ИДЭВХТЭЙ БАГЦЫГ УДИРДАХ — хүчингүй болгох / ӨӨР багц руу солих.
 *
 * БОДИТ ХЭРЭГЦЭЭ (админ мэдээлсэн):
 *   1. Буруу олгосон багцыг БУЦААХ ямар ч зам байгаагүй — зөвхөн
 *      хугацаа дуустал хүлээх.
 *   2. Хэрэглэгч «Монгол кино» авчихаад «Насанд хүрэгчдийн» хүсэхэд
 *      админ шинийг ОЛГОХ-оос өөр аргагүй байсан ба тэр нь хуучин
 *      багцын ҮЛДСЭН ХОНОГИЙГ устгадаг (хэрэглэгч төлсөн хугацаагаа
 *      алдана).
 *
 * Тиймээс СОЛИХ нь тусдаа үйлдэл: үлдсэн хугацааг ХАДГАЛНА.
 *
 * ⚠️ Хоёулаа БУЦААГДАХГҮЙ тул баталгаажуулалттай.
 */
export function SubscriptionActions({
  userId,
  subId,
  planId,
  planName,
  expiresAt,
  plans,
  onDone,
}: {
  userId: string;
  subId: string;
  planId: string;
  planName: string;
  expiresAt: string;
  plans: AdminPlan[] | undefined;
  onDone: () => Promise<unknown>;
}) {
  const [mode, setMode] = useState<null | 'revoke' | 'swap'>(null);
  const [target, setTarget] = useState('');
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  /* ⚠️ Гадуур дарах + Esc — админ панелийн заавал дүрэм */
  useEffect(() => {
    if (!mode) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setMode(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [mode]);

  /* Цэс хаагдахад сонголтыг цэвэрлэнэ */
  useEffect(() => {
    if (!mode) {
      setTarget('');
      setReset(false);
    }
  }, [mode]);

  const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400_000);

  /**
   * ⚠️ Backend-ийн мессежийг ХАРУУЛНА («Дууссан багцыг солих боломжгүй»
   * гэх мэт). Ерөнхий «Алдаа гарлаа» нь юу буруу болсныг хэлдэггүй тул
   * админ дахин дахин оролдоно.
   */
  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      await onDone();
      toast.success(okMsg);
      setMode(null);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  };

  const revoke = () =>
    run(
      () => api(`/admin/users/${userId}/subscriptions/${subId}`, { method: 'DELETE' }),
      'Багц хүчингүй боллоо',
    );

  const swap = () => {
    if (!target) {
      toast.error('Шинэ багц сонгоно уу');
      return;
    }
    return run(
      () =>
        api(`/admin/users/${userId}/subscriptions/${subId}/plan`, {
          method: 'PATCH',
          body: JSON.stringify({ planId: target, resetDuration: reset }),
        }),
      'Багц солигдлоо',
    );
  };

  /* ⚠️ Одоогийн багцыг сонголтоос ХАСНА — өөр рүүгээ солих утгагүй
     (backend ч 400 буцаана) */
  const options = (plans ?? []).filter((p) => p.id !== planId);
  const targetPlan = options.find((p) => p.id === target);

  return (
    <div className="relative mt-2 flex justify-end gap-1.5" ref={boxRef}>
      <button
        type="button"
        onClick={() => setMode((m) => (m === 'swap' ? null : 'swap'))}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRightLeft size={11} />
        Солих
      </button>
      <button
        type="button"
        onClick={() => setMode((m) => (m === 'revoke' ? null : 'revoke'))}
        className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/8 px-2 py-1 text-[11px] font-medium text-destructive transition-opacity hover:opacity-80"
      >
        <Ban size={11} />
        Хүчингүй
      </button>

      {/* ── СОЛИХ ── */}
      {mode === 'swap' && (
        <div className="admin-dropdown absolute right-0 top-full z-40 mt-1.5 w-72 rounded-xl border border-border bg-card p-3 shadow-xl">
          <p className="text-xs font-semibold text-foreground">Багц солих</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            <span className="text-foreground">{planName}</span> → сонгосон багц
          </p>

          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="mt-2.5 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary"
          >
            <option value="">Шинэ багц сонгох...</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.durationDays} хоног)
              </option>
            ))}
          </select>

          {/*
            ⚠️⚠️ ХУГАЦААНЫ СОНГОЛТ — анхдагч нь ҮЛДСЭНИЙГ ХАДГАЛАХ.
            Хэрэглэгч 30 хоног төлсөн, 22 хоног үлдсэн бол шинэ багц ч
            22 хоногтой байх нь ШУДАРГА. «Шинээр тоолох» нь зөвхөн
            админ зориуд нөхөн олговор өгөх үед.
          */}
          <div className="mt-2 space-y-1">
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2 transition-colors hover:bg-foreground/5">
              <input
                type="radio"
                checked={!reset}
                onChange={() => setReset(false)}
                className="mt-0.5 accent-primary"
              />
              <span className="text-[11px] leading-snug">
                <span className="font-medium text-foreground">Үлдсэн хугацааг хадгалах</span>
                <span className="block text-muted-foreground">
                  {daysLeft} хоног хэвээр үлдэнэ
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2 transition-colors hover:bg-foreground/5">
              <input
                type="radio"
                checked={reset}
                onChange={() => setReset(true)}
                className="mt-0.5 accent-primary"
              />
              <span className="text-[11px] leading-snug">
                <span className="font-medium text-foreground">Шинээр тоолох</span>
                <span className="block text-muted-foreground">
                  {targetPlan ? `${targetPlan.durationDays} хоног` : 'шинэ багцын бүтэн хугацаа'}
                  {targetPlan && daysLeft > targetPlan.durationDays && ' — одоогийнхоос БОГИНО'}
                </span>
              </span>
            </label>
          </div>

          {/* ⚠️ VIP-ийн онцгой дүрмийг АНХААРУУЛНА — админ мэдэхгүй бол
              «бусад багц яагаад алга болов?» гэж эргэлзэнэ */}
          {targetPlan?.isVip && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-premium/30 bg-premium/8 p-2 text-[11px] leading-snug text-premium">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              VIP нь бүх контентыг нээдэг тул бусад идэвхтэй багц хүчингүй болно
            </p>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMode(null)}
              disabled={busy}
              className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Болих
            </button>
            <button
              type="button"
              onClick={swap}
              disabled={busy || !target}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Солих
            </button>
          </div>
        </div>
      )}

      {/* ── ХҮЧИНГҮЙ БОЛГОХ ── */}
      {mode === 'revoke' && (
        <div className="admin-dropdown absolute right-0 top-full z-40 mt-1.5 w-72 rounded-xl border border-destructive/40 bg-card p-3 shadow-xl">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
            <AlertTriangle size={13} />
            Багцыг хүчингүй болгох уу?
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            <span className="font-medium text-foreground">{planName}</span> — үлдсэн{' '}
            {daysLeft} хоног ХАСАГДАНА. Хэрэглэгч энэ жанрын контент үзэхээ болино.
          </p>
          {/* ⚠️ Түүх үлддэгийг хэлнэ — админ «устгачихав уу» гэж эргэлзэхгүй */}
          <p className="mt-1.5 rounded-lg bg-foreground/5 p-2 text-[11px] leading-snug text-muted-foreground">
            Төлбөрийн түүх ХЭВЭЭР үлдэнэ (мөр устгахгүй). Автомат сунгалт
            унтарна — картаас дахин татагдахгүй.
          </p>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMode(null)}
              disabled={busy}
              className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Болих
            </button>
            <button
              type="button"
              onClick={revoke}
              disabled={busy}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40',
              )}
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
              Хүчингүй болгох
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
