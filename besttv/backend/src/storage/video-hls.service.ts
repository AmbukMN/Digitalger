import { Injectable, Logger } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { StorageService } from './storage.service';

// ⚠️ Docker-т системийн ffmpeg (apk add ffmpeg) байвал ТҮҮНИЙГ ашиглана
// (@ffmpeg-installer alpine-д libs дутуу унадаг). Эс бол installer path руу унана.
const SYSTEM_FFMPEG = '/usr/bin/ffmpeg';
ffmpeg.setFfmpegPath(existsSync(SYSTEM_FFMPEG) ? SYSTEM_FFMPEG : ffmpegInstaller.path);

/**
 * ⚠️ Хөрвүүлэлт мөнхөд гацахаас сэргийлэх хугацаа.
 * `-c copy` тул 1GB видео ч 2-3 минутад дуусах ёстой. 30 минут хэтэрвэл
 * ямар нэг зүйл эвдэрсэн гэсэн үг.
 */
const FFMPEG_TIMEOUT_MS = 30 * 60 * 1000;

/** R2 руу зэрэг илгээх segment-ийн тоо — хурд ба санах ойн тэнцвэр */
const UPLOAD_CONCURRENCY = 6;

export interface HlsResult {
  playlistKey: string; // R2 key: 'videos/{uuid}/video.m3u8' (videoKey-д хадгална — R2 KEY, URL БИШ!)
  posterKey: string; // R2 key: 'videos/{uuid}/poster.jpg'
  durationSec: number;
  segmentCount: number;
}

/** Явцын мэдээлэл — DB-д бичиж админд харуулна */
export interface HlsProgress {
  /** 0-100 */
  percent: number;
  /** download | convert | upload */
  phase: 'download' | 'convert' | 'upload';
}

/**
 * Видеог HLS (m3u8 + .ts segment) болгож R2-руу хөрвүүлэх.
 *
 * ⚠️ ЧАНАР БУУРУУЛАХГҮЙ: `-c copy` (codec хуулна, re-encode ХИЙХГҮЙ) — original
 * чанар 100% хадгалагдана, зүгээр segment болгож хуваана (хурдан). Ингэснээр
 * том видео ч segment-ээр stream хийгдэж, гар утас/удаан интернетэд хурдан.
 *
 * ⚠️ ХУРД: segment-үүдийг R2 руу ЗЭРЭГ (6-аар) илгээнэ — нэг нэгээр илгээвэл
 * 500 segment-тэй кино 10+ минут явна.
 */
@Injectable()
export class VideoHlsService {
  private readonly logger = new Logger(VideoHlsService.name);

  constructor(private readonly storage: StorageService) {}

