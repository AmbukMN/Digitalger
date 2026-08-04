import { Injectable, Logger } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { StorageService } from './storage.service';

// ⚠️ Docker-т системийн ffmpeg (apk add ffmpeg) байвал ТҮҮНИЙГ ашиглана
// (@ffmpeg-installer alpine-д libs дутуу унадаг). Эс бол installer path руу унана.
const SYSTEM_FFMPEG = '/usr/bin/ffmpeg';
/** ⚠️ spawn-д ч хэрэгтэй (ABR хөрвүүлэлт fluent-ffmpeg-гүй шууд ажиллана) */
const FFMPEG_BIN = existsSync(SYSTEM_FFMPEG) ? SYSTEM_FFMPEG : ffmpegInstaller.path;
ffmpeg.setFfmpegPath(FFMPEG_BIN);

/**
 * ⚠️ Хөрвүүлэлт мөнхөд гацахаас сэргийлэх хугацаа.
 *
 * ABR (3 түвшин re-encode) нь `-c copy`-оос ХАМААГҮЙ удаан:
 * VPS-т хэмжсэнээр ~3.3x realtime (30с видео → 9с) тул 2 цагийн кино
 * ~36 минут. 3 цагийн кино + удаан татах хугацааг тооцож 3 цаг тавив.
 */
const FFMPEG_TIMEOUT_MS = 3 * 60 * 60 * 1000;

/** R2 руу зэрэг илгээх segment-ийн тоо — хурд ба санах ойн тэнцвэр */
const UPLOAD_CONCURRENCY = 6;

/**
 * ADAPTIVE BITRATE түвшнүүд (өндөр→бага).
 *
 * ⚠️ Эх файлаас ӨНДӨР түвшин үүсгэхгүй — 480p эх файлыг 1080p болгох нь
 * зөвхөн хэмжээ өсгөж, чанар нэмэгдүүлэхгүй.
 *
 * maxrate/bufsize — сүлжээний хэлбэлзэлд player зөв тооцоолохын тулд.
 * crf өндөр = чанар бага, хэмжээ бага (480p-д зөвшөөрөгдөнө).
 */
const LADDER = [
  { name: '1080p', height: 1080, crf: 21, maxrate: '5000k', bufsize: '10000k', audio: '128k' },
  { name: '720p', height: 720, crf: 23, maxrate: '2800k', bufsize: '5600k', audio: '128k' },
  { name: '480p', height: 480, crf: 25, maxrate: '1400k', bufsize: '2800k', audio: '96k' },
] as const;

/**
 * x264 preset — хурд ↔ хэмжээний тэнцвэр.
 * `veryfast` нь `medium`-ээс ~4 дахин хурдан, файл ~10% том. VPS дээр
 * CPU л хязгаарлагч тул хурдыг сонгов.
 */
