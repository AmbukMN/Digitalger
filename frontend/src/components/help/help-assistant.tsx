'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  HelpCircle, X, Play, ChevronRight, Bot, PlayCircle, ChevronLeft,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@digitalger/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@digitalger/shared/ui';
import { helpApi, type HelpVideoItem, type HelpFaqItem } from '@/lib/api';
import { useChatUi } from '@/store/chat-ui';

const DRAG_KEY = 'dg-help-launcher-y';

// ── YouTube ID задлах (watch?v= / youtu.be / embed) ──
function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m ? m[1] : null;
}

// ── Видео тоглуулагч (inline) — эх сурвалжаар нь iframe / video tag ──
function VideoPlayer({ video }: { video: HelpVideoItem }) {
  // Cloudflare Stream
  if (video.videoStreamId) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={`https://iframe.videodelivery.net/${video.videoStreamId}?autoplay=true`}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          title={video.title}
        />
      </div>
    );
  }
  // YouTube/Vimeo гадаад линк
  if (video.videoUrl) {
    const yt = youtubeId(video.videoUrl);
    if (yt) {
      return (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${yt}?autoplay=1&rel=0`}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={video.title}
          />
        </div>
      );
    }
    // Бусад гадаад линк — шинэ tab
    return (
      <a href={video.videoUrl} target="_blank" rel="noopener noreferrer"
        className="flex aspect-video w-full items-center justify-center rounded-xl bg-muted text-sm text-primary underline">
        Видео нээх ↗
      </a>
    );
  }
  // R2 файл (videoKey = public URL)
  if (video.videoKey) {
    return (
      <video
        src={video.videoKey}
        poster={video.posterKey ?? undefined}
        controls
        autoPlay
        playsInline
        className="aspect-video w-full rounded-xl bg-black"
      />
    );
  }
  return null;
}

// ── Видео жагсаалтын мөр ──
function VideoRow({ video, onPlay }: { video: HelpVideoItem; onPlay: () => void }) {
  return (
    <button
      onClick={onPlay}
      className="group flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
        {video.posterKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.posterKey} alt={video.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/10">
            <PlayCircle className="h-5 w-5 text-primary" />
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-5 w-5 fill-white text-white" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{video.title}</p>
        {video.description && (
          <p className="truncate text-xs text-muted-foreground">{video.description}</p>
        )}
      </div>
      {video.durationLabel && (
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{video.durationLabel}</span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
    </button>
  );
}

export function HelpAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'videos' | 'faq' | 'ai'>('videos');
  const [playing, setPlaying] = useState<HelpVideoItem | null>(null);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const requestOpenChat = useChatUi((s) => s.requestOpenChat);
  const requestCloseChat = useChatUi((s) => s.requestCloseChat);
  const closeHelpSignal = useChatUi((s) => s.closeHelpSignal);

  // ── Chat ↔ Help ХАРИЛЦАН ХААХ ──
  // Chat нээгдэв → help хаа (store-аас closeHelpSignal сигнал)
  const lastCloseHelpRef = useRef(0);
  useEffect(() => {
    if (closeHelpSignal > 0 && closeHelpSignal !== lastCloseHelpRef.current) {
      lastCloseHelpRef.current = closeHelpSignal;
      setOpen(false);
    }
  }, [closeHelpSignal]);
  // Help нээгдэх бүрд chat-ийг хаа
  useEffect(() => {
    if (open) requestCloseChat();
  }, [open, requestCloseChat]);

  // Chat launcher-тай давхцахгүйн тулд: product detail mobile-д дээш (chat bottom-32).
  const isProductDetail = /^\/products\/[^/]+$/.test(pathname || '');

  // ── Drag (зөвхөн босоо, chat launcher-тэй ижил pattern) ──
  const [dragY, setDragY] = useState(0);
  const draggedRef = useRef(false);
  useEffect(() => {
    try {
      const v = localStorage.getItem(DRAG_KEY);
      if (v) setDragY(Number(v) || 0);
    } catch { /* алгасна */ }
  }, []);

  // Контент — нээгдсэн үед л татна (lazy)
  const { data: videos = [], isLoading: vLoading } = useQuery({
    queryKey: ['help', 'videos'],
    queryFn: () => helpApi.videos(),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const { data: faqs = [], isLoading: fLoading } = useQuery({
    queryKey: ['help', 'faqs'],
    queryFn: () => helpApi.faqs(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  // "AI Туслах" таб → панель хаагдаж chat widget нээгдэнэ
  const goToAi = () => {
    setOpen(false);
    setTimeout(() => requestOpenChat(), 250); // панель хаагдах animation дуустал
  };

  return (
    <>
      {/* ── Launcher товч (? icon) — chat launcher-ийн ДЭЭР ── */}
      <motion.button
        type="button"
        aria-label="Тусламж"
        onClick={() => { if (!draggedRef.current) setOpen((v) => !v); }}
        style={{ width: 52, height: 52, minWidth: 52, minHeight: 52 }}
        className={cn(
          'fixed right-[26px] z-[59] flex items-center justify-center rounded-full text-white shadow-lg transition-[bottom] duration-300 touch-none',
          // Brand gradient (navy → medium blue), ? icon
          'bg-gradient-to-br from-[#022179] to-[#1e40af] shadow-[#022179]/30 hover:shadow-xl',
          // Chat launcher (h-16=64px, bottom-5/6) дээр 76px зайтай
          isProductDetail ? 'bottom-[12.5rem]' : 'bottom-[5.75rem]',
          'md:bottom-[6.25rem] md:right-[30px]',
        )}
        drag="y"
        dragMomentum={false}
        dragElastic={0.04}
        dragConstraints={{
          top: typeof window !== 'undefined' ? -window.innerHeight * 0.6 : -400,
          bottom: typeof window !== 'undefined' ? window.innerHeight * 0.15 : 100,
        }}
        onDragStart={() => { draggedRef.current = true; }}
        onDragEnd={(_, info) => {
          const next = dragY + info.offset.y;
          setDragY(next);
          try { localStorage.setItem(DRAG_KEY, String(next)); } catch { /* алгасна */ }
          setTimeout(() => { draggedRef.current = false; }, 50);
        }}
        animate={{ y: dragY }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.96 }}
        transition={{ scale: { type: 'tween', duration: 0.18 }, default: { type: 'spring', stiffness: 260, damping: 22 } }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="h-5 w-5" />
            </motion.span>
          ) : (
            <motion.span key="q" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <HelpCircle className="h-6 w-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Help Panel (desktop: баруун доод, mobile: bottom sheet) ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              className="fixed inset-0 z-[61] bg-black/40 md:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className={cn(
                'fixed z-[62] flex flex-col overflow-hidden border border-border bg-background shadow-2xl',
                // Mobile (<md): доороос бүтэн өргөн bottom sheet
                'max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[88dvh] max-md:rounded-t-2xl',
                // Desktop (≥md): ? icon-ийн дэргэд БАРУУН доод хөвөгч panel
                // (chat цонх md:bottom-24, ? icon md:bottom-[6.25rem] — panel доороос дээш)
                'md:bottom-24 md:right-6 md:h-[min(620px,calc(100dvh-8rem))] md:w-[400px] md:rounded-2xl',
              )}
              initial={{ opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2 bg-gradient-to-br from-[#022179] to-[#1e40af] px-4 py-3.5 text-white">
                <div>
                  <p className="flex items-center gap-1.5 text-base font-bold">👋 Сайн байна уу!</p>
                  <p className="text-xs text-white/80">Юугаар туслах вэ?</p>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Хаах" className="rounded-full p-1.5 transition-colors hover:bg-white/15">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Видео тоглуулж байгаа бол player дээр гарна */}
              {playing ? (
                <div className="flex flex-1 flex-col overflow-y-auto p-4">
                  <button onClick={() => setPlaying(null)} className="mb-3 flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="h-4 w-4" /> Буцах
                  </button>
                  <VideoPlayer video={playing} />
                  <p className="mt-3 text-sm font-semibold">{playing.title}</p>
                  {playing.description && <p className="mt-1 text-xs text-muted-foreground">{playing.description}</p>}
                </div>
              ) : (
                <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex flex-1 flex-col overflow-hidden">
                  <TabsList className="mx-4 mt-3 grid w-auto grid-cols-3">
                    <TabsTrigger value="videos">Видео заавар</TabsTrigger>
                    <TabsTrigger value="faq">FAQ</TabsTrigger>
                    <TabsTrigger value="ai">AI Туслах</TabsTrigger>
                  </TabsList>

                  {/* Видео заавар */}
                  <TabsContent value="videos" className="mt-0 flex-1 overflow-y-auto p-4">
                    {vLoading ? (
                      <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
                    ) : videos.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">Видео заавар одоогоор алга</p>
                    ) : (
                      <div className="space-y-2">
                        {videos.map((v) => <VideoRow key={v.id} video={v} onPlay={() => setPlaying(v)} />)}
                      </div>
                    )}
                  </TabsContent>

                  {/* FAQ (accordion) */}
                  <TabsContent value="faq" className="mt-0 flex-1 overflow-y-auto p-4">
                    {fLoading ? (
                      <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />)}</div>
                    ) : faqs.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">Асуулт хариулт одоогоор алга</p>
                    ) : (
                      <div className="space-y-2">
                        {faqs.map((f: HelpFaqItem) => {
                          const expanded = openFaq === f.id;
                          return (
                            <div key={f.id} className="overflow-hidden rounded-xl border border-border/70 bg-card">
                              <button
                                onClick={() => setOpenFaq(expanded ? null : f.id)}
                                className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left"
                              >
                                <span className="text-sm font-medium">{f.question}</span>
                                <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
                              </button>
                              <AnimatePresence initial={false}>
                                {expanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    <p className="whitespace-pre-wrap px-3.5 pb-3 text-xs leading-relaxed text-muted-foreground">{f.answer}</p>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>

                  {/* AI Туслах — дарвал панель хаагдаж AI chat нээгдэнэ */}
                  <TabsContent value="ai" className="mt-0 flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#022179] to-[#1e40af] text-white">
                      <Bot className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-base font-bold">AI Туслах 🤖</p>
                      <p className="mt-1 text-sm text-muted-foreground">Асуултад тань шууд хариулна. AI туслахтай ярилцахаар доорх товчийг дарна уу.</p>
                    </div>
                    <button
                      onClick={goToAi}
                      className="rounded-xl bg-gradient-to-br from-[#022179] to-[#1e40af] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.02]"
                    >
                      AI туслахтай ярих →
                    </button>
                  </TabsContent>
                </Tabs>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
