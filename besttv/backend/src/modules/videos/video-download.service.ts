import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';

/**
 * АДМИН — БАЙРШУУЛСАН ВИДЕОГ ТАТАЖ АВАХ.
 *
 * ⚠️⚠️ ЯАГААД REMUX (дахин хөрвүүлэхГҮЙ):
 * Видео нь R2 дээр HLS (.m3u8 + .ts сегмент) хэлбэрээр хадгалагдана.
 * `.ts`-ийг MP4 болгоход `ffmpeg -c copy` хангалттай — кодлолт нь
 * АЛЬ ХЭДИЙН H.264/AAC тул зөвхөн САВЛАГААГ солино.
 *   • Чанар 100% хэвээр (дахин кодлолтгүй)
 *   • CPU бараг ашиглахгүй — хурд нь R2-гийн татах хурдаар л хязгаарлагдана
 *   • ~1 цагийн кино 2-5 минутад бэлтгэгдэнэ
 *
 * ⚠️ Дискэнд ХАДГАЛАХГҮЙ — ffmpeg-ийн гаралтыг ШУУД хариу руу дамжуулна
 * (stream). Тиймээс 10 админ зэрэг татсан ч диск дүүрэхгүй.
 */

/** Нягтралын нэрийг өндрөөс нь гаргана */
const heightName = (h: number): string =>
  h >= 2000 ? '4K' : h >= 1400 ? '1440p' : h >= 1000 ? '1080p' : h >= 700 ? '720p' : h >= 400 ? '480p' : `${h}p`;

export interface VideoVariant {
  /** master.m3u8 доторх индекс — татахад ашиглана */
  index: number;
  /** Хэрэглэгчид харагдах нэр: «1080p» */
  label: string;
  width: number;
  height: number;
  /** Ойролцоо хэмжээ (МБ) — bandwidth × үргэлжлэх хугацаа */
  approxMb: number | null;
}

@Injectable()
export class VideoDownloadService {
  private readonly logger = new Logger(VideoDownloadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * ⚠️⚠️ НЭГ УДААГИЙН ТАСАЛБАР — токеныг URL-д ТАВИХГҮЙ.
   *
   * Татах нь хөтчийн энгийн GET навигаци тул `Authorization` header
   * тавих боломжгүй. Гэвч JWT-г query-д тавих нь АЮУЛТАЙ: сервер
   * лог, proxy лог, хөтчийн түүхэнд ҮЛДЭНЭ.
   *
   * Тиймээс админ эхлээд header-тэйгээр тасалбар авна (POST), дараа
   * нь тэр богино хугацаат санамсаргүй мөрөөр татна.
   *
   * ⚠️ 2 минут — татаж эхлэхэд хангалттай, хулгайлагдвал хэрэглэх
   *    цонх маш богино.
   * ⚠️ НЭГ УДАА — ашиглагдмагц устана.
   */
  private readonly tickets = new Map<string, { kind: string; id: string; v: number; at: number }>();
  private static readonly TICKET_TTL_MS = 2 * 60_000;

  issueTicket(kind: 'movie' | 'episode', id: string, v: number): string {
    /* Хугацаа хэтэрсэн тасалбаруудыг цэвэрлэнэ — Map хязгааргүй өсөхгүй */
    const now = Date.now();
    for (const [k, t] of this.tickets) {
      if (now - t.at > VideoDownloadService.TICKET_TTL_MS) this.tickets.delete(k);
    }
    const token = randomUUID().replace(/-/g, '');
    this.tickets.set(token, { kind, id, v, at: now });
    return token;
  }

  /** Тасалбарыг шалгаад ЗААВАЛ устгана (нэг удаагийн) */
  redeemTicket(token: string): { kind: 'movie' | 'episode'; id: string; v: number } | null {
    const t = this.tickets.get(token);
    if (!t) return null;
    this.tickets.delete(token);
    if (Date.now() - t.at > VideoDownloadService.TICKET_TTL_MS) return null;
    return { kind: t.kind as 'movie' | 'episode', id: t.id, v: t.v };
  }

  /** Кино эсвэл ангийн видео мэдээллийг олно */
  private async target(kind: 'movie' | 'episode', id: string) {
    if (kind === 'movie') {
      const t = await this.prisma.title.findUnique({
        where: { id },
        select: { id: true, title: true, videoKey: true, durationSec: true },
      });
      if (!t?.videoKey) throw new NotFoundException('Видео олдсонгүй');
      return { name: t.title, videoKey: t.videoKey, durationSec: t.durationSec ?? 0 };
    }
    const e = await this.prisma.episode.findUnique({
      where: { id },
      select: {
        id: true, number: true, name: true, videoKey: true, durationSec: true,
        season: { select: { number: true, title: { select: { title: true } } } },
      },
    });
    if (!e?.videoKey) throw new NotFoundException('Видео олдсонгүй');
    const base = `${e.season.title.title} S${String(e.season.number).padStart(2, '0')}E${String(e.number).padStart(2, '0')}`;
    return {
      name: e.name ? `${base} - ${e.name}` : base,
      videoKey: e.videoKey,
      durationSec: e.durationSec ?? 0,
    };
  }

  /**
   * Боломжит нягтралуудыг `master.m3u8`-аас уншина.
   *
   * ⚠️ Хуучин нэг түвшинтэй видео (`video.m3u8`) нь master БИШ —
   * тэр тохиолдолд ганц хувилбар буцаана.
   */
  async variants(kind: 'movie' | 'episode', id: string) {
    const t = await this.target(kind, id);
    const prefix = t.videoKey.replace(/\/[^/]+$/, '/');

    let text = '';
    try {
      text = await this.storage.downloadText(t.videoKey);
    } catch {
      throw new NotFoundException('Playlist уншиж чадсангүй');
    }

    const out: VideoVariant[] = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/#EXT-X-STREAM-INF:.*RESOLUTION=(\d+)x(\d+)/i);
      if (!m) continue;
      const uri = (lines[i + 1] ?? '').trim();
      if (!uri || uri.startsWith('#')) continue;

      const bw = Number(lines[i].match(/AVERAGE-BANDWIDTH=(\d+)/i)?.[1]
        ?? lines[i].match(/BANDWIDTH=(\d+)/i)?.[1] ?? 0);
      const height = Number(m[2]);

      out.push({
        index: out.length,
        label: heightName(height),
        width: Number(m[1]),
        height,
        /* bandwidth (bit/сек) × хугацаа → МБ */
        approxMb: bw && t.durationSec ? Math.round((bw * t.durationSec) / 8 / 1048576) : null,
      });
    }

    /* ⚠️ master биш — ганц түвшинтэй хуучин видео */
    if (!out.length) {
      out.push({ index: 0, label: 'Эх чанар', width: 0, height: 0, approxMb: null });
    }

    /* Өндрөөс нь буурахаар — админ хамгийн сайныг эхэнд харна */
    out.sort((a, b) => b.height - a.height);
    return { name: t.name, prefix, variants: out };
  }

