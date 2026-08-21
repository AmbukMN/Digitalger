'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  RotateCcw,
  Send,
  Star,
  X,
} from 'lucide-react';
import { cn } from '@besttv/shared';
import { LinkPreviewCard, renderRichText, type ChatLinkPreview } from '@besttv/shared/ui';
import { chatApi, type ChatTitleCard } from '@/lib/chat-api';
import { useAuth } from '@/lib/auth-store';
import { useChatUi } from '@/store/chat-ui';

const STORAGE_SESSION = 'btv-chat-session';
const STORAGE_HISTORY = 'btv-chat-history';
const DRAG_KEY = 'btv-chat-launcher-y';
const CHAT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_CHAT_WEBHOOK_URL ?? 'https://bot.digitalger.mn/webhook/besttv-chat';

interface ChatMessage {
  id: string;
  role: 'user' | 'bot' | 'admin';
  text: string;
  titles?: ChatTitleCard[];
  /** ⚠️ Backend нь хадгалах үед OG-г татаж хийсэн — энд татахгүй */
  linkPreview?: ChatLinkPreview | null;
}

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'bot',
  text: 'Сайн байна уу! 👋 Би BestTV-ийн AI туслах. Кино хайх, багц сонгох, төлбөрийн талаар асуугаарай.',
};

/**
 * Төхөөрөмж бүрд тогтмол sessionId — n8n санах ой яриаг сэргээнэ.
 *
 * ⚠️⚠️ `crypto.randomUUID()` — ЭНЭ НЬ ХАМГААЛАЛТЫН ХИЛ.
 *
 * `sessionId`-г мэдсэн хүн тухайн ярианы БҮХ мессежийг уншиж чадна
 * (мөн ярианаас автоматаар салгасан ИМЭЙЛ). Өмнөх `Math.random()` нь
 * криптографийн хувьд найдваргүй — үр дүнг таамаглах боломжтой.
 *
 * ⚠️ Хуучин `web_anon` fallback нь БҮХ хүнд ИЖИЛ утга байсан тул
 * `crypto` дэмжихгүй хөтөч дээр хэрэглэгчид бие биенийхээ яриаг
 * харах байсан. Одоо `Math.random()`-руу л унана (муу ч ялгаатай).
 */
