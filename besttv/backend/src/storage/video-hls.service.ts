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
 * ⚠️⚠️ ЭЦСИЙН хамгаалалт — ffmpeg төгсгөлгүй давталтад орсон ч зогсооно.
 *
 * ⚠️ 3 цаг байсныг 8 БОЛГОВ. Хуучин тооцоо нь ажил ДАНГААРАА явахаар
 * (~3.3x realtime) хийгдсэн байв. Гэтэл processor нь `concurrency: 4`
 * — CPU дөрөв хуваагдана. Үр дүнд 2 БОДИТ кино «180 минут хэтэрлээ»
 * гэж унасан ч ffmpeg гацаагүй, зүгээр удаан явж байсан.
 *
 * Жинхэнэ гацааг доорх `STALL_TIMEOUT_MS` (явц зогсох) барих тул
 * энэ нь зөвхөн онолын хамгаалалт — өндөр байх нь аюулгүй.
 */
const FFMPEG_TIMEOUT_MS = 8 * 60 * 60 * 1000;

/**
 * ⚠️⚠️ ЖИНХЭНЭ ГАЦААНЫ хэмжүүр — сүүлийн явцаас хойш хэдэн минут.
 *
 * Ажиллаж буй ffmpeg нь `time=…` мөрийг тасралтгүй гаргадаг (удаан
 * байсан ч). Гацвал тэр урсгал ЗОГСДОГ. 25 минут явцгүй байхыг
 * гацсан гэж үзнэ — хамгийн ачаалалтай үед ч (4 ажил + байршуулалт)
 * ffmpeg 25 минут дуугүй байдаггүй.
 */
const STALL_TIMEOUT_MS = 25 * 60 * 1000;

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
 *
 * `veryfast` нь `medium`-ээс ~4 дахин хурдан, файл ~10% том. VPS дээр
 * CPU л хязгаарлагч (4 цөм, хөрвүүлэлт үед 375% ачаалалтай) тул хурдыг
 * сонгосон.
 *
 * ⚠️ ENV-ЭЭР ТОХИРУУЛНА — 70+ видео нэг дор оруулах үед (`veryfast` дээр
 * нэг кино ~20-30 мин × 57 = 28 цаг) түр `superfast` болгож ~1.5-2 дахин
 * хурдасгаж болно. Чанар (CRF) өөрчлөгдөхгүй, зөвхөн файл ~15% томорно.
 * Ердийн үед `veryfast` (анхдагч) нь хамгийн зөв тэнцвэр.
 */
const X264_PRESET = process.env.X264_PRESET ?? 'veryfast';

export interface HlsResult {
  playlistKey: string; // R2 key: 'videos/{uuid}/video.m3u8' (videoKey-д хадгална — R2 KEY, URL БИШ!)
  posterKey: string; // R2 key: 'videos/{uuid}/poster.jpg'
  /** Seek preview — 'videos/{uuid}/thumbs.vtt' (sprite нь хажууд нь) */
  thumbnailsKey: string;
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
      const [durationSec, sourceHeight, hasAudio] = await Promise.all([
        this.probeDuration(inputPath),
        this.probeHeight(inputPath),
        this.probeHasAudio(inputPath),
      ]);

      // ── 2) ABR HLS (3 түвшин re-encode) — 15-70% ──
      await this.toHls(
        inputPath,
        playlistPath,
        durationSec,
        (pct) => report('convert', 15 + pct * 0.55),
        sourceHeight,
        hasAudio,
      );

      // ── 3) Poster (эхний frame) ──
      await this.makePoster(inputPath, posterPath).catch(() => null);

