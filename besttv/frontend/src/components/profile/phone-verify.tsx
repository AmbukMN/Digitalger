'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeCheck,
  Check,
  Copy,
  Loader2,
  Phone,
  RotateCcw,
  Send,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@besttv/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

interface PhoneSession {
  sessionId: string;
  code: string;
  shortcode: string;
  smsUri: string;
  displayInstruction: string;
  expiresAt: string;
}

/**
 * УТАС БАТАЛГААЖУУЛАХ — verify.mn MO SMS.
 *
 * ⚠️⚠️ Энэ нь энгийн OTP БИШ. Бид код ИЛГЭЭДЭГГҮЙ — хэрэглэгч өөрөө
 * кодыг 144773 руу SMS-ээр илгээнэ. Ингэснээр дугаар нь ҮНЭХЭЭР
 * түүнийх гэдэг батлагдана (кодыг хулгайлсан ч өөр дугаараас
 * илгээвэл таарахгүй).
 *
 * ⚠️ Хэрэглэгчид ЭНЭ ЯЛГААГ тодорхой ойлгуулах ёстой — «код хүлээж
 * байна» гэж бодоод хүлээвэл хэзээ ч болохгүй.
 */
export function PhoneVerify() {
  const { user, refreshMe } = useAuth();

  const [phone, setPhone] = useState('');
  const [editing, setEditing] = useState(false);
  const [session, setSession] = useState<PhoneSession | null>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'verified' | 'expired'>('idle');
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** ⚠️ Амжилтын toast НЭГ Л УДАА гарах баталгаа */
  const firedRef = useRef(false);

  const verified = Boolean(user?.phoneVerified);
  const current = user?.phone ?? '';

  const clearPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };
  useEffect(() => () => clearPoll(), []);

  /**
   * ⚠️⚠️ POLLING ≥3 СЕКУНД. verify.mn нь ижил session-ыг 2 секунд
   * дотор давтан асуувал 429 буцаана. Эхний шалгалтыг ШУУД хийнэ —
   * хэрэглэгч SMS-ээ аль хэдийн илгээсэн байж болно.
   */
  useEffect(() => {
    if (!session || status !== 'pending') return;
    clearPoll();
    let cancelled = false;

    const check = async () => {
      try {
        const res = await api<{ status: 'pending' | 'verified' | 'expired' }>(
          `/auth/phone-verify/status?sessionId=${encodeURIComponent(session.sessionId)}`,
        );
        if (cancelled) return;
        if (res.status === 'verified') {
          clearPoll();
          setStatus('verified');
          if (!firedRef.current) {
            firedRef.current = true;
            toast.success('Утас амжилттай баталгаажлаа! 🎉');
            void refreshMe();
          }
          setTimeout(() => {
            setSession(null);
            setStatus('idle');
            setEditing(false);
          }, 2000);
        } else if (res.status === 'expired') {
          clearPoll();
          setStatus('expired');
        }
      } catch {
        /* ⚠️ Түр саатал — дараагийн poll дээр дахин оролдоно.
           Алдаа харуулбал хэрэглэгч дэмий сандарна. */
      }
    };

    void check();
    pollRef.current = setInterval(check, 3000);
    return () => {
      cancelled = true;
      clearPoll();
    };
  }, [session, status, refreshMe]);

  /** Үлдсэн хугацаа — MM:SS */
  useEffect(() => {
    if (!session || status !== 'pending') return;
    const tick = () => {
      const secs = Math.max(
        0,
        Math.round((new Date(session.expiresAt).getTime() - Date.now()) / 1000),
      );
      setRemaining(secs);
      if (secs <= 0) {
        setStatus('expired');
        clearPoll();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [session, status]);

  const start = async (target: string) => {
    const num = target.trim();
    if (!num) {
      toast.error('Утасны дугаараа оруулна уу');
      return;
    }
    setBusy(true);
    firedRef.current = false;
    try {
      const res = await api<PhoneSession>('/auth/request-phone-verify', {
        method: 'POST',
        body: JSON.stringify({ phone: num }),
      });
      setSession(res);
      setStatus('pending');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} хуулагдлаа`);
    } catch {
      toast.error('Хуулж чадсангүй');
    }
  };

  const mmss = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(
    remaining % 60,
  ).padStart(2, '0')}`;

  // ─── Баталгаажсан ────────────────────────────────────────────────────────
  if (verified && !editing) {
    return (
      <div className="rounded-xl border border-success/25 bg-success/8 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-success">
              <BadgeCheck size={18} />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">{formatMn(current)}</p>
              <p className="text-xs text-success">Баталгаажсан</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditing(true);
              setPhone('');
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-foreground/5"
          >
            Дугаар солих
          </button>
        </div>
      </div>
    );
  }

  // ─── SMS хүлээж байна ────────────────────────────────────────────────────
  if (session && status === 'pending') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-primary/30 bg-primary/5 p-4"
      >
        {/*
          ⚠️⚠️ ХАМГИЙН ЧУХАЛ ЗААВАР. Хэрэглэгч «код ирэхийг хүлээх»
          гэж бодвол хэзээ ч болохгүй — ӨӨРӨӨ илгээх ёстой.
        */}
        <p className="mb-1 text-sm font-bold text-foreground">
          Та өөрөө SMS илгээнэ үү
        </p>
        <p className="mb-3 text-xs leading-relaxed text-foreground/60">
          Бид танд код <strong className="text-foreground">илгээхгүй</strong>. Доорх кодыг
          өөрийн <strong className="text-foreground">{formatMn(session.displayInstruction.match(/\d{8}/)?.[0] ?? '')}</strong>{' '}
          дугаараас {session.shortcode} руу SMS-ээр илгээснээр дугаар тань баталгаажна.
        </p>

        {/* Гар утсанд — нэг дарахад SMS апп бөглөгдсөн нээгдэнэ */}
        <a href={session.smsUri} className="block">
          <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-success px-4 py-3 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]">
            <Send size={16} />
            {session.shortcode} руу илгээх
          </button>
        </a>

        {/*
          ⚠️ ГАР АРГЫН НӨӨЦ ЗААВАЛ — `sms:` линк нь iOS/Android дээр
          өөр өөр ажилладаг, зарим in-app browser огт дэмждэггүй.
          Компьютерээс орсон хүнд ч энэ л цорын ганц зам.
        */}
        <div className="mt-3 space-y-2 rounded-lg border border-border bg-card/60 p-3">
          <p className="text-center text-[11px] text-foreground/50">
            Эсвэл гараар илгээнэ үү
          </p>
          <div className="flex items-center gap-2">
            <CopyBox label="Код" value={session.code} onCopy={copy} big />
            <span className="text-xs text-foreground/40">→</span>
            <CopyBox label="Дугаар" value={session.shortcode} onCopy={copy} />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-foreground/55">
            <Loader2 size={13} className="animate-spin" />
            SMS хүлээж байна… <strong className="tabular-nums text-foreground">{mmss}</strong>
          </span>
          <button
            onClick={() => {
              clearPoll();
              setSession(null);
              setStatus('idle');
            }}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground/50 hover:bg-foreground/5"
          >
            Болих
          </button>
        </div>
      </motion.div>
    );
  }

  // ─── Амжилттай (богино зуур) ─────────────────────────────────────────────
  if (status === 'verified') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success text-white">
          <Check size={20} strokeWidth={3} />
        </span>
        <p className="text-sm font-bold text-foreground">Утас баталгаажлаа 🎉</p>
      </div>
    );
  }

  // ─── Хугацаа дууссан ─────────────────────────────────────────────────────
  if (status === 'expired') {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning/8 p-4">
        <p className="mb-2.5 text-sm text-foreground/75">
          Хугацаа дууссан байна. Дахин оролдоно уу.
        </p>
        <button
          onClick={() => {
            setStatus('idle');
            setSession(null);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-foreground/5"
        >
          <RotateCcw size={13} /> Дахин эхлэх
        </button>
      </div>
    );
  }

  // ─── Эхлэх / дугаар оруулах ──────────────────────────────────────────────
  const showInput = editing || !current;

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        current ? 'border-warning/30 bg-warning/8' : 'border-border bg-card',
      )}
    >
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full',
              current ? 'bg-warning/15 text-warning' : 'bg-foreground/8 text-foreground/50',
            )}
          >
            <Phone size={17} />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">
              {current ? formatMn(current) : 'Утасны дугаар'}
            </p>
            <p className="text-xs text-foreground/55">
              {current ? '⚠ Баталгаажаагүй' : 'Оруулбал утсаараа ч нэвтэрнэ'}
            </p>
          </div>
        </div>
        {editing && (
          <button
            onClick={() => setEditing(false)}
            aria-label="Болих"
            className="rounded-lg p-1.5 text-foreground/40 hover:bg-foreground/5"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {showInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="99112233"
              className="input-dark mb-2 w-full"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => start(showInput ? phone : current)}
        disabled={busy}
        className={cn(
          'flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50',
          current
            ? 'bg-warning text-black hover:brightness-105'
            : 'bg-primary text-primary-foreground hover:brightness-110',
        )}
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} />}
        Баталгаажуулах
      </button>
    </div>
  );
}

/** Хуулах товчтой хайрцаг */
function CopyBox({
  label,
  value,
  onCopy,
  big,
}: {
  label: string;
  value: string;
  onCopy: (v: string, l: string) => void;
  big?: boolean;
}) {
  return (
    <button
      onClick={() => onCopy(value, label)}
      className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 transition-colors hover:border-primary/40"
    >
      <span className="text-left">
        <span className="block text-[10px] text-foreground/40">{label}</span>
        <span
          className={cn(
            'block font-mono font-bold tabular-nums text-foreground',
            big ? 'text-lg tracking-widest' : 'text-sm',
          )}
        >
          {value}
        </span>
      </span>
      <Copy size={13} className="shrink-0 text-foreground/35" />
    </button>
  );
}

/** «99112233» → «9911-2233» */
function formatMn(phone: string): string {
  const d = String(phone).replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4)}` : phone;
}
