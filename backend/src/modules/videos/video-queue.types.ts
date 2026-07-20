// Видео HLS хөрвүүлэлтийн BullMQ queue (worker дээр consume хийнэ).
export const VIDEO_QUEUE = 'video-hls';

// Job payload — raw видеог R2-д түр хадгалаад key дамжуулна (BullMQ-д том buffer
// тавихгүй). Worker R2-аас татаж HLS болгоно.
export interface VideoHlsJob {
  // Аль entity-ийн видеог боловсруулж байгаа: helpVideo (заавар) | lesson (хичээл R2 HLS).
  target: 'helpVideo' | 'lesson';
  targetId: string;       // HelpVideo.id эсвэл Lesson.id
  rawKey: string;         // R2 түр key: 'tmp/{uuid}.mp4' (raw upload)
  folder: string;         // HLS гаралтын R2 folder: 'help-videos' | 'lessons'
}
