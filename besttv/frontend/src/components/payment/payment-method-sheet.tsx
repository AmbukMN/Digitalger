'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Loader2, Wallet, X } from 'lucide-react';
import { cn, formatPrice } from '@besttv/shared';
import { api } from '@/lib/api';
import {
  AmexMark,
  BRAND_CHIP,
  CardGenericMark,
  MastercardMark,
  QPayBankStrip,
  QPayMark,
  TCardMark,
  UnionPayMark,
  VisaMark,
  WeChatPayMark,
} from './brand-marks';

/**
 * ТӨЛБӨРИЙН АРГЫН ЦОНХ — accordion (Temu маягийн).
 *
 * ⚠️⚠️ ЯАГААД ЭНЭ ЦОНХ ХЭРЭГТЭЙ ВЭ: өмнө нь багц бүрийн карт дээр
 * «Хэтэвчээр авах / QPay-ээр төлөх / Дансаар шилжүүлэх» гэсэн 3 товч
 * бөөгнөрдөг байв. Карт/Apple Pay/Google Pay/WeChat нэмбэл 7 товч болж
 * мобайлд уншигдахгүй болно. Тиймээс НЭГ «Худалдан авах» товч →
 * энэ цонх → арга бүр өөрийн мөр.
 *
 * ⚠️⚠️ QPay нь ЭХЛЭЭД СОНГОГДСОН БАЙНА — цонх нээгдэнгүүт QR + банкны
 * deeplink шууд харагдана (хамгийн түгээмэл арга, нэмэлт дарах
 * шаардлагагүй). Бусад арга дарвал ДОР НЬ задарна.
 *
 * ⚠️⚠️ «Bonum» гэдэг нэр ХЭРЭГЛЭГЧИД ХЭЗЭЭ Ч ХАРАГДАХГҮЙ — зүгээр л
 * «Карт», «Apple Pay». Аль зуучлагчаар явж байгаа нь хэрэглэгчид
 * хамаагүй (мөн зуучлагч солигдвол UI өөрчлөгдөх ёсгүй).
 *
 * ⚠️ Хэтэвч бол «арга» БИШ, ЭХ СУРВАЛЖ: түүнийг ЯГ эдгээр аргаар
 * цэнэглэдэг. Тиймээс `kind='topup'` үед хэтэвчийн мөр ГАРАХГҮЙ
 * (өөрийгөө цэнэглэх утгагүй давхардал).
 */

export type PayMethod = 'qpay' | 'card' | 'applepay' | 'googlepay' | 'wechat' | 'bank' | 'wallet';

export interface PaymentSheetProps {
  open: boolean;
  onClose: () => void;
  /** Төлөх дүн (харуулахад) */
  amount: number;
  /** Гарчиг доорх мөр — «Шилдэг кино багц», «Хэтэвч цэнэглэх» */
  subtitle?: string;
  kind: 'plan' | 'rental' | 'topup';
  /** Хэтэвчийн үлдэгдэл — хүрэлцэхгүй бол мөр бүдгэрнэ */
  walletBalance?: number;
  /** Дансаар шилжүүлэх идэвхтэй эсэх (админ тохиргоо) */
  bankEnabled?: boolean;
  /** Карт/Apple/Google/WeChat боломжтой эсэх (backend тохируулаагүй бол false) */
  cardEnabled?: boolean;
  /**
   * Арга сонгогдоод «Төлөх» дарахад. QPay бол дуудагч тал QR цонхоо
   * нээнэ; card/applepay/googlepay/wechat бол redirect хийнэ.
   */
  onSelect: (method: PayMethod, autoRenew?: boolean) => void | Promise<void>;
  /** Гадна талын ачаалал (invoice үүсгэж байх зуур) */
  busy?: boolean;
}

/** ⚠️ Дэвсгэр/хүрээ нь `BRAND_CHIP`-ээс ирнэ (лого бүр өөр шаардлагатай) */
const CHIP = 'flex h-7 items-center justify-center rounded px-1.5';

