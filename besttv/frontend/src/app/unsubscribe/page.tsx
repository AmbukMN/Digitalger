'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, BellOff, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BrandLogo } from '@besttv/shared/ui';
import { api, ApiError } from '@/lib/api';
import { useBrand } from '@/lib/queries';

/**
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ — CAN-SPAM шаардлага, БОДИТ АЛДАА.
 *
 * Маркетингийн имэйл бүрийн хөлд «Unsubscribe» холбоос байсан
 * атал энэ ХУУДАС ОГТ БАЙГААГҮЙ — дарсан хүн бүр 404 хардаг байв.
 * Цуцлах боломжгүй имэйл нь:
 *   • CAN-SPAM/GDPR зөрчил
 *   • Хэрэглэгч оронд нь «спам» товч дардаг → SES reputation унана
 *     → эцэст нь БҮХ имэйл (нууц үг сэргээх ч) хүрэхээ болино
 */
function UnsubscribeContent() {
  const params = useSearchParams();
  const email = params.get('email')?.trim().toLowerCase() ?? '';
  /**
   * WARN HMAC signature from the emailed link.
   *
   * Without it the backend does NOT unsubscribe - it mails a fresh
   * signed link instead, so nobody can opt someone else out. Old
   * emails (sent before signatures existed) simply have no `sig`.
   */
  const sig = params.get('sig')?.trim() ?? '';
  const { data: brand } = useBrand();

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  /** true = backend sent a confirmation email instead of opting out */
  const [mailed, setMailed] = useState(false);

  const submit = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const r = await api<{ ok: boolean; done?: boolean }>('/email/unsubscribe', {
        method: 'POST',
        body: JSON.stringify(sig ? { email, sig } : { email }),
      });
      /* Unsigned link -> backend mailed a confirmation instead */
      setMailed(r?.done === false);
      setDone(true);
    } catch (e) {
      /**
       * ⚠️ Backend нь идемпотент (байхгүй хаягт ч `ok`) тул алдаа нь
       * сүлжээ/сервер л байна. Хэрэглэгчид «дахин оролдоно уу» гэхээс
       * биш «цуцлагдсангүй» гэж бүү айлга.
       */
      toast.error(
        e instanceof ApiError ? e.message : 'Сүлжээний алдаа. Дахин оролдоно уу.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <BrandLogo
              logoUrl={brand?.logoUrl ?? null}
              siteName={brand?.siteName ?? 'BestTV'}
              imgClassName="h-10 w-auto"
            />
          </Link>
        </div>

        <div className="rounded-2xl border border-foreground/10 bg-card p-7">
          {done ? (
            /* ── Амжилттай ── */
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
                <CheckCircle2 size={26} className="text-success" />
              </div>
              <h1 className="text-lg font-bold text-foreground">
                {mailed ? 'Имэйл илгээлээ' : 'Цуцлагдлаа'}
              </h1>
              {/*
                ⚠️⚠️ ХОЁР ӨӨР ТӨЛӨВ.
                Гарын үсэгтэй холбоос → шууд цуцлагдана.
                Гарын үсэггүй (хуучин имэйл) → баталгаажуулах имэйл очно.
                Хоёуланг нэг мессежээр харуулбал хэрэглэгч цуцлагдсан гэж
                бодоод, үнэндээ цуцлагдаагүй байх эрсдэлтэй.
              */}
              <p className="mt-2 text-sm leading-relaxed text-foreground/60">
                <span className="font-medium text-foreground/80">{email}</span>{' '}
                {mailed
                  ? 'хаяг руу баталгаажуулах холбоос илгээлээ. Имэйлээ шалгаад товч дээр дарна уу — түүнийг хийтэл тохиргоо өөрчлөгдөхгүй.'
                  : 'хаяг руу маркетингийн имэйл илгээхээ больлоо.'}
              </p>
              {/*
                ⚠️ Гүйлгээний имэйл ҮРГЭЛЖИЛНЭ гэдгийг ЗААВАЛ хэлнэ —
                эс бөгөөс «цуцалсан атлаа имэйл ирсээр байна» гэж
                гомдоллоно (нууц үг сэргээх, төлбөрийн баримт г.м.).
              */}
              <p className="mt-3 rounded-lg bg-accent/40 px-3 py-2.5 text-xs leading-relaxed text-foreground/55">
                Захиалга, төлбөр, нууц үг сэргээх зэрэг чухал мэдэгдэл хэвээр ирнэ.
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:brightness-110"
              >
                <ArrowLeft size={15} /> Нүүр хуудас
              </Link>
            </div>
          ) : !email ? (
            /* ── Хаяггүй орж ирсэн ── */
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-foreground/8">
                <BellOff size={24} className="text-foreground/50" />
              </div>
              <h1 className="text-lg font-bold text-foreground">Хаяг олдсонгүй</h1>
              <p className="mt-2 text-sm leading-relaxed text-foreground/60">
                Цуцлах холбоосыг имэйл дотроос дарна уу. Асуудал гарвал{' '}
                <a
                  href="mailto:support@besttv.us"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  support@besttv.us
                </a>{' '}
                руу бичээрэй.
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:brightness-110"
              >
                <ArrowLeft size={15} /> Нүүр хуудас
              </Link>
            </div>
          ) : (
            /* ── Баталгаажуулах ── */
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-foreground/8">
                <BellOff size={24} className="text-foreground/50" />
              </div>
              <h1 className="text-lg font-bold text-foreground">Имэйл цуцлах уу?</h1>
              <p className="mt-2 text-sm leading-relaxed text-foreground/60">
                <span className="font-medium text-foreground/80">{email}</span> хаяг руу шинэ
                кино, урамшууллын мэдээлэл илгээхээ болино.
              </p>

              <button
                onClick={submit}
                disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <BellOff size={16} />}
                Тийм, цуцлах
              </button>

              <Link
                href="/"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-foreground/50 transition-colors hover:text-foreground"
              >
                Болих
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </main>
  );
}

/**
 * ⚠️ `useSearchParams` нь Suspense ЗААВАЛ шаардана — эс бөгөөс
 * Next build дээр «missing suspense boundary» алдаа өгч БҮТЭН BUILD
 * унана.
 */
export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 size={22} className="animate-spin text-foreground/40" />
        </main>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}
