export const VIDEO_QUEUE = 'besttv-video-hls';

export type VideoTarget = 'movie' | 'episode' | 'trailer';

export interface VideoHlsJob {
  target: VideoTarget;
  targetId: string; // movie/trailer → titleId, episode → episodeId
  rawKey: string; // R2 дээрх raw видео key
  /**
   * ⚠️⚠️ АЛЬ САЙТААС ИЛГЭЭСЭН ВЭ.
   *
   * БОДИТ АЛДАА (аудитаар илэрсэн): энэ талбар БАЙГААГҮЙ тул
   * processor нь контекстгүй ажиллаж, хөрвүүлэлт унахад
   * `emitVideoFailed` нь `currentSite()` → ҮРГЭЛЖ `besttv` гэж
   * илгээдэг байв. BestFilm-ийн кино унахад Telegram-д «BestTV»
   * гэж БАТТАЙ ХУДАЛ мэдэгдэнэ — талбаргүй байснаас ч дор.
   *
   * ⚠️ Хуучин (site-гүй) job-ууд queue-д үлдсэн байж болно —
   * processor нь `toSite(undefined)` → `besttv` гэж уншина
   * (буцаах нийцтэй).
   */
  site?: string;
}
