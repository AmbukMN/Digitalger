'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Input } from '@digitalger/shared/ui';
import { subscribersApi } from '@/lib/api';
import { toast } from 'sonner';
import { Gift, Loader2, Mail, Send, X } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STORE_KEY = 'dg-free-popup-v1'; // version-той — ирээдүйд лог арилгахад хялбар
const SHOW_DELAY = 2000;            // 2 сек дараа нээгдэнэ
const DISMISS_COOLDOWN = 7 * 24 * 60 * 60 * 1000; // X дарвал 7 хоног амарна

type Stored = { subscribed?: boolean; dismissedAt?: number };

function readStore(): Stored {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    return {};
  }
}
function writeStore(v: Stored) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(v));
  } catch {
    /* localStorage идэвхгүй — алгасна */
  }
}

/**
 * Үнэгүй бүтээгдэхүүний хуудсанд 2 секундын дараа гарах имэйл subscribe popup.
 * Давтамж: имэйл бүртгүүлсэн → хэзээ ч дахихгүй | X дарж хаасан → 7 хоног амарна.
 * Зөвхөн isFree=true (үнэгүй) бүтээгдэхүүн дээр ашиглана.
 */
export function FreeSubscribeModal({ slug }: { slug?: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const ran = useRef(false);        // StrictMode давхар mount-аас сэргийлэх
  const submitting = useRef(false); // товч 2 удаа дарах/спам-аас сэргийлэх (loading-аас давхар)

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const s = readStore();
    // Бүртгүүлсэн бол хэзээ ч харуулахгүй
    if (s.subscribed) return;
    // X дарж хаасан + 7 хоног өнгөрөөгүй бол харуулахгүй
    if (s.dismissedAt && Date.now() - s.dismissedAt < DISMISS_COOLDOWN) return;

    const t = setTimeout(() => setOpen(true), SHOW_DELAY);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setOpen(false);
    // Хаахдаа cooldown тэмдэглэнэ (7 хоног дахин харагдахгүй)
    const s = readStore();
    if (!s.subscribed) writeStore({ ...s, dismissedAt: Date.now() });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Товч 2 удаа дарах/спам давхар submit-аас сэргийлэх (loading + ref давхар хамгаалалт)
    if (loading || submitting.current) return;
    // trim + lowercase — "Email@X.MN " гэх зэргийг цэвэрлэнэ (давхардал гарахаас сэргийлэх)
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      toast.error('Зөв и-мэйл оруулна уу');
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      // Dynamic source — ирээдүйд олон free product analytics-д ялгаатай харагдана
      const source = slug ? `free-product-${slug}` : 'free-ppt';
      const res = await subscribersApi.subscribe({ email: value, source });
      // Өмнө аль хэдийн бүртгүүлсэн бол тусдаа мессеж (давхар бүртгэхгүй).
      if (res?.alreadySubscribed) {
        toast.info('Энэ и-мэйл аль хэдийн бүртгэгдсэн байна 📩 Урамшууллын мэдээллийг тогтмол хүлээж аваарай!');
      } else {
        toast.success('Амжилттай бүртгэгдлээ! 🎁 Таны мэйл рүү 10% хөнгөлөлтийн купон болон ҮНЭГҮЙ бүтээгдэхүүний мэдээлэл илгээлээ. Мэйлээ шалгаарай!');
      }
      writeStore({ subscribed: true }); // дахин ХЭЗЭЭ Ч харуулахгүй
      setOpen(false);
    } catch {
      toast.error('Алдаа гарлаа, дахин оролдоно уу');
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="free-popup-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            onClick={close}
            aria-hidden
          />
          <motion.div
            key="free-popup-modal"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
            role="dialog"
            aria-modal
          >
            {/* Толгой — navy banner. ⚠️ gradient/arbitrary өнгө iPhone7-д унаж
                цагаан болж, цагаан текст үл үзэгдэх болдог тул INLINE navy. */}
            <div
              className="relative px-6 pb-6 pt-7 text-center"
              style={{ background: 'linear-gradient(135deg, #022179 0%, #0a3aa0 100%)', backgroundColor: '#022179' }}
            >
              <button
                type="button"
                onClick={close}
                aria-label="Хаах"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#ffbe00]">
                <Gift className="h-7 w-7 text-[#022179]" />
              </div>
              <h2 className="text-xl font-bold text-white">Үнэгүй бэлэг аваарай! 🎁</h2>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/85">
                И-мэйлээ бүртгүүлээд <span className="font-semibold text-[#ffbe00]">10% хөнгөлөлтийн купон</span> болон шинэ үнэгүй бүтээгдэхүүний мэдээллийг хамгийн түрүүнд аваарай!
              </p>
            </div>

            {/* Маягт */}
            <form onSubmit={handleSubmit} className="px-6 py-5">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="имэйл хаягаа оруулна уу"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  aria-label="Имэйл хаяг"
                  autoFocus
                  className="h-12 pl-9"
                />
              </div>
              <Button type="submit" disabled={loading} className="mt-3 h-12 w-full gap-2 text-base font-semibold">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {loading ? 'Илгээж байна...' : 'Бүртгүүлж бэлэг авах'}
              </Button>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                Бид таны и-мэйлийг хэзээ ч бусдад дамжуулахгүй.
              </p>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
