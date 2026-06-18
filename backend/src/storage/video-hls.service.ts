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

export interface HlsResult {
  playlistKey: string; // R2 key: 'help-videos/{uuid}/video.m3u8' (videoKey-д хадгална)
  posterKey: string;   // R2 key: 'help-videos/{uuid}/poster.jpg'
  durationSec: number;
  segmentCount: number;
}

/**
 * Видеог HLS (m3u8 + .ts segment) болгож R2-руу хөрвүүлэх.
 * ⚠️ ЧАНАР БУУРУУЛАХГҮЙ: `-c copy` (codec хуулна, re-encode ХИЙХГҮЙ) — original
 * чанар 100% хадгалагдана, зүгээр segment болгож хуваана (хурдан). Ингэснээр
 * 250MB видео ч segment-ээр stream хийгдэж, гар утас/удаан интернетэд хурдан.
 *
 * Үр дүн: R2-д folder/video.m3u8 + folder/seg_000.ts ... + folder/poster.jpg
 * videoKey = m3u8-ийн public URL. Frontend hls.js-ээр stream хийнэ.
 */
@Injectable()
export class VideoHlsService {
  private readonly logger = new Logger(VideoHlsService.name);

  constructor(private readonly storage: StorageService) {}

  // R2 key-аас шууд (raw видеог ДИСК рүү stream-ээр татаж, memory дүүргэхгүй).
  // ⚠️ Том видео (246MB+) Buffer-д татвал worker OOM (512MB limit) → restart loop.
  async convertKeyAndUpload(rawKey: string, folder = 'videos'): Promise<HlsResult> {
    const uuid = randomUUID();
    const tmpDir = path.join(os.tmpdir(), `hls_${uuid}`);
    await fs.mkdir(tmpDir, { recursive: true });
    const inputPath = path.join(tmpDir, 'input');
    const playlistName = 'video.m3u8';
    const playlistPath = path.join(tmpDir, playlistName);
    const posterPath = path.join(tmpDir, 'poster.jpg');

    try {
      // 0) R2 → диск (stream, memory-гүй)
      await this.storage.downloadToFile(rawKey, inputPath);

      // 1) Үргэлжлэх хугацаа (ffprobe)
      const durationSec = await this.probeDuration(inputPath);

      // 2) HLS segment (re-encode ХИЙХГҮЙ — чанар хадгална)
      await this.toHls(inputPath, playlistPath);

      // 3) Poster (эхний frame, 1 секунд)
      await this.makePoster(inputPath, posterPath).catch(() => null);

      // 4) Гаралт файлуудыг R2-руу — ⚠️ НЭГ НЭГЭЭР (segment бүрийг уншиж upload
      // хийгээд buffer чөлөөлнө). Бүгдийг зэрэг memory-д цуглуулвал том видеонд
      // (246MB → бүх segment) OOM болно. Дискнээс уншиж, тус тусд нь явуулна.
      const files = await fs.readdir(tmpDir);
      const r2Prefix = `${folder}/${uuid}`;
      let segmentCount = 0;

      for (const name of files) {
        if (name === 'input') continue; // raw input upload хийхгүй
        let contentType = 'application/octet-stream';
        if (name.endsWith('.m3u8')) contentType = 'application/vnd.apple.mpegurl';
        else if (name.endsWith('.ts')) { contentType = 'video/mp2t'; segmentCount++; }
        else if (name.endsWith('.jpg')) contentType = 'image/jpeg';
        const buf = await fs.readFile(path.join(tmpDir, name));
        await this.storage.upload(`${r2Prefix}/${name}`, buf, contentType);
        // buf scope-оос гарч GC цэвэрлэнэ (дараагийн iteration-д memory чөлөөтэй)
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

  private toHls(inputPath: string, playlistPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c copy', // ⚠️ re-encode ХИЙХГҮЙ — чанар 100% хадгална, хурдан
          '-start_number 0',
          '-hls_time 6', // 6 секундын segment
          '-hls_list_size 0', // бүх segment playlist-д (VOD)
          '-hls_segment_filename', path.join(path.dirname(playlistPath), 'seg_%03d.ts'),
          '-f hls',
        ])
        .output(playlistPath)
        .on('end', () => resolve())
        .on('error', (e) => reject(e))
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
