'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  HelpCircle, X, Play, ChevronRight, Bot, PlayCircle,
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
        Видео нээх &#8599;
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
  // ⚠️ Хуучин утас (iOS<15.4): opacity utility (/70,/40,/10) → color-mix() → УНАНА.
  // Тиймээс энгийн theme класс (HEX fallback-тай) + rgba inline ашиглана.
  // Thumbnail: poster зураг байвал тэр, эс бол upload видеоны ЭХНИЙ FRAME
  // (<video preload=metadata #t=0.1>), эс бол PlayCircle placeholder.
  const poster = video.posterKey;
  const videoSrc = video.videoKey || video.videoUrl;
  return (
    <button
      onClick={onPlay}
      className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-2.5 text-left transition-colors hover:border-primary hover:bg-muted"
    >
      <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt={video.title} className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        ) : videoSrc ? (
          // Upload видеоны эхний frame preview (тоглуулахгүй, зөвхөн poster болгож)
          <video src={`${videoSrc}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: 'rgba(2,33,121,0.10)' }}>
            <PlayCircle className="h-5 w-5 text-primary" />
          </div>
        )}
        <span
          className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: 'rgba(0,0,0,0.35)' }}
        >
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
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
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

  // Esc — эхлээд видео lightbox, дараа нь panel хаах
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPlaying((p) => { if (p) return null; setOpen(false); return p; });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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
        style={{
          width: 64, height: 64, minWidth: 64, minHeight: 64,
          // gradient inline (iOS<15.4 найдвартай HEX, bg-gradient utility oklch-д унадаг)
          background: 'linear-gradient(135deg, #022179 0%, #1e40af 100%)',
          boxShadow: '0 10px 25px rgba(2,33,121,0.3)',
        }}
        className={cn(
          // ⚠️ Chat launcher-тэй ИЖИЛ 64×64. Chat: right-5/md:right-6, bottom-5/md:bottom-6.
          // Help нь chat-ийн ДЭЭР (chat өндөр 64 + 5(bottom)=69px орчим → help-ийг
          // chat дээр ~80px зайтай: bottom 5rem+ ).
          'fixed right-5 z-[59] flex items-center justify-center rounded-full text-white transition-[bottom] duration-300 touch-none md:right-6',
          isProductDetail ? 'bottom-[13rem]' : 'bottom-[6.5rem]',
          'md:bottom-[7rem]',
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
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span key="q" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <HelpCircle className="h-7 w-7" />
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
              className="fixed inset-0 z-[61] md:hidden"
              style={{ background: 'rgba(0,0,0,0.4)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className={cn(
                'fixed z-[62] flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl',
                // ⚠️ Panel нь ? icon-ийн ДЭЭД талаас гарна (icon-ийг дарахгүй).
                // ? icon: mobile bottom-[5.75rem]≈92px + h-52px = орой ≈144px;
                //         desktop md:bottom-[6.25rem]≈100px + 52px = орой ≈152px.
                // Panel-ийн доод ирмэгийг icon оройноос ДЭЭШ тавина (bottom-[10rem]=160px).
                // Баруун талдаа icon-той зэрэгцэнэ (right-5 / md:right-6).
                'bottom-[11rem] right-3 left-3 max-h-[calc(100dvh-13rem)]',
                'md:bottom-[11.5rem] md:right-6 md:left-auto md:w-[400px] md:h-[min(560px,calc(100dvh-14rem))]',
              )}
              // ? icon (доод-баруун) талаас дэлбээрэн нээгдэх — origin доод-баруун
              style={{ transformOrigin: 'bottom right' }}
              initial={{ opacity: 0, y: 16, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              {/* Header — gradient inline (iOS<15.4 найдвартай HEX) */}
              <div
                className="flex items-center justify-between gap-2 px-4 py-3.5 text-white"
                style={{ background: 'linear-gradient(135deg, #022179 0%, #1e40af 100%)' }}
              >
                <div>
                  <p className="flex items-center gap-1.5 text-base font-bold">👋 Сайн байна уу!</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>Юугаар туслах вэ?</p>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Хаах" className="rounded-full p-1.5 transition-colors hover:bg-[#1e40af]">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tabs — видео дарахад тусдаа fullscreen lightbox нээгдэнэ (доор) */}
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
                            <div key={f.id} className="overflow-hidden rounded-xl border border-border bg-card">
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
                    <div className="flex h-16 w-16 items-center justify-center rounded-full text-white" style={{ background: 'linear-gradient(135deg, #022179 0%, #1e40af 100%)' }}>
                      <Bot className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-base font-bold">AI Туслах 🤖</p>
                      <p className="mt-1 text-sm text-muted-foreground">Асуултад тань шууд хариулна. AI туслахтай ярилцахаар доорх товчийг дарна уу.</p>
                    </div>
                    <button
                      onClick={goToAi}
                      className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.02]"
                      style={{ background: 'linear-gradient(135deg, #022179 0%, #1e40af 100%)' }}
                    >
                      AI туслахтай ярих →
                    </button>
                  </TabsContent>
                </Tabs>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Видео Lightbox — БҮТЭН ДЭЛГЭЦ том player (тусдаа overlay) ── */}
      {/* Background эсвэл X дарахад хаагдана. Help panel-ээс ДЭЭГҮҮР (z-[80]). */}
      <AnimatePresence>
        {playing && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPlaying(null)} // background дарахад хаах
          >
            <button
              onClick={() => setPlaying(null)}
              aria-label="Хаах"
              className="absolute right-4 top-4 z-10 rounded-full p-2 text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.12)' }}
            >
              <X className="h-6 w-6" />
            </button>
            <motion.div
              className="w-full max-w-4xl"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onClick={(e) => e.stopPropagation()} // player дотор дарахад хаагдахгүй
            >
              <VideoPlayer video={playing} />
              <div className="mt-3 text-white">
                <p className="text-base font-semibold">{playing.title}</p>
                {playing.description && <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{playing.description}</p>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