      /* ⚠️ Seek thumbnail (sprite+VTT) — амжилтгүй болвол хөрвүүлэлт
         УНАХГҮЙ (thumbnail бол нэмэлт тав тух, заавал биш) */
      await this.makeThumbnails(inputPath, tmpDir, durationSec).catch((e) => {
        this.logger.warn(`Thumbnail үүсгэж чадсангүй: ${String(e)}`);
      });
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
        else if (name.endsWith('.vtt')) contentType = 'text/vtt';

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
        thumbnailsKey: `${r2Prefix}/thumbs.vtt`,
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
   * Аудио урсгал БАЙГАА ЭСЭХ.
   *
   * ⚠️⚠️ ЧУХАЛ: `-var_stream_map "v:0,a:0 v:1,a:1"` нь аудиог ЗААВАЛ шаарддаг.
   * Дуугүй видеонд `-map a:0?` (заавал биш) нь аудио урсгал ҮҮСГЭХГҮЙ тул
   * map дахь `a:0` заалт хоосон зүйл рүү заана →
   *   `Error opening output file v:1,a:1: Invalid argument` (exit 234)
   * гээд хөрвүүлэлт УНАНА. 5 кино яг ийм шалтгаанаар унасан.
   *
   * Тиймээс аудио байхгүй бол `var_stream_map`-аас `,a:N`-ыг ХАСНА.
   * ⚠️ Уншиж чадаагүй бол "аудиотой" гэж үзнэ — ихэнх видео дуутай бөгөөд
   * `-map a:0?` нь байхгүй үед ч алдаа өгөхгүй (зөвхөн map л асуудалтай).
   */
  private probeHasAudio(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) return resolve(true);
        resolve(Boolean(data?.streams?.some((s) => s.codec_type === 'audio')));
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
    hasAudio = true,
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

    /**
     * ⚠️⚠️ THREAD ХЯЗГААР — олон ажил ЗЭРЭГ хөрвүүлэхэд ЗААВАЛ.
     *
     * ffmpeg нь анхдагчаар БҮХ цөмийг эзэлдэг. Worker-ийн concurrency
     * 4 болгоход 4 × (бүх цөм) = 16+ thread нь 4 цөм дээр өрсөлдөж,
     * context switch-д цаг үрэгдэн БҮГД удаашрана. Мөн вэб сервер
     * CPU авч чадахгүй болж сайт гацна.
     *
     * `HLS_THREADS` — ажил тус бүрийн дээд thread. Тохируулаагүй бол 1
     * (concurrency өндөр үед аюулгүй анхдагч). Ганцаар ажиллуулах бол
     * .env-д 4 гэж тавьж болно.
     */
    const threads = process.env.HLS_THREADS ?? '1';
    const opts: string[] = ['-threads', threads, '-filter_complex', filter];

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

    /**
     * Аудио — түвшин бүрт нэг урсгал.
     * ⚠️ ДУУГҮЙ видеонд ОГТ нэмэхгүй — `-map a:0?` нь урсгал үүсгэхгүй ч
     * `var_stream_map` дахь `a:N` нь хоосон рүү зааж ffmpeg-ийг унагадаг.
     */
    if (hasAudio) {
      ladder.forEach((l, i) => {
        opts.push('-map', 'a:0?', `-c:a:${i}`, 'aac', `-b:a:${i}`, l.audio, `-ac:a:${i}`, '2');
      });
    }

    opts.push(
      // ⚠️ Утга нь ЗАЙТАЙ мөр — spawn-д тусдаа аргумент болж яг хэвээр очно
      // ⚠️ Дуугүй бол `,a:N` ХАСАГДАНА (эс бөгөөс exit 234 "Invalid argument")
      '-var_stream_map',
      ladder.map((_, i) => (hasAudio ? `v:${i},a:${i}` : `v:${i}`)).join(' '),
      '-master_pl_name', 'master.m3u8',
      '-hls_time', '6',
      '-hls_list_size', '0',
      '-hls_flags', 'independent_segments',
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', path.join(dir, 'v%v_seg_%03d.ts'),
      '-f', 'hls',
    );

