'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X, Send, Bot, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import type { DotLottie } from '@lottiefiles/dotlottie-react';
import { cn } from '@digitalger/shared';
import { chatApi } from '@/lib/api';
import { CHAT_WEBHOOK_URL } from '@/lib/constants';

// ── Төрлүүд ──
interface ChatProduct {
  id: string | null;
  title: string;
  price: number | null;
  salePrice: number | null;
  imageUrl: string | null;
  url: string | null;
}
interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  products?: ChatProduct[];
}

const STORAGE_SESSION = 'dg-chat-session';
const STORAGE_HISTORY = 'dg-chat-history';

// Төхөөрөмж бүрд тогтсон sessionId (Postgres Memory яриаг сэргээнэ)
function getSessionId(): string {
  try {
    let s = localStorage.getItem(STORAGE_SESSION);
    if (!s) {
      s = 'web_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(STORAGE_SESSION, s);
    }
    return s;
  } catch {
    return 'web_anon';
  }
}

function fmt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '₮';
}

// Bot мессежийн текст доторх URL болон email-ийг дарж болох линк болгоно.
// URL → <a href>, email → mailto:. Бусад текстийг хэвээр үлдээнэ.
function renderRichText(text: string): React.ReactNode[] {
  // URL (https/http) болон email-ийг таних нэгдсэн regex
  const pattern = /(https?:\/\/[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    const isEmail = token.includes('@') && !token.startsWith('http');
    // URL төгсгөлийн цэг/таслалыг линкээс хасна (өгүүлбэрийн цэг)
    const trail = token.match(/[.,;:!?)]+$/);
    const clean = trail ? token.slice(0, token.length - trail[0].length) : token;
    const href = isEmail ? `mailto:${clean}` : clean;
    parts.push(
      <a
        key={'l' + key++}
        href={href}
        target={isEmail ? undefined : '_blank'}
        rel="noopener noreferrer"
        className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
        onClick={(e) => e.stopPropagation()}
      >
        {clean}
      </a>,
    );
    if (trail) parts.push(trail[0]);
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Бүтээгдэхүүн carousel — back/forward сумтай хэвтээ гүйлгэх.
function ProductCarousel({ products }: { products: ChatProduct[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', update, { passive: true });
    return () => el.removeEventListener('scroll', update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length]);

  const scrollBy = (dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * 180, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        className="-mx-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-1.5 scrollbar-thin"
      >
        {products.map((p, i) => (
          <a
            key={p.id || i}
            href={p.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex w-40 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border bg-background transition-colors hover:border-primary/40"
          >
            <div className="relative aspect-4/3 w-full overflow-hidden bg-muted">
              {p.imageUrl ? (
                <Image
                  src={p.imageUrl}
                  alt={p.title}
                  fill
                  sizes="160px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Bot className="h-6 w-6" />
                </div>
              )}
              {p.salePrice != null && p.price != null && p.price > p.salePrice && (
                <span className="absolute left-1.5 top-1.5 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-secondary-foreground">
                  -{Math.round((1 - p.salePrice / p.price) * 100)}%
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-2">
              <p className="line-clamp-2 min-h-8 text-xs font-semibold text-foreground">{p.title}</p>
              <p className="mt-auto flex flex-wrap items-baseline gap-1.5">
                {p.salePrice != null ? (
                  <>
                    <span className="text-sm font-bold text-primary">{fmt(p.salePrice)}</span>
                    {p.price != null && (
                      <span className="text-[11px] text-muted-foreground line-through">{fmt(p.price)}</span>
                    )}
                  </>
                ) : (
                  p.price != null && <span className="text-sm font-bold text-primary">{fmt(p.price)}</span>
                )}
              </p>
            </div>
          </a>
        ))}
      </div>

      {/* Back/forward сум (зөвхөн гүйлгэх боломжтой үед) */}
      {canLeft && (
        <button
          type="button"
          aria-label="Өмнөх"
          onClick={() => scrollBy(-1)}
          className="absolute -left-1 top-[38%] flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-md transition-colors hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          aria-label="Дараах"
          onClick={() => scrollBy(1)}
          className="absolute -right-1 top-[38%] flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-md transition-colors hover:bg-muted"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'bot',
  text: 'Сайн байна уу! 👋 Би DigitalGer-ийн AI туслах. Танд бизнес төсөл, ном, видео хичээл, баримтын загвар хайхад тусална. Юу хайж байна вэ?',
};

export function ChatWidget() {
  const pathname = usePathname();
  const { data: session } = useSession();
  // Зөвхөн product details (/products/<slug>) хуудсанд mobile sticky "худалдан авах"
  // bar + discount байдаг. Тэр үед mobile-д чат дүрсийг ДЭЭШ зөөнө (давхцахгүйн тулд).
  // Бусад хуудас / desktop → ердийн доод байрлал. /products (жагсаалт) ОРОХГҮЙ.
  const isProductDetail = /^\/products\/[^/]+$/.test(pathname || '');

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Floating дүрсний Lottie робот ──
  // Хэвийн үед тэвчээр (зогссон), hover үед тоглоно. Мөн анхаарал татахаар
  // 6 секунд тутам нэг удаа богино тоглоод зогсоно.
  const dotLottieRef = useRef<DotLottie | null>(null);
  const playBot = () => {
    const dl = dotLottieRef.current;
    if (!dl) return;
    try {
      dl.setMode('forward');
      dl.stop();
      dl.play();
    } catch {
      /* player бэлэн биш бол алгасна */
    }
  };
  useEffect(() => {
    if (open) return; // нээлттэй үед floating дүрс харагдахгүй
    const id = setInterval(playBot, 6000);
    return () => clearInterval(id);
  }, [open]);

  // Нэвтэрсэн хэрэглэгчийн зочны chat session-ийг userId-д холбох (backfill).
  // sessionId хэвээр (зочны яриа алдагдахгүй), зөвхөн backend дээр userId холбоно.
  // Token бүрд НЭГ удаа (давхар дуудлагаас сэргийлж linked ref ашиглана).
  const linkedTokenRef = useRef<string | null>(null);
  useEffect(() => {
    const token = session?.accessToken;
    if (!token) return;
    if (linkedTokenRef.current === token) return; // энэ token-оор аль хэдийн холбосон
    linkedTokenRef.current = token;
    const sessionId = getSessionId();
    chatApi.linkSession(token, sessionId).catch(() => {
      // алдаа гарвал дараагийн render-д дахин оролдохын тулд тэмдгийг арилгана
      linkedTokenRef.current = null;
    });
  }, [session?.accessToken]);

  // Яриаг localStorage-аас сэргээх
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      }
    } catch {
      /* алгасна */
    }
  }, []);

  // Яриа өөрчлөгдөх бүрд хадгалах + доош гүйлгэх
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(messages.slice(-40)));
    } catch {
      /* алгасна */
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // Нээгдэхэд: хамгийн сүүлийн мессеж рүү шууд гүйлгэх + input-д focus.
  // Цонх нээгдэх анимэйшн дуустал (~350ms) хүлээж, instant (smooth биш) scroll.
  useEffect(() => {
    if (!open) return;
    const t1 = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 60);
    const t2 = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      inputRef.current?.focus();
    }, 380);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: ChatMessage = { id: 'u' + Date.now(), role: 'user', text };
    // Meta Pixel Contact — чатаар анхны мессеж илгээх үед (нэг удаа)
    if (!messages.some((m) => m.role === 'user')) {
      try {
        const fbq = (window as unknown as { fbq?: (a: string, e: string) => void }).fbq;
        if (typeof fbq === 'function') fbq('track', 'Contact');
      } catch { /* ignore */ }
    }
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch(CHAT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: getSessionId(), message: text }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          id: 'b' + Date.now(),
          role: 'bot',
          text: data?.reply || 'Уучлаарай, хариу авч чадсангүй. Дахин оролдоно уу.',
          products: Array.isArray(data?.products) ? data.products : [],
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: 'e' + Date.now(),
          role: 'bot',
          text: 'Сүлжээний алдаа гарлаа 🙏 Дараа дахин оролдоно уу, эсвэл info@digitalger.mn хаягаар холбогдоорой.',
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
  };

  return (
    <>
      {/* Floating товч (баруун доод булан) */}
      <motion.button
        type="button"
        aria-label="AI туслахтай чатлах"
        onClick={() => setOpen((o) => !o)}
        // Mobile: product details хуудсанд л дээш (худалдан авах bar + discount-ийг
        // хаахгүйн тулд bottom-32). Бусад хуудсанд ердийн доод (bottom-5).
        // Desktop: ямар ч хуудсанд доод буланд хэвээр (md:bottom-6).
        className={cn(
          'fixed right-5 z-[60] flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-[bottom] duration-300 hover:bg-primary/90 md:bottom-6 md:right-6',
          isProductDetail ? 'bottom-32' : 'bottom-5',
        )}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        // Hover үед робот тоглоно
        onMouseEnter={playBot}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span
              key="bot"
              className="flex h-full w-full items-center justify-center"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
            >
              {/* Хөдөлгөөнт робот (Lottie). Хэвийн үед эхний frame, hover/үе үе тоглоно. */}
              <DotLottieReact
                src="/digitalgerBot.json"
                autoplay
                loop={false}
                dotLottieRefCallback={(dl) => {
                  dotLottieRef.current = dl;
                }}
                className="h-12 w-12"
              />
            </motion.span>
          )}
        </AnimatePresence>
        {/* Анхаарал татах цэг (нээгээгүй үед) */}
        {!open && (
          <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-secondary" />
          </span>
        )}
      </motion.button>

      {/* Чат цонх */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            // Product details mobile-д чат цонх ч дээш (buy bar-аас зайтай).
            // Desktop md:bottom-24 хэвээр.
            className={cn(
              'fixed right-3 z-[60] flex w-[calc(100vw-1.5rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl md:bottom-24 md:right-6 md:h-[min(620px,calc(100dvh-7rem))]',
              isProductDetail
                ? 'bottom-36 h-[min(560px,calc(100dvh-11rem))]'
                : 'bottom-24 h-[min(620px,calc(100dvh-7rem))]',
            )}
          >
            {/* Толгой */}
            <div className="flex items-center justify-between gap-3 bg-primary px-4 py-3 text-primary-foreground">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">DigitalGer AI</p>
                  <p className="flex items-center gap-1 text-[11px] text-primary-foreground/80">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                    Онлайн · хариу өгөхөд бэлэн
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={resetChat} aria-label="Чат цэвэрлэх" className="rounded-md p-1.5 text-primary-foreground/80 transition-colors hover:bg-white/10 hover:text-primary-foreground">
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setOpen(false)} aria-label="Хаах" className="rounded-md p-1.5 text-primary-foreground/80 transition-colors hover:bg-white/10 hover:text-primary-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Мессежүүд */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/30 px-3 py-4">
              {messages.map((m) => (
                <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] space-y-2', m.role === 'user' ? '' : 'w-full')}>
                    <div
                      className={cn(
                        'whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                        m.role === 'user'
                          ? 'rounded-br-md bg-primary text-primary-foreground'
                          : 'rounded-bl-md border border-border bg-background text-foreground',
                      )}
                    >
                      {m.role === 'bot' ? renderRichText(m.text) : m.text}
                    </div>
                    {/* Бүтээгдэхүүн carousel (back/forward сумтай, зураг 4:3) */}
                    {m.products && m.products.length > 0 && <ProductCarousel products={m.products} />}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border bg-background px-4 py-3">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Оруулах талбар */}
            <div className="border-t border-border bg-background p-2.5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Мессеж бичих..."
                  className="flex-1 rounded-full border border-border bg-muted/40 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-background"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  aria-label="Илгээх"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground">DigitalGer AI — Ухаалаг онлайн туслах</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