  /**
   * Сонгосон түвшнийг MP4 болгож ШУУД хариу руу дамжуулна.
   *
   * ⚠️⚠️ ffmpeg-д presigned URL өгнө — сегмент бүрийг өөрөө татна.
   * Бид дунд нь орж буферлэхгүй тул санах ой тогтмол бага.
   */
  async streamMp4(
    kind: 'movie' | 'episode',
    id: string,
    variantIndex: number,
    res: Response,
  ): Promise<void> {
    const info = await this.variants(kind, id);
    const v = info.variants.find((x) => x.index === variantIndex) ?? info.variants[0];

    const t = await this.target(kind, id);
    const prefix = t.videoKey.replace(/\/[^/]+$/, '/');

    /**
     * ⚠️ Тухайн түвшний playlist — `v{n}.m3u8`. Master доторх
     * дараалал нь индекстэй тааруулагдсан (variants() бүтээхдээ
     * файлын нэрийг хадгалдаггүй тул дахин уншина).
     */
    const master = await this.storage.downloadText(t.videoKey);
    const uris: string[] = [];
    const lines = master.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!/#EXT-X-STREAM-INF:/i.test(lines[i])) continue;
      const uri = (lines[i + 1] ?? '').trim();
      if (uri && !uri.startsWith('#')) uris.push(uri);
    }
    /* Эрэмбэлсний дараа индекс өөрчлөгдсөн тул өндрөөр нь дахин олно */
    const orderedByHeight = [...info.variants].map((x) => x.index);
    const pick = uris.length ? uris[orderedByHeight.indexOf(v.index)] ?? uris[0] : null;

    const playlistKey = pick ? prefix + pick : t.videoKey;

    /**
     * WARN Segments are RELATIVE names (v0_seg_000.ts) in the playlist,
     * so ffmpeg would hit R2 unsigned and get 403. We must presign EVERY
     * segment and hand ffmpeg a rewritten playlist on local disk.
     *
     * WARN Long TTL (6h) because a big episode can take many minutes and
     * the last segments are fetched at the very end.
     */
    const raw = await this.storage.downloadText(playlistKey);
    const rewritten = (
      await Promise.all(
        raw.split('\n').map(async (line) => {
          const t2 = line.trim();
          if (!t2 || t2.startsWith('#')) return line;
          return this.storage.presignGet(prefix + t2, 6 * 3600);
        }),
      )
    ).join('\n');

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'btv-dl-'));
    const listPath = path.join(tmpDir, 'index.m3u8');
    await fs.writeFile(listPath, rewritten, 'utf8');

    const safeName = info.name.replace(/[^\p{L}\p{N} .\-_]/gu, '').trim() || 'video';
    const fileName = `${safeName} (${v.label}).mp4`;

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    /* ⚠️ Урт татах үед proxy таслахаас сэргийлнэ */
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Accel-Buffering', 'no');

    /**
     * ⚠️⚠️ `-c copy` — ДАХИН КОДЛОХГҮЙ. Зөвхөн савлагаа солино.
     * `-movflags frag_keyframe+empty_moov` — урсгалаар илгээхэд
     * заавал (эс бөгөөс ffmpeg төгсгөлд `moov` бичих гэж seek
     * хийхийг оролдоод pipe дээр УНАНА).
     */
    const ff = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
      '-i', listPath,
      '-c', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4',
      'pipe:1',
    ]);

    ff.stdout.pipe(res);

    let errTail = '';
    ff.stderr.on('data', (d) => {
      errTail = (errTail + d.toString()).slice(-500);
    });

    ff.on('error', (e) => {
      this.logger.error(`ffmpeg эхлүүлж чадсангүй: ${String(e)}`);
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });

    /* WARN Always clean the temp playlist dir, success or not */
    const cleanup = () => {
      void fs.rm(tmpDir, { recursive: true, force: true }).catch(() => null);
    };

    ff.on('close', (code) => {
      if (code !== 0) {
        this.logger.error(`Татах амжилтгүй (${kind}/${id}, код ${code}): ${errTail}`);
      }
      cleanup();
      res.end();
    });

    /* ⚠️ Админ таславал ffmpeg-ийг ЗААВАЛ зогсооно — эс бөгөөс
       процесс үлдэж, R2-гоос дэмий татсаар байна */
    res.on('close', () => {
      if (!ff.killed) ff.kill('SIGKILL');
      cleanup();
    });
  }
}
