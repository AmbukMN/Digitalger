export const VIDEO_QUEUE = 'besttv-video-hls';

export type VideoTarget = 'movie' | 'episode' | 'trailer';

export interface VideoHlsJob {
  target: VideoTarget;
  targetId: string; // movie/trailer → titleId, episode → episodeId
  rawKey: string; // R2 дээрх raw видео key
}