  /**
   * R2 key-аас HLS болгож R2 руу буцаана.
   *
   * ⚠️ Raw видеог ДИСК рүү stream-ээр татна (Buffer-д татвал том видеонд
   * worker OOM → restart loop).
   *
   * @param onProgress явцыг мэдэгдэх callback (DB-д бичихэд)
   */
  async convertKeyAndUpload(
    rawKey: string,
    folder = 'videos',
    onProgress?: (p: HlsProgress) => void,
  ): Promise<HlsResult> {
    const uuid = randomUUID();
    const tmpDir = path.join(os.tmpdir(), `hls_${uuid}`);
    await fs.mkdir(tmpDir, { recursive: true });
    const inputPath = path.join(tmpDir, 'input');
    const playlistName = 'video.m3u8';
    const playlistPath = path.join(tmpDir, playlistName);
    const posterPath = path.join(tmpDir, 'poster.jpg');

    const report = (phase: HlsProgress['phase'], percent: number) =>
      onProgress?.({ phase, percent: Math.min(99, Math.max(0, Math.round(percent))) });

    try {
      // ── 0) R2 → диск (stream, memory-гүй) — нийт явцын 0-15% ──
      report('download', 2);
      await this.storage.downloadToFile(rawKey, inputPath);
      report('download', 15);

      // ── 1) Үргэлжлэх хугацаа (ffprobe) ──
      const durationSec = await this.probeDuration(inputPath);

      // ── 2) HLS segment (re-encode ХИЙХГҮЙ) — 15-70% ──
      await this.toHls(inputPath, playlistPath, durationSec, (pct) =>
        report('convert', 15 + pct * 0.55),
      );

      // ── 3) Poster (эхний frame) ──
      await this.makePoster(inputPath, posterPath).catch(() => null);
      report('upload', 72);

      // ── 4) Гаралт → R2, ЗЭРЭГ (6-аар) — 72-99% ──
      const files = (await fs.readdir(tmpDir)).filter((n) => n !== 'input');
      const r2Prefix = `${folder}/${uuid}`;
      let segmentCount = 0;
      let done = 0;

      const uploadOne = async (name: string) => {
        let contentType = 'application/octet-stream';
        if (name.endsWith('.m3u8')) contentType = 'application/vnd.apple.mpegurl';
        else if (name.endsWith('.ts')) contentType = 'video/mp2t';
        else if (name.endsWith('.jpg')) contentType = 'image/jpeg';

        const buf = await fs.readFile(path.join(tmpDir, name));
        await this.storage.upload(`${r2Prefix}/${name}`, buf, contentType);
        if (name.endsWith('.ts')) segmentCount++;
        done++;
        report('upload', 72 + (done / files.length) * 27);
      };

      // ⚠️ Хэсэгчлэн зэрэг илгээнэ — бүгдийг зэрэг эхлүүлбэл санах ой дүүрнэ
      for (let i = 0; i < files.length; i += UPLOAD_CONCURRENCY) {
        await Promise.all(files.slice(i, i + UPLOAD_CONCURRENCY).map(uploadOne));
      }

      return {
        playlistKey: `${r2Prefix}/${playlistName}`,
        posterKey: `${r2Prefix}/poster.jpg`,
        durationSec: Math.round(durationSec),
        segmentCount,
      };
    } finally {
      // tmp цэвэрлэх (амжилттай ч, алдаа ч)
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => null);
    }
  }

  private probeDuration(filePath: string): Promise<number> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) return resolve(0);
        resolve(Number(data?.format?.duration) || 0);
      });
    });
  }

  /**
   * HLS segment болгох.
   *
   * ⚠️ ХУГАЦААНЫ ХЯЗГААР ЗААВАЛ — ffmpeg эвдэрсэн файлд мөнхөд гацаж,
   * контент "Боловсруулж байна" төлөвт үүрд үлддэг байсан.
   */
  private toHls(
    inputPath: string,
    playlistPath: string,
    durationSec: number,
    onPercent?: (p: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmd = ffmpeg(inputPath)
        .outputOptions([
          '-c copy', // ⚠️ re-encode ХИЙХГҮЙ — чанар 100% хадгална, хурдан
          '-start_number 0',
          '-hls_time 6', // 6 секундын segment (CDN кэшлэхэд тохиромжтой)
          '-hls_list_size 0', // бүх segment playlist-д (VOD)
          '-hls_flags independent_segments', // сегмент бүр бие даан тоглоно
          '-hls_segment_filename',
          path.join(path.dirname(playlistPath), 'seg_%03d.ts'),
          '-f hls',
        ])
        .output(playlistPath);

      // ⚠️ Гацахаас хамгаалах — timeout болбол ffmpeg-ийг ХҮЧЭЭР зогсооно
      const timer = setTimeout(() => {
        cmd.kill('SIGKILL');
        reject(new Error(`ffmpeg ${FFMPEG_TIMEOUT_MS / 60000} минут хэтэрлээ (гацсан)`));
      }, FFMPEG_TIMEOUT_MS);

      cmd
        .on('progress', (p) => {
          // ⚠️ `-c copy` үед percent найдваргүй тул timemark-аас тооцоолно
          if (durationSec > 0 && p.timemark) {
            const [h, m, s] = p.timemark.split(':').map(Number);
            const sec = (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
            onPercent?.(Math.min(100, (sec / durationSec) * 100));
          } else if (typeof p.percent === 'number') {
            onPercent?.(p.percent);
          }
        })
        .on('end', () => {
          clearTimeout(timer);
          resolve();
        })
        .on('error', (e) => {
          clearTimeout(timer);
          reject(e);
        })
        .run();
    });
  }

  private makePoster(inputPath: string, posterPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: ['1'],
          filename: path.basename(posterPath),
          folder: path.dirname(posterPath),
          size: '640x?',
        })
        .on('end', () => resolve())
        .on('error', (e) => reject(e));
    });
  }
}
