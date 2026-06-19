'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  HelpCircle, X, Play, ChevronRight, Bot, PlayCircle,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@digitalger/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@digitalger/shared/ui';
import { helpApi, type HelpVideoItem, type HelpFaqItem } from '@/lib/api';
import { getSessionId as getAnalyticsSessionId } from '@/lib/analytics';
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
  // R2 файл (videoKey) — HLS (.m3u8) бол hls.js stream, mp4 (хуучин) бол шууд.
  if (video.videoKey) {
    return <HlsVideo src={video.videoKey} poster={video.posterKey ?? undefined} title={video.title} />;
  }
  return null;
}

// R2 видео тоглуулагч — .m3u8 (HLS) бол hls.js (Chrome/Android) эсвэл native
// (Safari/iOS), .mp4 (хуучин) бол шууд <video src>. Том видео segment-ээр хурдан.
function HlsVideo({ src, poster, title }: { src: string; poster?: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const isHls = /\.m3u8($|\?)/i.test(src);

  useEffect(() => {
    const video = ref.current;
    if (!video || !isHls) return;
    // Safari/iOS — native HLS
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }
    // Chrome/Android — hls.js (SSR-д import хийхгүй)
    let hls: import('hls.js').default | null = null;
    let cancelled = false;
    import('hls.js').then((mod) => {
      if (cancelled) return;
      const Hls = mod.default;
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true });
        hls.loadSource(src);
        hls.attachMedia(video);
      } else {
        video.src = src; // fallback
      }
    });
    return () => { cancelled = true; if (hls) hls.destroy(); };
  }, [src, isHls]);

  return (
    <video
      ref={ref}
      // mp4 (HLS биш) бол шууд src; HLS бол useEffect-д тавина
      src={isHls ? undefined : src}
      poster={poster}
      controls
      autoPlay
      playsInline
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
      // ⚠️ aspect ХАТУУ заахгүй — босоо/хэвтээ видео бодит харьцаагаар (object-contain).
      className="max-h-[85dvh] w-full rounded-xl bg-black object-contain"
      title={title}
    />
  );
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
      className="group flex w-full items-start gap-3 rounded-xl border border-border bg-card p-2.5 text-left transition-colors hover:border-primary hover:bg-muted"
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
        {/* Title БҮТЭН харагдана (таслахгүй wrap) */}
        <p className="text-sm font-semibold leading-snug wrap-break-word">{video.title}</p>
        {video.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{video.description}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 self-start pt-0.5">
        {video.durationLabel && (
          <span className="text-[11px] tabular-nums text-muted-foreground">{video.durationLabel}</span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

// ⚠️ Analytics-ийн sessionId (dg_sid)-ийг ашиглана — backfill (зочин→login) ИЖИЛ
// sessionId-аар хайдаг тул заавал тэр (өмнө dg-chat-session байсан нь backfill-д
// таарахгүй → зочны үзэлт userId-д холбогдохгүй байв).
function getHelpSessionId(): string | undefined {
  return getAnalyticsSessionId() || undefined;
}

export function HelpAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'videos' | 'faq' | 'ai'>('videos');
  const [playing, setPlaying] = useState<HelpVideoItem | null>(null);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  // Нэвтэрсэн бол userId ШУУД track-д (admin хэрэглэгчийн detail-д шууд харагдана).
  const { data: session } = useSession();
  const uid = session?.user?.id;
  // Үзэлт давхар бүртгэхгүйн тулд (нэг session-д нэг видео/FAQ нэг л удаа).
  const trackedRef = useRef<Set<string>>(new Set());
  const playVideo = (v: HelpVideoItem) => {
    setPlaying(v);
    if (!trackedRef.current.has('v:' + v.id)) {
      trackedRef.current.add('v:' + v.id);
      helpApi.trackVideoView(v.id, getHelpSessionId(), uid, 'help');
    }
  };
  const openFaqItem = (f: HelpFaqItem, expanded: boolean) => {
    setOpenFaq(expanded ? null : f.id);
    if (!expanded && !trackedRef.current.has('f:' + f.id)) {
      trackedRef.current.add('f:' + f.id);
      helpApi.trackFaqView(f.id, getHelpSessionId(), uid);
    }
  };
  const requestOpenChat = useChatUi((s) => s.requestOpenChat);
  const requestCloseChat = useChatUi((s) => s.requestCloseChat);
  const closeHelpSignal = useChatUi((s) => s.closeHelpSignal);
  const openHelpSignal = useChatUi((s) => s.openHelpSignal);
  const setHelpOpen = useChatUi((s) => s.setHelpOpen);

  // ── Chat ↔ Help ХАРИЛЦАН ХААХ ──
  // Chat нээгдэв → help хаа (store-аас closeHelpSignal сигнал)
  const lastCloseHelpRef = useRef(0);
  useEffect(() => {
    if (closeHelpSignal > 0 && closeHelpSignal !== lastCloseHelpRef.current) {
      lastCloseHelpRef.current = closeHelpSignal;
      setOpen(false);
    }
  }, [closeHelpSignal]);
  // Help bubble → help panel нээх сигнал
  const lastOpenHelpRef = useRef(0);
  useEffect(() => {
    if (openHelpSignal > 0 && openHelpSignal !== lastOpenHelpRef.current) {
      lastOpenHelpRef.current = openHelpSignal;
      setOpen(true);
    }
  }, [openHelpSignal]);
  // Help нээгдэх бүрд chat-ийг хаа + store-д төлөв мэдэгдэх (bubble давхцахгүй)
  useEffect(() => {
    if (open) requestCloseChat();
    setHelpOpen(open);
  }, [open, requestCloseChat, setHelpOpen]);

  // Mobile эсэх (товчны drag байрлалд panel тааруулах нь зөвхөн mobile-д)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
          // ⚠️ Chat launcher-тэй ИЖИЛ 64×64. Help нь chat-ийн ДЭЭР (chat орой + 12px зай).
          // Chat: mobile bottom-5(20)/product bottom-32(128), desktop md:bottom-6(24).
          // Chat өндөр 64. Help = chat орой + 12: бусад 96px(bottom-24), product 204px,
          // desktop 100px. ⚠️ Product detail desktop-д chat md:bottom-6 хэвээр тул
          // help desktop ТОГТМОЛ (зөвхөн mobile product detail дээр дээш).
          'fixed right-5 z-[59] flex items-center justify-center rounded-full text-white transition-[bottom] duration-300 touch-none md:right-6',
          isProductDetail ? 'bottom-[12.75rem]' : 'bottom-24',
          'md:bottom-[6.25rem]',
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
                // ? icon: bottom-[6.5rem]≈104px + h-64px = орой ≈168px. Panel доод ирмэг
                // түүнээс дээш. ⚠️ dragY (товч чирсэн) panel-д ч НЭМНЭ (inline style доор)
                // — товчийг дээш чирвэл panel ч дээш, товчтойгоо хамт хөдөлнө.
                // Mobile: тогтмол өндөр 68dvh (bottom clamp хийхэд найдвартай).
                'right-3 left-3 h-[68dvh] max-h-[68dvh]',
                // Desktop bottom (md:bottom-[11.5rem]) — drag desktop-д ховор тул тогтмол.
                'md:bottom-[11.5rem] md:right-6 md:left-auto md:h-[min(560px,calc(100dvh-14rem))] md:max-h-none md:w-[400px]',
              )}
              // ⚠️ MOBILE: bottom = товчны drag байрлал, ГЭХДЭЭ clamp хийнэ:
              //   доод 88px (товчны дээр), дээд 100dvh-68dvh-1rem (panel дэлгэцийн
              //   ДЭЭД ирмэгээс ГАРАХГҮЙ). clamp(min, preferred, max). Товч хэт дээш
              //   бол panel дээд хязгаарт ТОГТОНО (дээш алга болохгүй).
              style={isMobile
                ? { transformOrigin: 'bottom right', bottom: `clamp(88px, calc(11.5rem - ${dragY}px), calc(100dvh - 68dvh - 1rem))` }
                : { transformOrigin: 'bottom right' }}
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
                        {/* Help самбарт БҮХ видео харагдана (platform нь зөвхөн
                            product detail-д mobile/desktop алийг харуулахыг заана). */}
                        {videos.map((v) => <VideoRow key={v.id} video={v} onPlay={() => playVideo(v)} />)}
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
                                onClick={() => openFaqItem(f, expanded)}
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
              // ⚠️ Mobile (босоо видео) нарийн өргөн + өндөр давамгай; desktop ТОМ
              // (max-w-5xl). Видео object-contain тул босоо/хэвтээ бүтэн багтана.
              className="flex max-h-[92dvh] w-full max-w-[min(95vw,28rem)] flex-col md:max-w-5xl"
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