    this.logger.log(
      `ABR: эх ${sourceHeight}p → ${ladder.map((l) => l.name).join(', ')} ` +
        `(${ladder.length} түвшин, аудио: ${hasAudio ? 'тийм' : 'ҮГҮЙ'})`,
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

      /**
       * ⚠️⚠️ ЯВЦ ЗОГССОНЫГ хэмжинэ — нийт хугацааг БИШ.
       *
       * БОДИТ АЛДАА: 2 кино «180 минут хэтэрлээ» гэж унасан. Гэтэл
       * ffmpeg ГАЦААГҮЙ — 4 ажил зэрэг явж CPU-г хуваасан тул удаан
       * байсан. 99%-д хүрсэн ажил ч тогтмол хугацааны таймераар
       * алагдана — тэр 3 цагийн CPU ажил бүрэн дэмий үрэгдэнэ.
       *
       * Гацсан ffmpeg нь `time=` мөр гаргахаа БОЛЬДОГ. Тиймээс
       * "сүүлийн явцаас хойш хэр удлаа" гэдгээр шүүх нь ЖИНХЭНЭ
       * гацааг илрүүлж, зүгээр л удаан ажлыг алдаггүй.
       *
       * ⚠️ Нийт хугацааны хязгаар БАС үлдэнэ (`FFMPEG_TIMEOUT_MS`) —
       * ffmpeg төгсгөлгүй давталтад орж `time=` гаргасаар байвал
       * эцсийн хамгаалалт хэрэгтэй. Гэхдээ 3→8 цаг болгов: явцын
       * хяналт нь жинхэнэ гацааг хамаагүй хурдан барина.
       */
      let lastProgressAt = Date.now();
      let killed = false;

      const kill = (reason: string) => {
        if (killed) return;
        killed = true;
        proc.kill('SIGKILL');
        reject(new Error(reason));
      };

      const stallTimer = setInterval(() => {
        const idleMin = (Date.now() - lastProgressAt) / 60000;
        if (idleMin >= STALL_TIMEOUT_MS / 60000) {
          kill(`ffmpeg ${Math.round(idleMin)} минут явцгүй зогслоо (гацсан)`);
        }
      }, 60_000);

      const hardTimer = setTimeout(() => {
        kill(`ffmpeg нийт ${FFMPEG_TIMEOUT_MS / 3600000} цаг хэтэрлээ`);
      }, FFMPEG_TIMEOUT_MS);

      const cleanup = () => {
        clearInterval(stallTimer);
        clearTimeout(hardTimer);
      };

      let lastErr = '';
      proc.stderr.on('data', (buf: Buffer) => {
        const text = buf.toString();
        for (const line of text.split('\n')) {
          // Явц — `time=00:01:23.45` хэлбэрээс тооцоолно
          const m = line.match(/time=(\d+):(\d+):(\d+)/);
          if (m && durationSec > 0) {
            /* ⚠️ Явц ГАРСАН — гацаагүй гэсэн үг (хэдий удаан ч) */
            lastProgressAt = Date.now();
            const sec = +m[1] * 3600 + +m[2] * 60 + +m[3];
            onPercent?.(Math.min(100, (sec / durationSec) * 100));
          }
          if (/error|invalid|failed|unrecognized/i.test(line)) lastErr = line.trim();
        }
      });

      proc.on('error', (e) => {
        cleanup();
        if (!killed) reject(new Error(`ffmpeg эхлүүлж чадсангүй: ${e.message}`));
      });

      proc.on('close', (code) => {
        cleanup();
        /* ⚠️ Таймераар аллаа бол `reject` аль хэдийн дуудагдсан —
           давхар дуудвал Promise-ийн хоёр дахь шийдэл үл тоогдоно
           ч ойлгомжгүй лог үлдэнэ */
        if (killed) return;
        if (code === 0) return resolve();
        reject(new Error(`ffmpeg exited with code ${code}${lastErr ? ` — ${lastErr}` : ''}`));
      });
    });
  }

  /**
   * Видеоны кадраас постер гаргана.
   *
   * ⚠️⚠️ 1 СЕКУНД БАЙСНЫГ 10%-Д БОЛГОВ.
   *
   * БОДИТ АЛДАА: `timestamps: ['1']` нь эхний СЕКУНДЭЭС кадр авдаг —
   * тэнд бараг үргэлж ХАР ДЭЛГЭЦ, студийн лого, эсвэл кредит байдаг.
   * Agent Kim цувралын 10 ангийн thumbnail БҮГД хар хайрцаг байв
   * (3.5 KB — бараг хоосон JPEG).
   *
   * ⚠️ `10%` нь хувиар — ffmpeg дэмждэг. Богино клипт ч (2 мин → 12с),
   * урт кинод ч (2 цаг → 12 мин) утга учиртай кадр өгнө. Тогтмол
   * секунд (ж: 30) бол 20 секундын трейлерт хүрэхгүй.
   *
   * ⚠️ Хэрэв 10% дээр ч хоосон бол `posterIfMissing` нь админы
   * гараар оруулсан постерыг ХЭЗЭЭ Ч дарж бичихгүй (тусдаа хамгаалалт).
   */
  private makePoster(inputPath: string, posterPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: ['10%'],
          filename: path.basename(posterPath),
          folder: path.dirname(posterPath),
          size: '640x?',
        })
        .on('end', () => resolve())
        .on('error', (e) => reject(e));
    });
  }

  /**
   * ХУУЧИН видеонд thumbnail НӨХӨХ (backfill).
   *
   * ⚠️ Raw файл нь HLS бэлэн болмогц УСТДАГ тул эх сурвалж болгож
   * ашиглаж болохгүй. Оронд нь R2 дээрх HLS-ээс уншина: ffmpeg нь
   * presigned m3u8 URL-ыг шууд задалж чаддаг (segment-үүд нь дотроо
   * presign хийгдсэн байх ёстой тул `rewritePlaylist`-ийн үр дүнг
   * ТҮР ФАЙЛ болгож өгнө).
   *
   * @param playlistText segment бүр нь presigned URL болсон m3u8 агуулга
   * @param prefix       R2 зам ('movies/{uuid}/')
   */
  async backfillThumbnails(
    playlistText: string,
    prefix: string,
    durationSec: number,
  ): Promise<void> {
    const tmpDir = path.join(os.tmpdir(), `thumb_${randomUUID()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    try {
      const listPath = path.join(tmpDir, 'in.m3u8');
      await fs.writeFile(listPath, playlistText, 'utf8');

      await this.makeThumbnails(listPath, tmpDir, durationSec);

      for (const name of ['thumbs.jpg', 'thumbs.vtt']) {
        const buf = await fs.readFile(path.join(tmpDir, name));
        await this.storage.upload(
          `${prefix}${name}`,
          buf,
          name.endsWith('.vtt') ? 'text/vtt' : 'image/jpeg',
        );
      }
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => null);
    }
  }

  /**
   * ХУУЧИН видеонд ПОСТЕР дахин үүсгэх (backfill).
   *
   * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: постерыг өмнө нь 1 ДАХЬ СЕКУНДЭЭС авдаг
   * байсан тул бараг үргэлж ХАР ДЭЛГЭЦ/лого гардаг байв (Agent Kim
   * цувралын 10 ангийн thumbnail бүгд хар хайрцаг — 3.5 KB JPEG).
   * Одоо 10%-д авдаг болсон ч ӨМНӨ НЬ хөрвүүлсэн видео хэвээр.
   *
   * ⚠️ Raw файл устсан тул R2 дээрх HLS-ээс уншина (`backfillThumbnails`
   * -тай ИЖИЛ загвар).
   *
   * @param playlistText segment бүр presigned URL болсон m3u8
   * @param prefix       R2 зам ('episodes/{uuid}/')
   */
  async backfillPoster(playlistText: string, prefix: string): Promise<string> {
    const tmpDir = path.join(os.tmpdir(), `poster_${randomUUID()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    try {
      const listPath = path.join(tmpDir, 'in.m3u8');
      await fs.writeFile(listPath, playlistText, 'utf8');

      const posterPath = path.join(tmpDir, 'poster.jpg');

      /**
       * ⚠️⚠️ `makePoster` (fluent-ffmpeg `.screenshots()`) АШИГЛАХГҮЙ —
       * тэр нь дотроо ffprobe дууддаг ба HLS playlist дээр УНАДАГ
       * (бодитоор: «ffprobe exited with code 1», 43 видеод).
       *
       * Оронд нь `spawn`-оор шууд ffmpeg — `makeThumbnails`-тай ижил:
       *   `-protocol_whitelist` ЗААВАЛ (m3u8 доторх https segment-ийг
       *   ffmpeg анхдагчаар «аюулгүй биш» гэж татахаас татгалздаг)
       *   `-ss 60` — 60 дахь секундээс (эхний кадр хар байдаг)
       */
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(FFMPEG_BIN, [
          '-y',
          '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
          '-ss', '60',
          '-i', listPath,
          '-frames:v', '1',
          '-vf', 'scale=640:-2',
          '-q:v', '3',
          posterPath,
        ], { stdio: ['ignore', 'ignore', 'pipe'] });

        let err = '';
        proc.stderr.on('data', (b: Buffer) => { err = b.toString().slice(-300); });
        proc.on('error', (e) => reject(e));
        proc.on('close', (code) =>
          code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${err.slice(0, 120)}`)),
        );
      });

      const buf = await fs.readFile(posterPath);
      /* ⚠️ 5 KB-ээс бага бол бараг хоосон кадр — дарж бичихгүй
         (одоо байгаагаас дор болгохгүй) */
      if (buf.length < 5120) {
        throw new Error(`Постер хэт жижиг (${buf.length} байт) — хар кадр байж магадгүй`);
      }

      /**
       * ⚠️⚠️ ШИНЭ НЭРЭЭР бичнэ — CDN кэшийг тойрно.
       *
       * БОДИТ АСУУДАЛ: `poster.jpg`-ыг дарж бичсэн ч
       * `assets.besttv.us` нь `cache-control: max-age=604800`
       * (7 хоног) тул ХУУЧИН 3 KB хар зургийг өгсөөр байв
       * (`cf-cache-status: HIT`). R2-д шинэ 19 KB зураг байхад.
       *
       * Шинэ нэр (`poster-<timestamp>.jpg`) нь CDN-д огт байхгүй тул
       * ШУУД шинэ зураг татагдана. Дуудагч тал DB-ийн `posterKey`-г
       * шинэчилнэ.
       *
       * ⚠️ Хуучин файлыг УСТГАХГҮЙ — DB шинэчлэгдэх хооронд хэн нэг
       * нь уншиж байж болно (orphan cleanup дараа нь цэвэрлэнэ).
       */
      const name = `poster-${Date.now()}.jpg`;
      await this.storage.upload(`${prefix}${name}`, buf, 'image/jpeg');
      return `${prefix}${name}`;
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => null);
    }
  }

  /**
   * SEEK THUMBNAIL — sprite зураг + WebVTT.
   *
   * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: өмнөх player нь НУУГДМАЛ 2 дахь `<video>`
   * элемент үүсгээд түүнийг seek хийж preview гаргадаг байв. Тэр арга нь
   * ГАР УТСАНД ОГТ АЖИЛЛАДАГГҮЙ (iOS/Android нь нэг дор 2 видео decode
   * хийхийг хориглодог) тул код дотроо зориуд унтраасан байсан —
   * "утсан дээр thumbnail харагдахгүй" гэсэн гомдлын шалтгаан.
   *
   * Зөв шийдэл (YouTube/Netflix-ийн арга): хөрвүүлэлтийн үед НЭГ УДАА
   * sprite зураг бэлдэж, VTT-гээр хугацаа↔байрлалыг заана. Player зөвхөн
   * ЗУРАГ татдаг тул бүх төхөөрөмжид, сүлжээ багатай ч ажиллана.
   *
   * Формат: 10 секунд тутам 1 кадр, 160px өргөн, 5 багана × N мөр.
   */
  private async makeThumbnails(
    inputPath: string,
    dir: string,
    durationSec: number,
  ): Promise<void> {
    const INTERVAL = 10; // секунд
    const COLS = 5;
    const W = 160;
    const H = 90; // 16:9

    const count = Math.max(1, Math.min(600, Math.floor(durationSec / INTERVAL)));
    const rows = Math.ceil(count / COLS);

    // ── 1) Sprite (нэг том зураг) ──
    await new Promise<void>((resolve, reject) => {
      spawn(FFMPEG_BIN, [
        '-y',
        /**
         * ⚠️ HLS-ээс уншихад ЗААВАЛ — m3u8 доторх segment нь https URL тул
         * ffmpeg анхдагчаар "аюулгүй биш" гэж үзэж татахаас ТАТГАЛЗДАГ
         * (backfill энд гацна). Локал файлд нөлөөлөхгүй.
         */
        '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
        '-i', inputPath,
        '-vf', `fps=1/${INTERVAL},scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:-1:-1:color=black,tile=${COLS}x${rows}`,
        '-frames:v', '1',
        '-q:v', '5',
        path.join(dir, 'thumbs.jpg'),
      ], { stdio: ['ignore', 'ignore', 'ignore'] })
        .on('close', (code) => (code === 0 ? resolve() : reject(new Error(`sprite exit ${code}`))))
        .on('error', reject);
    });

    // ── 2) WebVTT — хугацаа бүрийг sprite доторх тэгш өнцөгттэй холбоно ──
    const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
    const stamp = (s: number) =>
      `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}.000`;

    let vtt = 'WEBVTT\n\n';
    for (let i = 0; i < count; i++) {
      const x = (i % COLS) * W;
      const y = Math.floor(i / COLS) * H;
      vtt += `${stamp(i * INTERVAL)} --> ${stamp((i + 1) * INTERVAL)}\n`;
      /* ⚠️ Зам нь ХАРЬЦАНГУЙ — player нь VTT-ийн байрлалаас тооцно */
      vtt += `thumbs.jpg#xywh=${x},${y},${W},${H}\n\n`;
    }
    await fs.writeFile(path.join(dir, 'thumbs.vtt'), vtt, 'utf8');
  }
}
