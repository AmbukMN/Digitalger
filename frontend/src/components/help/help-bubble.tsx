'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useChatUi } from '@/store/chat-ui';

// ── Хуудас бүрд тохирох санал + idle/scroll босго ──
// idleMs: хөдөлгөөнгүй хэдэн мс байвал гарах. scrollPct: хэдэн % доош гүйвэл гарах
// (0 = scroll trigger хэрэггүй). text: bubble дээрх context-aware санал.
// everyVisit: checkout-д ОРОХ БОЛГОНД гарна (session 1 удаа БИШ) — X дарж хаасан
// бол л тэр session-д дахин гарахгүй.
interface BubbleCtx { idleMs: number; scrollPct: number; text: string; everyVisit?: boolean }

function ctxFor(pathname: string): BubbleCtx {
  if (pathname.startsWith('/checkout')) {
    return { idleMs: 8_000, scrollPct: 0, text: 'Төлбөр төлөхөд туслах уу? 💳', everyVisit: true };
  }
  if (/^\/products\/[^/]+/.test(pathname)) {
    return { idleMs: 10_000, scrollPct: 60, text: 'Энэ бүтээгдэхүүний талаар асуух зүйл байна уу? 🛍️' };
  }
  if (pathname.startsWith('/library')) {
    return { idleMs: 10_000, scrollPct: 0, text: 'Файл татахад туслах уу? 📥' };
  }
  if (pathname.startsWith('/learn')) {
    return { idleMs: 15_000, scrollPct: 0, text: 'Хичээлийн талаар асуух зүйл байна уу? 🎓' };
  }
  if (pathname === '/products') {
    return { idleMs: 15_000, scrollPct: 50, text: 'Хайхад туслах уу? Видео заавар бий 🔎' };
  }
  // Нүүр + бусад
  return { idleMs: 15_000, scrollPct: 70, text: 'Тусламж хэрэгтэй юу? 👋' };
}

const SEEN_KEY = 'dg-help-bubble-shown-v1'; // session-д 1 удаа (sessionStorage)
const CHECKOUT_DISMISSED_KEY = 'dg-help-bubble-checkout-dismissed-v1'; // checkout X дарсан

export function HelpBubble() {
  const pathname = usePathname() || '/';
  const [show, setShow] = useState(false);
  const requestOpenHelp = useChatUi((s) => s.requestOpenHelp);
  const helpOpen = useChatUi((s) => s.helpOpen);
  const chatOpen = useChatUi((s) => s.chatOpen);

  const ctx = ctxFor(pathname);
  // Аль хэдийн гаргасан/хаасан эсэх (session). Идэвхтэй ажиллаж эхлэхээс өмнө шалгана.
  const doneRef = useRef(false);

  // Эхний орж ирэнгүүт дайрахгүй — 5с зөөлөн саатал (хэрэглэгч хуудсыг ойлгох зав)
  const armedRef = useRef(false);

  useEffect(() => {
    // everyVisit (checkout) → SEEN_KEY БИШ, харин DISMISSED key (X дарсан) шалгана:
    // орох болгонд гарна, гэхдээ X дарж хаасан бол тэр session-д дахин гарахгүй.
    const stateKey = ctx.everyVisit ? CHECKOUT_DISMISSED_KEY : SEEN_KEY;

    doneRef.current = false; // pathname солигдоход дахин эхэлнэ (everyVisit-д чухал)
    armedRef.current = false;

    // Аль хэдийн харсан/хаасан бол огт ажиллахгүй
    try { if (sessionStorage.getItem(stateKey)) doneRef.current = true; } catch { /* алгасна */ }
    if (doneRef.current) return;

    const armTimer = setTimeout(() => { armedRef.current = true; }, 5_000);

    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (doneRef.current || !armedRef.current) return;
      // panel нээлттэй бол гаргахгүй (давхцахгүй)
      if (useChatUi.getState().helpOpen || useChatUi.getState().chatOpen) return;
      doneRef.current = true;
      // everyVisit бол SEEN тэмдэглэхгүй (дараагийн орохд дахин гарна). everyVisit
      // биш бол SEEN (session 1 удаа).
      if (!ctx.everyVisit) { try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* алгасна */ } }
      setShow(true);
    };

    // ── Idle tracker ── хөдөлгөөн болгонд timer reset, idleMs дуусвал гарна
    const resetIdle = () => {
      if (doneRef.current) return;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(trigger, ctx.idleMs);
    };
    const evs = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    evs.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();

    // ── Scroll tracker ── тодорхой % доош гүйвэл гарна (босго > 0 бол)
    const onScroll = () => {
      if (doneRef.current || !armedRef.current || ctx.scrollPct <= 0) return;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (h <= 0) return;
      const pct = (window.scrollY / h) * 100;
      if (pct >= ctx.scrollPct) trigger();
    };
    if (ctx.scrollPct > 0) window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      clearTimeout(armTimer);
      if (idleTimer) clearTimeout(idleTimer);
      evs.forEach((e) => window.removeEventListener(e, resetIdle));
      window.removeEventListener('scroll', onScroll);
    };
    // pathname солигдвол context (idle/scroll/текст) шинэчилнэ
  }, [pathname, ctx.idleMs, ctx.scrollPct, ctx.everyVisit]);

  // 8с дараа аяндаа арилна (хэрэглэгч анзаараагүй бол шахахгүй)
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 8_000);
    return () => clearTimeout(t);
  }, [show]);

  // panel нээгдвэл bubble шууд алга
  useEffect(() => {
    if (helpOpen || chatOpen) setShow(false);
  }, [helpOpen, chatOpen]);

  const onOpen = () => {
    setShow(false);
    requestOpenHelp(); // help panel нээгдэнэ
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          // Help icon-ийн ЗҮҮН талд (icon: right-5/md:right-6, bottom-[6.5rem]/md:bottom-[7rem])
          className="fixed z-[58] right-[6rem] bottom-[7.5rem] md:right-[6.5rem] md:bottom-[8rem]"
          initial={{ opacity: 0, x: 16, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 16, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          style={{ transformOrigin: 'bottom right' }}
        >
          <div
            className="relative flex max-w-[240px] items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-sm font-medium shadow-xl"
            style={{ color: '#022179', boxShadow: '0 8px 28px rgba(2,33,121,0.22)' }}
          >
            <button onClick={onOpen} className="pr-3 text-left leading-snug">
              {ctx.text}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShow(false);
                // checkout (everyVisit) — X дарвал тэр session-д дахин гарахгүй
                if (ctx.everyVisit) { try { sessionStorage.setItem(CHECKOUT_DISMISSED_KEY, '1'); } catch { /* алгасна */ } }
              }}
              aria-label="Хаах"
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-white"
              style={{ background: '#022179' }}
            >
              <X className="h-3 w-3" />
            </button>
            {/* icon руу заасан сум (баруун доод буланд) */}
            <span
              className="absolute -bottom-1.5 right-4 h-3 w-3 rotate-45 bg-white"
              style={{ boxShadow: '2px 2px 4px rgba(2,33,121,0.08)' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