function getSessionId(): string {
  try {
    let s = localStorage.getItem(STORAGE_SESSION);
    if (!s) {
      s =
        'web_' +
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID().replace(/-/g, '')
          : Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem(STORAGE_SESSION, s);
    }
    return s;
  } catch {
    /* ⚠️ localStorage хаалттай (private горим) — санамсаргүй утга буцаана,
       яриа хадгалагдахгүй ч БУСДЫНХ уншигдахгүй */
    return 'web_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

/** Санал болгосон кино — хэвтээ гүйлгэдэг постер карт */
function TitleCarousel({ titles }: { titles: ChatTitleCard[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 4px tolerance — sub-pixel rounding-оос сум анивчихаас сэргийлнэ
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [titles.length, update]);

  const scrollBy = (dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * 136, behavior: 'smooth' }); // карт 124 + gap
  };

  if (!titles.length) return null;

  return (
    <div className="relative mt-2">
      <div
        ref={ref}
        className="-mx-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-1.5"
      >
        {titles.map((t, i) => (
          <a
            key={t.id ?? `${t.slug}-${i}`}
            href={t.url ?? (t.slug ? `/movie/${t.slug}` : '#')}
            className="group flex w-[124px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5 transition-colors hover:border-primary"
          >
            <div className="relative aspect-2/3 w-full overflow-hidden bg-foreground/5">
              {t.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.posterUrl}
                  alt={t.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-foreground/25">
                  <Bot className="h-6 w-6" />
                </div>
              )}
              {t.rating != null && t.rating > 0 && (
                <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-premium backdrop-blur-sm">
                  <Star size={9} className="fill-premium" />
                  {t.rating.toFixed(1)}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-0.5 p-2">
              {/* min-h — 1 мөрт ч 2 мөрт ч картын өндөр ижил (jitter-гүй) */}
              <p className="line-clamp-2 min-h-8 text-[11px] font-semibold leading-tight text-foreground">
                {t.title}
              </p>
              {t.year != null && <p className="mt-auto text-[10px] text-foreground/45">{t.year}</p>}
            </div>
          </a>
        ))}
      </div>

      {canLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Өмнөх"
          className="absolute -left-1 top-[38%] flex h-7 w-7 items-center justify-center rounded-full bg-background/95 text-foreground shadow-md ring-1 ring-white/10"
        >
          <ChevronLeft size={15} />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Дараах"
          className="absolute -right-1 top-[38%] flex h-7 w-7 items-center justify-center rounded-full bg-background/95 text-foreground shadow-md ring-1 ring-white/10"
        >
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const [unreadAdmin, setUnreadAdmin] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const user = useAuth((s) => s.user);
  const openSignal = useChatUi((s) => s.openSignal);
  const closeSignal = useChatUi((s) => s.closeSignal);
  const setChatOpen = useChatUi((s) => s.setChatOpen);

  // ── Товчийг БОСОО чирэх (DigitalGer-тэй ижил) ──
  // Хэрэглэгч товчийг хүссэн өндөртөө зөөж, дараагийн зочлолтод санагдана.
  const [dragY, setDragY] = useState(0);
  const draggedRef = useRef(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(DRAG_KEY);
      if (v) setDragY(Number(v) || 0);
    } catch {
      /* private mode — алгасна */
    }
  }, []);

  const lastOpenRef = useRef(0);
  const lastCloseRef = useRef(0);
  const lastMsgAtRef = useRef<string | null>(null);
  const linkedUserRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Гаднаас нээх/хаах сигнал ──
  useEffect(() => {
    if (openSignal > 0 && openSignal !== lastOpenRef.current) {
      lastOpenRef.current = openSignal;
      setOpen(true);
    }
  }, [openSignal]);

  useEffect(() => {
    if (closeSignal > 0 && closeSignal !== lastCloseRef.current) {
      lastCloseRef.current = closeSignal;
      setOpen(false);
    }
  }, [closeSignal]);

  useEffect(() => setChatOpen(open), [open, setChatOpen]);

  // ── Esc товчоор хаах ──
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  /**
   * ── Нэвтэрсэн үед зочны яриаг холбоно ──
   *
   * ⚠️⚠️ `open` нь ХАМААРАЛД ЗААВАЛ БАЙХ ЁСТОЙ (бодит алдаа).
   *
   * Өмнө нь зөвхөн `user?.id` байсан тул холболт нь widget MOUNT
   * болсон агшинд НЭГ Л УДАА оролддог байв. Гэтэл:
   *   • хэрэглэгч зочноор чат бичээд ДАРАА нь бүртгүүлбэл
   *   • эсвэл link хүсэлт сүлжээний алдаанд унавал
   * яриа ЗОЧНЫ хэвээр үлдэж, админд «Зочин» гэж харагдана — хэн
   * бичсэн нь мэдэгдэхгүй, хариу нь ч эзэндээ хүрэхгүй (бодит гомдол).
   *
   * Одоо чат НЭЭХ бүрд шалгана. `linkedUserRef` нь амжилттай
   * холбогдсоны дараа давтахаас сэргийлнэ (нэг хэрэглэгчид нэг л удаа).
   */
  useEffect(() => {
    if (!open) return;
    if (!user?.id || linkedUserRef.current === user.id) return;
    linkedUserRef.current = user.id;
    chatApi.linkSession(getSessionId()).catch((e: { status?: number }) => {
      /**
       * ⚠️ 401 үед ДАХИН БҮҮ ОРОЛД.
       *
       * Өмнө нь ямар ч алдаанд `null` болгож "дахин оролдоно" гэдэг байв.
       * Гэтэл `user` объект нь setUser бүрд ШИНЭ reference авдаг тул effect
       * дахин ажиллаж, 401 → null → дахин 401 гэсэн ТӨГСГӨЛГҮЙ ДАВТАЛТ
       * үүсгэж, хэрэглэгчийн console-ыг дүүргэдэг байв.
       * Токен хүчингүй бол дахин оролдох нь утгагүй — нэвтрэлт сэргэхэд
       * `user.id` шинэчлэгдэж энэ effect өөрөө дахин ажиллана.
       */
      if (e?.status === 401 || e?.status === 403) return;
      linkedUserRef.current = null; // зөвхөн сүлжээ/сервер алдаанд дахин оролдоно
    });
  }, [user?.id, open]);

  // ── Түүх сэргээх ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      }
    } catch {
      /* private mode — алгасна */
    }
  }, []);

  // ── Түүх хадгалах (сүүлийн 40) + доош гүйлгэх ──
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(messages.slice(-40)));
    } catch {
      /* алгасна */
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // ── Нээгдэхэд доош гүйлгэж, оруулах талбарт фокус ──
  useEffect(() => {
    if (!open) return;
    const t1 = setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 60);
    // 380мс = панелийн spring анимаци дуусах хугацаа
    const t2 = setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      inputRef.current?.focus();
    }, 380);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open]);

  // ── Polling: НЭЭЛТТЭЙ үед 6 сек ──
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const poll = async () => {
      try {
        const res = await chatApi.getMessages(getSessionId(), lastMsgAtRef.current ?? undefined);
        if (!alive) return;
        setHandedOff(res.handedOff);
        if (res.messages.length) {
          const isFirst = lastMsgAtRef.current === null;
          lastMsgAtRef.current = res.messages[res.messages.length - 1].createdAt;
          /**
           * ⚠️⚠️ ЭХНИЙ ТАТАЛТАД БҮХ ҮҮРГИЙГ АВНА — түүх сэргээх.
           *
           * БОДИТ АЛДАА: түүх нь ЗӨВХӨН `localStorage`-д хадгалагддаг
           * тул өөр төхөөрөмж / browser / private горимд орвол
           * хэрэглэгчийн өөрийн болон AI-ийн мессеж БҮГД АЛГА болж,
           * зөвхөн админы хариу үлддэг байв («чат дээр түүх алга»).
           *
           * Сервер бүх мессежийг хадгалдаг тул эхний polling-д
           * бүгдийг татаж сэргээнэ. Дараагийн удаа `after` шүүлт
           * ажиллах тул зөвхөн ШИНЭ мессеж ирнэ — тэнд optimistic
           * давхардахаас сэргийлж зөвхөн `admin`-ыг авна.
           *
           * ⚠️ `assistant` → widget дотор `bot` гэж нэрлэгддэг.
           */
          const incoming = res.messages
            .filter((m) => (isFirst ? true : m.role === 'admin'))
            .map((m) => ({
              id: m.id,
              role: (m.role === 'assistant' ? 'bot' : m.role) as 'user' | 'bot' | 'admin',
              text: m.text,
              titles: Array.isArray(m.titles) ? m.titles : undefined,
              /* ⚠️ Backend-ийн татсан OG — энд дахин татахгүй */
              linkPreview: m.linkPreview ?? null,
            }));
          if (incoming.length) {
            setMessages((prev) => {
              /**
               * ⚠️ ЭХНИЙ ТАТАЛТАД СЕРВЕР ДАВУУ — localStorage-ийн
               * хуулбарыг ОРЛУУЛНА.
               *
               * Optimistic мессежийн id нь `u{timestamp}` (локал)
               * бөгөөд серверийнхтэй ХЭЗЭЭ Ч таарахгүй тул id-аар
               * нийлүүлбэл БҮГД ХОЁР УДАА харагдана. Сервер бол
               * цорын ганц үнэн эх сурвалж — түүнийг л үлдээнэ.
               */
              if (isFirst) return incoming;
              const ids = new Set(prev.map((p) => p.id));
              const fresh = incoming.filter((m) => !ids.has(m.id));
              return fresh.length ? [...prev, ...fresh] : prev;
            });
          }
        }
        setUnreadAdmin(0);
      } catch {
        /* сүлжээний түр алдаа — дараагийн polling-д оролдоно */
      }
    };
    poll();
    const id = setInterval(poll, 6000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [open]);

  // ── Polling: ХААЛТТАЙ үед 20 сек (зөвхөн badge) ──
  useEffect(() => {
    if (open) return;
    let alive = true;
    const check = async () => {
      try {
        const r = await chatApi.getUnread(getSessionId());
        if (alive) {
          setUnreadAdmin(r.unread);
          setHandedOff(r.handedOff);
        }
      } catch {
        /* алгасна */
      }
    };
    check();
    const id = setInterval(check, 20000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    // Optimistic UI — сүлжээ хүлээхгүй шууд харуулна
    setMessages((m) => [...m, { id: 'u' + Date.now(), role: 'user', text }]);
    setInput('');
    setLoading(true);

    // ⚠️ HANDOFF: админ чатыг авсан бол AI хариулахгүй — n8n РУУ ЯВУУЛАХГҮЙ,
    // зөвхөн backend-д хадгална. Админ polling-оор харж гар хариулна.
    if (handedOff) {
      try {
        await chatApi.saveMessage(getSessionId(), 'user', text);
      } catch {
        /* UI-д харагдсан хэвээр */
      }
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(CHAT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: getSessionId(),
          message: text,
          name: user?.name ?? undefined,
        }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          id: 'b' + Date.now(),
          role: 'bot',
          text: data?.reply || 'Уучлаарай, хариу авч чадсангүй. Дахин оролдоно уу.',
          titles: Array.isArray(data?.titles) ? data.titles : undefined,
          /* ⚠️ Backend-ийн татсан OG — FB/IG/админтай ИЖИЛ карт */
          linkPreview: data?.linkPreview ?? null,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: 'e' + Date.now(),
          role: 'bot',
          text: 'Сүлжээний алдаа гарлаа 🙏 Дараа дахин оролдоно уу.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([WELCOME]);
    try {
      localStorage.removeItem(STORAGE_HISTORY);
    } catch {
      /* алгасна */
    }
    // ⚠️ sessionId-г УСТГАХГҮЙ — n8n санах ой болон админы яриа хэвээр
  };

  return (
    <>
      {/* ── Launcher товч ── */}
      <motion.button
        type="button"
        onClick={() => {
          // Чирсэн бол чат нээхгүй (drag ↔ click зөрчил)
          if (draggedRef.current) {
            draggedRef.current = false;
            return;
          }
          setOpen((o) => !o);
        }}
        aria-label={open ? 'Чат хаах' : 'AI туслахтай чатлах'}
        // ⚠️ ЗӨВХӨН босоо — хэвтээ чирэлт нь карусел/swiper-т саад болно
        drag="y"
        dragMomentum={false}
        dragElastic={0.04}
        dragConstraints={{
          top: typeof window !== 'undefined' ? -window.innerHeight * 0.7 : -500,
          bottom: typeof window !== 'undefined' ? window.innerHeight * 0.2 : 120,
        }}
        onDragStart={() => {
          draggedRef.current = true;
        }}
        onDragEnd={(_e, info) => {
          setDragY((prev) => {
            const next = prev + info.offset.y;
            try {
              localStorage.setItem(DRAG_KEY, String(Math.round(next)));
            } catch {
              /* алгасна */
            }
            return next;
          });
        }}
        initial={{ scale: 0, y: dragY }}
        animate={{ scale: 1, y: dragY }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.96 }}
        transition={{
          // ⚠️ scale-д spring overshoot ХАСав — spring нь scaleX/scaleY-г зөрүүлж
          // icon-ийг ЗУУВАН болгодог байсан
          scale: { type: 'tween', duration: 0.2, ease: 'easeOut' },
          default: { type: 'spring', stiffness: 260, damping: 20 },
        }}
        // ⚠️ Хэмжээг inline-ээр хатуу бэхэлнэ — flex/badge нь товчийг гажуудуулдаг
        style={{ width: 60, height: 60, minWidth: 60, minHeight: 60, flex: '0 0 60px' }}
        // ⚠️ Мобайл дээр доод nav (h~60px + safe area) бүрхэхгүйн тулд дээш
        className="fixed bottom-[calc(var(--mobile-nav-h)+1rem)] right-4 z-[60] flex touch-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/30 md:bottom-6 md:right-6"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <MessageCircle className="h-7 w-7" />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Badge: уншаагүй тоо, эсвэл анхаарал татах цэг */}
        {!open && unreadAdmin > 0 ? (
          <span
            className="absolute -right-1 -top-1 z-10 flex h-5 min-w-5 animate-bounce items-center justify-center rounded-full px-1 text-[11px] font-bold ring-2 ring-primary"
            style={{ backgroundColor: '#e11d48', color: '#fff' }}
          >
            {unreadAdmin > 9 ? '9+' : unreadAdmin}
          </span>
        ) : !open ? (
          <span className="absolute right-0.5 top-0.5 z-10 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-premium-solid opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-premium-solid ring-2 ring-primary" />
          </span>
        ) : null}
      </motion.button>

      {/* ── Панель ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="false"
            aria-label="BestTV AI туслах"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed bottom-[calc(var(--mobile-nav-h)+5rem)] right-3 z-[60] flex h-[65dvh] w-[calc(100vw-1.5rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-background shadow-2xl md:bottom-24 md:right-6 md:h-[min(620px,calc(100dvh-7rem))]"
          >
            {/* Толгой */}
            <div className="flex items-center gap-2.5 bg-primary px-4 py-3 text-primary-foreground">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/15">
                <Bot className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight">
                  {handedOff ? 'BestTV Багийн гишүүн' : 'BestTV AI'}
                </p>
                <p className="flex items-center gap-1 text-[11px] text-foreground/80">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                  {handedOff ? 'Шууд хариулж байна' : 'Онлайн · хариу өгөхөд бэлэн'}
                </p>
              </div>
              <button
                type="button"
                onClick={resetChat}
                aria-label="Чат цэвэрлэх"
                className="rounded-md p-1.5 transition-colors hover:bg-foreground/15"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Хаах"
                className="rounded-md p-1.5 transition-colors hover:bg-foreground/15"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Мессежүүд */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-white/[0.02] p-3.5">
              {handedOff && (
                <div className="rounded-xl border border-green-800 bg-green-900/20 px-3 py-2 text-center text-xs font-medium text-green-400">
                  ✅ Та одоо манай багийн гишүүнтэй шууд ярьж байна
                </div>
              )}

              {messages.map((m) => {
                const isUser = m.role === 'user';
                const isAdmin = m.role === 'admin';
                return (
                  <div
                    key={m.id}
                    className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
                  >
                    <div className={cn('max-w-[85%]', !isUser && 'w-full')}>
                      {isAdmin && (
                        <p className="mb-1 flex items-center gap-1 text-[10px] font-medium text-green-400">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                          Багийн гишүүн
                        </p>
                      )}
                      <div
                        className={cn(
                          'whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                          isUser
                            ? 'rounded-br-md bg-primary text-primary-foreground'
                            : isAdmin
                              ? 'rounded-bl-md border border-green-800 bg-green-900/20 text-foreground'
                              : 'rounded-bl-md border border-foreground/10 bg-foreground/5 text-foreground',
                        )}
                      >
                        {/* ⚠️ Хэрэглэгчийн текстийг холбоос болгохгүй (аюулгүй) */}
                        {isUser ? m.text : renderRichText(m.text)}
                      </div>
                      {/* ⚠️ Кино карт БАЙХГҮЙ үед л OG карт — хоёулаа
                          гарвал нэг мессежид хоёр том блок болно */}
                      {!isUser && !(m.titles && m.titles.length > 0) && (
                        <LinkPreviewCard data={m.linkPreview} />
                      )}
                      {!isUser && m.titles && m.titles.length > 0 && (
                        <TitleCarousel titles={m.titles} />
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-foreground/10 bg-foreground/5 px-4 py-3">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-2 w-2 animate-bounce rounded-full bg-foreground/40"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Оруулах талбар */}
            <div className="border-t border-foreground/10 bg-background p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter = илгээх, Shift+Enter = шинэ мөр
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder="Мессеж бичих..."
                  disabled={loading}
                  className="max-h-24 min-h-[42px] flex-1 resize-none rounded-2xl border border-foreground/12 bg-foreground/5 px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/35 focus:border-primary/60 focus:bg-foreground/8 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  aria-label="Илгээх"
                  className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:brightness-110 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <p className="mt-1.5 text-center text-[10px] text-foreground/30">
                BestTV AI — кино сонгоход тусална
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