const X264_PRESET = 'veryfast';

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
    /**
     * ⚠️ ABR-т ҮНДСЭН playlist нь `master.m3u8` (доторх v0/v1/v2.m3u8 руу
     * заана). Хуучин нэг түвшинтэй видео `video.m3u8`-тай хэвээр — stream
     * gate хоёуланг нь дэмжинэ (нийцтэй байдал).
     */
    const playlistName = 'master.m3u8';
    const playlistPath = path.join(tmpDir, playlistName);
    const posterPath = path.join(tmpDir, 'poster.jpg');

    const report = (phase: HlsProgress['phase'], percent: number) =>
      onProgress?.({ phase, percent: Math.min(99, Math.max(0, Math.round(percent))) });

    try {
      // ── 0) R2 → диск (stream, memory-гүй) — нийт явцын 0-15% ──
      report('download', 2);
      await this.storage.downloadToFile(rawKey, inputPath);
      report('download', 15);

      // ── 1) Үргэлжлэх хугацаа + нягтрал (ffprobe) ──
      const [durationSec, sourceHeight] = await Promise.all([
        this.probeDuration(inputPath),
        this.probeHeight(inputPath),
      ]);

      // ── 2) ABR HLS (3 түвшин re-encode) — 15-70% ──
      await this.toHls(
        inputPath,
        playlistPath,
        durationSec,
        (pct) => report('convert', 15 + pct * 0.55),
        sourceHeight,
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
   * Эх файлын өндөр (px). ABR шатлалыг сонгоход хэрэгтэй.
   *
   * ⚠️ Уншиж чадаагүй бол 1080 гэж үзнэ — бүх түвшин үүсгэнэ. Дутуу
   * түвшинтэй үлдэхээс илүү, илүү хийсэн нь дээр.
   */
  private probeHeight(filePath: string): Promise<number> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) return resolve(1080);
        const v = data?.streams?.find((s) => s.codec_type === 'video');
        resolve(Number(v?.height) || 1080);
      });
    });
  }

  /**
   * Эх файлаас ДООШ буюу тэнцүү түвшнүүдийг сонгоно.
   *
   * ⚠️ 480p эх файлыг 1080p болгох нь зөвхөн хэмжээ өсгөж, чанар
   * нэмэгдүүлэхгүй (байхгүй мэдээллийг зохиож чадахгүй).
   * ⚠️ Хамгийн багадаа НЭГ түвшин буцаана — жижиг эх файл (ж: 360p) орвол
   *    хоосон массив буцаад ffmpeg унах байсан.
   */
  private pickLadder(sourceHeight: number) {
    const fit = LADDER.filter((l) => l.height <= sourceHeight);
    return fit.length > 0 ? fit : [LADDER[LADDER.length - 1]];
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
    sourceHeight = 1080,
  ): Promise<void> {
    const dir = path.dirname(playlistPath);
    const ladder = this.pickLadder(sourceHeight);

    /**
     * ⚠️ ADAPTIVE BITRATE — нэг ffmpeg дуудалтаар 3 түвшин зэрэг үүсгэнэ.
     *
     * Яагаад нэг дуудалт вэ: эх файлыг НЭГ л удаа декодоод (`split`) 3 салаа
     * болгоно. Тусад нь 3 удаа ажиллуулбал декодыг 3 удаа давтаж, ~2 дахин
     * удаан болно.
     *
     * `-var_stream_map` нь аль видео/аудио хосыг аль хувилбарт хамаарахыг
     * зааж, `master.m3u8`-г автоматаар үүсгэнэ. Player түүнийг уншаад
     * сүлжээнийхээ хурдад тохирох түвшнийг ӨӨРӨӨ сонгоно.
     */
    const filter = [
      `[0:v]split=${ladder.length}${ladder.map((_, i) => `[s${i}]`).join('')}`,
      ...ladder.map((l, i) => `[s${i}]scale=-2:${l.height}[v${i}]`),
    ].join(';');

    const opts: string[] = ['-filter_complex', filter];

    ladder.forEach((l, i) => {
      opts.push(
        '-map', `[v${i}]`,
        `-c:v:${i}`, 'libx264',
        `-preset:v:${i}`, X264_PRESET,
        `-crf:v:${i}`, String(l.crf),
        `-maxrate:v:${i}`, l.maxrate,
        `-bufsize:v:${i}`, l.bufsize,
        // ⚠️ Түлхүүр frame-ийг 2 секунд тутам ТААРУУЛНА — эс бөгөөс түвшин
        //    солиход зураг үсэрч, эсвэл огт солигдохгүй.
        `-g:v:${i}`, '48',
        `-keyint_min:v:${i}`, '48',
        `-sc_threshold:v:${i}`, '0',
      );
    });

    // Аудио — түвшин бүрт нэг урсгал (HLS шаарддаг)
    ladder.forEach((l, i) => {
      opts.push('-map', 'a:0?', `-c:a:${i}`, 'aac', `-b:a:${i}`, l.audio, `-ac:a:${i}`, '2');
    });

    opts.push(
      // ⚠️ Утга нь ЗАЙТАЙ мөр — spawn-д тусдаа аргумент болж яг хэвээр очно
      '-var_stream_map', ladder.map((_, i) => `v:${i},a:${i}`).join(' '),
      '-master_pl_name', 'master.m3u8',
      '-hls_time', '6',
      '-hls_list_size', '0',
      '-hls_flags', 'independent_segments',
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', path.join(dir, 'v%v_seg_%03d.ts'),
      '-f', 'hls',
    );

    this.logger.log(
      `ABR: эх ${sourceHeight}p → ${ladder.map((l) => l.name).join(', ')} (${ladder.length} түвшин)`,
    );

    /**
     * ⚠️ fluent-ffmpeg БИШ, spawn-оор ШУУД дуудна.
     *
     * Яагаад: fluent-ffmpeg нь `outputOptions` массивын элемент бүрийг
     * ЗАЙГААР дахин задалдаг. `-var_stream_map "v:0,a:0 v:1,a:1"` нь
     * зайтай утга тул задарч, "v:1,a:1"-ыг ГАРАЛТЫН ФАЙЛ гэж үзээд унадаг.
     * Нэг мөр болгож өгвөл эсрэгээр бүхэлд нь ТАНИХГҮЙ ФЛАГ гэж үзнэ.
     * spawn нь аргумент бүрийг яг байгаагаар нь дамжуулдаг тул найдвартай.
     */
    return new Promise((resolve, reject) => {
      const args = ['-y', '-i', inputPath, ...opts, path.join(dir, 'v%v.m3u8')];
      const proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] });

      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`ffmpeg ${FFMPEG_TIMEOUT_MS / 60000} минут хэтэрлээ (гацсан)`));
      }, FFMPEG_TIMEOUT_MS);

      let lastErr = '';
      proc.stderr.on('data', (buf: Buffer) => {
        const text = buf.toString();
        for (const line of text.split('\n')) {
          // Явц — `time=00:01:23.45` хэлбэрээс тооцоолно
          const m = line.match(/time=(\d+):(\d+):(\d+)/);
          if (m && durationSec > 0) {
            const sec = +m[1] * 3600 + +m[2] * 60 + +m[3];
            onPercent?.(Math.min(100, (sec / durationSec) * 100));
          }
          if (/error|invalid|failed|unrecognized/i.test(line)) lastErr = line.trim();
        }
      });

      proc.on('error', (e) => {
        clearTimeout(timer);
        reject(new Error(`ffmpeg эхлүүлж чадсангүй: ${e.message}`));
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) return resolve();
        reject(new Error(`ffmpeg exited with code ${code}${lastErr ? ` — ${lastErr}` : ''}`));
      });
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