/**
 * ⚠️⚠️ ТҮР ИДЭВХГҮЙ ТӨЛБӨРИЙН АРГУУД — ОГТ ХАРУУЛАХГҮЙ.
 *
 * Bonum-ын эрх хараахан аваагүй. Эхэндээ «харагдана, гэхдээ дарж
 * болохгүй» байдлаар үлдээсэн боловч хэрэглэгч тэр аргыг дарж үзээд
 * «яагаад ажиллахгүй байна» гэж эргэлзэх тул БҮРМӨСӨН НУУВ.
 *
 * ⚠️ ИДЭВХЖҮҮЛЭХ: энэ жагсаалтаас түлхүүрийг нь ХАСахад л хангалттай —
 *    бусад код (урсгал, backend, лого, авто сунгалт) БҮРЭН бэлэн.
 *    Жишээ: карт нээгдвэл `'card'`-ыг ав.
 */
const TEMP_DISABLED: PayMethod[] = ['card', 'wechat'];
const DISABLED_HINT = 'Энэ төлбөрийн хэрэгсэл түр идэвхгүй байна';

export function PaymentMethodSheet({
  open,
  onClose,
  amount,
  subtitle,
  kind,
  walletBalance = 0,
  bankEnabled = false,
  cardEnabled = true,
  onSelect,
  busy = false,
}: PaymentSheetProps) {
  const router = useRouter();
  /* ⚠️ QPay DEFAULT — нээгдэнгүүт задарсан байна */
  const [selected, setSelected] = useState<PayMethod>('qpay');
  /**
   * ⚠️ АВТОМАТ СУНГАЛТ — DEFAULT ЧЕКТЭЙ (хэрэглэгчийн шийдвэр).
   * Зөвхөн `card` + `plan` үед л UI-д харагдаж, backend руу явна.
   */
  const [autoRenew, setAutoRenew] = useState(true);

  /* ⚠️ Esc-ээр хаах — бүх модалд байх ёстой (төслийн UX дүрэм) */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* Цонх хаагдахад сонголтыг QPay руу сэргээнэ (дараагийн удаад цэвэр) */
  useEffect(() => {
    if (!open) {
      setSelected('qpay');
      setAutoRenew(true);
    }
  }, [open]);

  if (!open) return null;

  const walletEnough = walletBalance >= amount;
  /**
   * ⚠️ ХЭТЭВЧ сонгосон БӨГӨӨД үлдэгдэл нэхэмжлэлээс БАГА
   * (0 ч бай, дутуу ч бай) → «Төлөх» биш «Цэнэглэх».
   * Их/тэнцүү бол хэвийн «Төлөх».
   */
  const walletNeedsTopup = selected === 'wallet' && !walletEnough;
  /**
   * ⚠️⚠️ ХЭТЭВЧ ҮРГЭЛЖ ХАРАГДАНА (үлдэгдэл 0 байсан ч).
   *
   * Өмнө нь `walletBalance > 0` нөхцөлтэй байсан тул үлдэгдэлгүй
   * хэрэглэгчид хэтэвчийн мөр ОГТ харагдахгүй → «яагаад хэтэвчээр
   * авах алга вэ?» гэсэн эргэлзээ төрүүлдэг байв (бодит гомдол).
   * Хэрэглэгч хэтэвч гэдэг боломж БАЙГААГ мэдэх ёстой, зөвхөн
   * түүнийг цэнэглэх шаардлагатайг харуулна.
   *
   * ⚠️ `kind === 'topup'` үед л нуугдана — хэтэвчээр хэтэвч
   * цэнэглэх нь утгагүй давхардал.
   */
  const canWallet = kind !== 'topup';

  const rows: {
    id: PayMethod;
    title: string;
    hint?: string;
    mark: React.ReactNode;
    /** Мөрний баруун талд гарах нэмэлт лого эгнээ (Temu маягаар) */
    extra?: React.ReactNode;
    show: boolean;
    disabled?: boolean;
  }[] = [
    {
      id: 'qpay',
      title: 'QPay',
      /* ⚠️ «SocialPay» гэсэн текст ХАСАВ — банкны logo эгнээ өөрөө
         аль апп ажиллахыг харуулна (Temu маягаар, илүү ойлгомжтой) */
      mark: <QPayMark className="size-7 rounded-md object-contain" />,
      extra: <QPayBankStrip />,
      show: true,
    },
    {
      id: 'card',
      title: 'Карт',
      /* ⚠️⚠️ ӨНГӨ ТОГТМОЛ (`text-neutral-700`), `text-foreground` БИШ.
         Энэ icon нь ЦАГААН chip дотор сууна — dark theme-д foreground нь
         бараг цагаан болдог тул цагаан дээр цагаан зурагдаж АЛГА болно
         (хэрэглэгч «картын icon цайраад байна» гэж мэдээлсэн). */
      mark: <CardGenericMark className="h-4 w-6 text-neutral-700" />,
      /* ⚠️ Хүлээж авах БҮХ картын брэнд харагдана — хэрэглэгч «миний
         карт болох уу» гэдгээ шууд мэднэ (Temu-гийн зарчим).
         ⚠️ Лого бүр өөр харьцаатай тул өндрөөр нь жигдэлж, өргөнийг
         auto (`w-auto`) орхино — сунгаж гажуудуулахгүй. */
      extra: (
        <span className="flex flex-wrap items-center gap-1">
          <span className={cn(CHIP, BRAND_CHIP.visa)}>
            <VisaMark className="h-3 w-auto" />
          </span>
          <span className={cn(CHIP, BRAND_CHIP.mastercard)}>
            <MastercardMark className="h-4 w-auto" />
          </span>
          <span className={cn(CHIP, BRAND_CHIP.unionpay)}>
            <UnionPayMark className="h-4 w-auto" />
          </span>
          {/* ⚠️ AMEX өөрөө цэнхэр плашкатай — цагаан chip тавибал
              цагаан текст нь уусна. Тиймээс chip-гүй, шууд.
              ⚠️ Бүтэн «AMERICAN EXPRESS» wordmark тул бусадтай ижил
              өндөр (h-7) өгвөл өргөн нь автоматаар таарна. */}
          <span className={cn(CHIP, BRAND_CHIP.amex, 'px-0')}>
            <AmexMark className="h-7 w-auto rounded-[3px]" />
          </span>
          {/* Т карт — дотоодын карт эзэмшигчид зориулав */}
          <span className={cn(CHIP, BRAND_CHIP.tcard)}>
            <TCardMark className="h-4 w-auto" />
          </span>
        </span>
      ),
      /* ⚠️ ТҮР ИДЭВХГҮЙ бол ОГТ ХАРУУЛАХГҮЙ (доорх тайлбар үз) */
      show: cardEnabled && !TEMP_DISABLED.includes('card'),
    },
    /**
     * ⚠️⚠️ Apple Pay / Google Pay — Bonum дээр ХАРААХАН ИДЭВХЖЭЭГҮЙ
     * (домэйн баталгаажуулалт, App Review хүлээгдэж байна). Идэвхжээгүй
     * аргыг харуулбал хэрэглэгч дараад алдаа авна тул ТҮР НУУВ.
     * ⚠️ Идэвхжихэд: `show: cardEnabled` болгож, Apple/Google-ийн АЛБАН
     * ЁСНЫ mark файлыг `public/cards/` дор тавина (өөрөө зурахгүй).
     */
    {
      id: 'applepay',
      title: 'Apple Pay',
      mark: null,
      show: false,
    },
    {
      id: 'googlepay',
      title: 'Google Pay',
      mark: null,
      show: false,
    },
    {
      id: 'wechat',
      title: 'WeChat Pay',
      hint: 'Гадаад зочдод',
      /* ⚠️ Лого ДӨРВӨЛЖИН (240×240) — өмнөх `w-11` сунгасан харьцаа буруу */
      mark: <WeChatPayMark className="size-7 rounded-md object-contain" />,
      /* ⚠️ ТҮР ИДЭВХГҮЙ бол ОГТ ХАРУУЛАХГҮЙ (доорх тайлбар үз) */
      show: cardEnabled && !TEMP_DISABLED.includes('wechat'),
    },
    {
      id: 'bank',
      title: 'Дансаар шилжүүлэх',
      hint: 'Баримт хавсаргана',
      /* ⚠️ Өнгөт — dark/light хоёуланд уншигдах хос өнгө (дэвсгэр нь доор) */
      mark: <Building2 size={18} className="text-sky-600 dark:text-sky-300" />,
      show: bankEnabled && kind !== 'topup',
    },
    {
      id: 'wallet',
      title: 'Хэтэвч',
      /* ⚠️ 0 үед «хүрэлцэхгүй» гэхээс «цэнэглэнэ үү» гэвэл ойлгомжтой */
      hint: walletEnough
        ? `Үлдэгдэл: ${formatPrice(walletBalance)}`
        : walletBalance > 0
          ? `Үлдэгдэл хүрэлцэхгүй (${formatPrice(walletBalance)})`
          : 'Үлдэгдэл 0₮ — эхлээд цэнэглэнэ үү',
      /* ⚠️ Өнгөт — dark/light хоёуланд уншигдах хос өнгө (дэвсгэр нь доор) */
      mark: <Wallet size={18} className="text-amber-600 dark:text-amber-300" />,
      show: canWallet,
      /**
       * ⚠️⚠️ ҮЛДЭГДЭЛ ХҮРЭХГҮЙ ч мөр ИДЭВХТЭЙ.
       * Дарахад «Төлөх» товч нь ЦЭНЭГЛЭХ рүү аваачна (доорх
       * `walletNeedsTopup`) — хэрэглэгч цэнэглээд шууд үргэлжлүүлнэ.
       * Өмнө нь `disabled` байсан тул мухардаж, юу хийхээ мэдэхгүй байв.
       */
      disabled: false,
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        key="pay-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm"
      />
      {/*
        ⚠️ MOBILE-FIRST: утсан дээр ДООРООС гарах bottom-sheet (эрхий
        хуруунд ойр), десктопт голд. Хэрэглэгчийн дийлэнх нь утсаар.
      */}
      <motion.div
        key="pay-sheet"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Төлбөр төлөх"
        className="fixed inset-x-0 bottom-0 z-100 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl border border-foreground/10 bg-card sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-foreground/8 px-5 py-3.5">
          <div>
            <p className="text-sm font-bold leading-tight text-foreground">Төлбөр төлөх</p>
            {subtitle && <p className="text-[11px] leading-tight text-foreground/45">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Хаах"
            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="mb-4 flex items-baseline justify-between rounded-xl border border-foreground/8 bg-foreground/4 px-4 py-3">
            <span className="text-sm text-foreground/55">Төлөх дүн</span>
            <span className="text-xl font-black text-foreground">{formatPrice(amount)}</span>
          </div>

          <div className="space-y-2">
            {rows
              .filter((r) => r.show)
              .map((r) => {
                const isSel = selected === r.id;
                return (
                  <div
                    key={r.id}
                    className={cn(
                      'overflow-hidden rounded-xl border transition-colors',
                      isSel
                        ? 'border-primary/45 bg-primary/8'
                        : 'border-foreground/12 hover:border-foreground/25',
                      r.disabled && 'opacity-45',
                    )}
                  >
                    <button
                      type="button"
                      disabled={r.disabled}
                      /* ⚠️ Яагаад дарагдахгүй байгааг ХЭЛНЭ — эс бөгөөс
                         хэрэглэгч «эвдэрсэн юм болов уу» гэж бодно */
                      title={r.disabled ? DISABLED_HINT : undefined}
                      onClick={() => setSelected(r.id)}
                      /* ⚠️ min-h-14 — хүрэх талбар (мобайл, WCAG) */
                      className="flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-left disabled:cursor-not-allowed"
                    >
                      <span
                        className={cn(
                          'flex size-4.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                          isSel ? 'border-primary' : 'border-foreground/25',
                        )}
                      >
                        {isSel && <span className="size-2 rounded-full bg-primary" />}
                      </span>
                      {/* Брэндийн лого — цагаан/хар chip дотор (өнгө уншигдана) */}
                      <span
                        className={cn(
                          'flex h-8 w-11 shrink-0 items-center justify-center rounded-md',
                          r.id === 'applepay'
                            ? 'bg-black ring-1 ring-white/15'
                            : /**
                               * ⚠️ Данс/Хэтэвч — ӨНГӨТЭЙ дэвсгэр.
                               * Саарал (`bg-foreground/8`) байсан нь QPay/картын
                               * өнгөт логонуудын дэргэд «идэвхгүй» мэт харагддаг
                               * байв. Одоо утга санааны өнгө: банк=цэнхэр,
                               * хэтэвч=алтан (брэндийн secondary).
                               *
                               * ⚠️ DARK/LIGHT: тунгалаг байдлаар (`/12`, `/18`)
                               *    өгсөн тул хоёр сэдэвт ч дэвсгэртэйгээ зохицоно
                               *    — хатуу HEX бол нэг сэдэвт уусна.
                               */
                              r.id === 'bank'
                              ? 'bg-sky-500/12 ring-1 ring-sky-500/25 dark:bg-sky-400/18 dark:ring-sky-400/30'
                              : r.id === 'wallet'
                                ? 'bg-amber-500/12 ring-1 ring-amber-500/25 dark:bg-amber-400/18 dark:ring-amber-400/30'
                                : /* ⚠️ WeChat лого өөрөө ногоон дэвсгэртэй —
                                     цагаан chip дотор тавибал хүрээ мэт харагдана */
                                  r.id === 'wechat'
                                  ? 'bg-transparent'
                                  : 'bg-white ring-1 ring-black/10',
                        )}
                      >
                        {r.mark}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {r.title}
                        </span>
                        {/*
                          ⚠️ Идэвхгүй бол ШАЛТГААНЫГ мөрөн дээр нь бичнэ.
                          `title` (hover) нь МОБАЙЛД огт ажилладаггүй тул
                          ганцаараа хангалтгүй — 90% хэрэглэгч утсаар ордог.
                        */}
                        {r.disabled ? (
                          <span className="block truncate text-[11px] text-foreground/45">
                            Түр идэвхгүй
                          </span>
                        ) : (
                          r.hint && (
                            <span className="block truncate text-[11px] text-foreground/45">
                              {r.hint}
                            </span>
                          )
                        )}
                        {/*
                          ⚠️ Хүлээж авах брэндүүд НЭР ДООРОО (Temu маягаар).
                          Мөрний баруун талд тавибал мобайлд шахагдана.
                        */}
                        {r.extra && <span className="mt-1 block">{r.extra}</span>}
                      </span>
                    </button>

                    {/* ─── ЗАДАРСАН ХЭСЭГ ─── */}
                    {isSel && (
                      <div className="border-t border-dashed border-primary/25 px-3.5 pb-3.5 pt-3">
                        {r.id === 'qpay' && (
                          <p className="text-[11.5px] leading-relaxed text-foreground/55">
                            «Төлөх» дарахад QR код гарна. Банкны аппаараа уншуулна.
                            Төлмөгц <b className="text-foreground/75">эрх автоматаар нээгдэнэ</b>.
                          </p>
                        )}
                        {(r.id === 'card' || r.id === 'applepay' || r.id === 'googlepay') && (
                          <div className="space-y-2.5">
                            <p className="text-[11.5px] leading-relaxed text-foreground/55">
                              Төлбөрийн аюулгүй хуудас руу шилжинэ. Төлсний дараа эрх тань
                              автоматаар нээгдэнэ.
                            </p>
                            {/*
                              ⚠️⚠️ АВТОМАТ СУНГАЛТ — ЗӨВХӨН карт + БАГЦ үед.
                              Кино түрээс (`rental`) нэг удаагийн тул сунгах утгагүй;
                              хэтэвч цэнэглэх (`topup`) ч мөн адил.
                              ⚠️ Apple/Google Pay нь токенждоггүй тул зөвхөн `card`.
                              ⚠️ Default ЧЕКТЭЙ (хэрэглэгчийн шийдвэр). Тайлбарыг
                                 ТОВЧ байлгана — урт текст цонхыг дүүргэдэг;
                                 болиулах заавар профайл дээр бий.
                            */}
                            {r.id === 'card' && kind === 'plan' && (
                              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-foreground/5 px-2.5 py-2">
                                <input
                                  type="checkbox"
                                  checked={autoRenew}
                                  onChange={(e) => setAutoRenew(e.target.checked)}
                                  className="size-4 shrink-0 accent-primary"
                                />
                                {/* ⚠️ ТОВЧ байх — урт тайлбар цонхыг дүүргэж,
                                    хэрэглэгч уншихаа больдог. Дэлгэрэнгүйг
                                    профайлаас харна. */}
                                <span className="text-[12px] font-medium text-foreground/85">
                                  Авто сунгалт
                                </span>
                              </label>
                            )}
                          </div>
                        )}
                        {r.id === 'wechat' && (
                          <p className="text-[11.5px] leading-relaxed text-foreground/55">
                            WeChat аппаараа төлөх хуудас руу шилжинэ.
                          </p>
                        )}
                        {r.id === 'bank' && (
                          <p className="text-[11.5px] leading-relaxed text-foreground/55">
                            Дансны мэдээлэл харагдана. Шилжүүлээд баримтаа хавсаргана —
                            ажлын цагаар 1–3 цагт баталгаажна.
                          </p>
                        )}
                        {r.id === 'wallet' && (
                          <p className="text-[11.5px] leading-relaxed text-foreground/55">
                            Хэтэвчнээс {formatPrice(amount)} хасагдана.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        <div className="shrink-0 border-t border-foreground/8 bg-card p-4 sm:p-5">
          {/*
            ⚠️ Хэтэвч сонгосон БӨГӨӨД үлдэгдэл хүрэхгүй бол товч нь
            «Цэнэглэх» болно — дарахад цэнэглэх хуудас руу аваачна.
            Ингэснээр хэрэглэгч мухардахгүй, цэнэглээд үргэлжлүүлнэ.
          */}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (walletNeedsTopup) {
                onClose();
                router.push('/profile?tab=wallet');
                return;
              }
              /* ⚠️ Зөвхөн карт+багц үед утгатай — бусад үед undefined */
              void onSelect(selected, selected === 'card' && kind === 'plan' ? autoRenew : undefined);
            }}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
          >
            {busy && <Loader2 size={17} className="animate-spin" />}
            {walletNeedsTopup ? 'Хэтэвч цэнэглэх' : 'Төлөх'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Bonum (карт/Apple/Google/WeChat) боломжтой эсэхийг backend-ээс асууна.
 * ⚠️ Тохируулаагүй бол тэдгээр мөр ГАРАХГҮЙ — хэрэглэгч дарж байгаад
 * алдаа авахаас сэргийлнэ.
 */
export function useCardPaymentEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api<{ card: boolean }>('/payments/methods')
      .then((r) => {
        if (!cancelled) setEnabled(!!r.card);
      })
      .catch(() => {
        /* ⚠️ Алдаа = боломжгүй гэж үзнэ (fail-closed UI) */
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
}
