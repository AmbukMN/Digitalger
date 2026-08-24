import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { randomUUID } from 'crypto';
import { N8nService } from '../n8n/n8n.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { VideoHlsService, type HlsProgress } from '../../storage/video-hls.service';
import { VIDEO_QUEUE, VideoHlsJob } from './video-queue.types';

/** Явцыг DB-д хэт олон удаа бичихгүй — 2 секундэд нэг */
const PROGRESS_THROTTLE_MS = 2000;

/**
 * ⚠️ Worker container — VIDEO_QUEUE-ийн CONSUMER.
 * R2 raw видео → диск (stream, OOM-гүй) → ffmpeg HLS (-c copy, чанар 100%)
 * → R2. Дараа нь entity-д videoKey (R2 KEY — URL БИШ, private bucket!).
 *
 * ⚠️ Энэ файлыг өөрчилбөл worker-ийг ЗААВАЛ rebuild/restart!
 */
@Processor(VIDEO_QUEUE)
export class VideoProcessor {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly hls: VideoHlsService,
    /* ⚠️ Хөрвүүлэлт унасныг Telegram-аар мэдэгдэхэд (@Global) */
    private readonly n8n: N8nService,
  ) {}

  /**
   * ⚠️⚠️ CONCURRENCY 4 — 49 драм бөөнөөр хөрвүүлэхэд хурдасгав.
   *
   * ⚠️ ЗААВАЛ `HLS_THREADS`-ТАЙ ХАМТ: ffmpeg анхдагчаар БҮХ цөмийг
   * эзэлдэг тул 4 зэрэг ажил × 4 цөм = 16 thread нь VPS-ийн 4 цөм дээр
   * өрсөлдөж, context switch-д цаг үрэгдэн БҮГД удаашрана. Мөн вэб
   * сервер CPU авч чадахгүй болж САЙТ ГАЦНА.
   * Тохиргоо: `HLS_THREADS=3` (worker .env-д) → 4×3=12 нь 4 цөмд
   * зохимжтой дарамт, systemd/nginx-д ч зай үлдэнэ.
   *
   * ⚠️ ДИСК: ажил бүр raw файл (4-7 GB) + HLS гаралт (~4 GB) татдаг.
   * 4 зэрэг ≈ 40 GB түр зай. VPS-д 33 GB сул тул ЭРСДЭЛТЭЙ — гэхдээ
   * ажлууд өөр өөр цагт дуусдаг тул бодит оргил нь бага. Хэрэв
   * "no space left" гарвал энийг 2 болгоно.
   *
   * ⚠️ Энэ файлыг өөрчилбөл worker-ийг ЗААВАЛ rebuild!
   */
  /**
   * ⚠️⚠️ CONCURRENCY 2 (өмнө нь 4 байсан).
   *
   * VPS нь 4 ЦӨМТЭЙ. Зэрэг 4 хөрвүүлэлт явахад ffmpeg-үүд 4 цөмийг
   * БҮРЭН эзэлж (ps: 97%×2 + 56% + 48%), load average 21-25 хүрч,
   * backend/postgres CPU авч чадахгүй болно → админ хяналтын самбарын
   * график МӨНХ skeleton дээр гацаж, сайт бүхэлдээ удааширна
   * (бодит гомдол 2026-08-24, дэлгэцэн дээр «Процессор 100%»).
   *
   * 2 бол хөрвүүлэлт үргэлжилсээр байх ба 2 цөм вэб/DB-д үлдэнэ.
   * `HLS_CONCURRENCY` env-ээр тохируулж болно (сул зуур түр өсгөх г.м).
   */
  @Process({ name: 'convert', concurrency: Number(process.env.HLS_CONCURRENCY ?? 2) })
  async handle(job: Job<VideoHlsJob>) {
    const { target, targetId, rawKey } = job.data;

    /**
     * ⚠️⚠️ АЛЬ ХЭДИЙН БЭЛЭН БОЛСОН БОЛ АЛГАСНА.
     *
     * Бодит алдаа: recovery cron давхардсан ажил үүсгэсний улмаас нэг кино
     * 2-3 удаа дараалалд орсон. Эхнийх нь амжилттай хөрвүүлээд raw файлыг
     * УСТГАНА → дараагийнх нь ажиллаад "The specified key does not exist"
     * гээд унаж, БЭЛЭН БОЛСОН киног FAILED болгож дарж бичсэн (4 кино).
     * Хэрэглэгчид үзэх боломжтой атал "амжилтгүй" харагдана.
     */
    if (target !== 'trailer' && (await this.alreadyReady(target, targetId))) {
      this.logger.log(`Аль хэдийн бэлэн — алгаслаа: ${target}/${targetId}`);
      return;
    }

    /**
     * ⚠️⚠️ ДИСКНИЙ ЗАЙ ШАЛГАНА — concurrency 4 үед ЗААВАЛ.
     *
     * Ажил бүр raw файл (4-7 GB) татаж, HLS гаралт (~4 GB) үүсгэдэг.
     * 4 зэрэг ажиллахад ~40 GB түр зай хэрэгтэй. Зай дуусвал ffmpeg
     * дунд замдаа унаж, кино FAILED болно — дараа нь 5 GB дахин татаж
     * дахин оролдоно (урсгал, цаг дэмий).
     *
     * Зай багатай бол ажлыг ХОЙШЛУУЛНА (throw → BullMQ retry). Өмнөх
     * ажил дуусаад зай чөлөөлөгдмөгц үргэлжилнэ.
     */
    const freeGb = await this.freeDiskGb();
    if (freeGb !== null && freeGb < 12) {
      this.logger.warn(
        `Дискний зай багадлаа (${freeGb.toFixed(1)} GB) — ажлыг хойшлууллаа: ${target}/${targetId}`,
      );
      throw new Error(`Дискний зай хүрэлцэхгүй (${freeGb.toFixed(1)} GB)`);
    }

    this.logger.log(`HLS хөрвүүлэлт эхэллээ: ${target}/${targetId} (${rawKey})`);

    // ⚠️ Эхлэх мөчийг тэмдэглэнэ — гацсан ажлыг илрүүлэхэд ХЭРЭГТЭЙ
    await this.setState(target, targetId, {
      streamStatus: 'PROCESSING',
      streamProgress: 0,
      streamStartedAt: new Date(),
      streamError: null,
    });

    let lastWrite = 0;

    try {
      const folder =
        target === 'trailer' ? 'trailers' : target === 'episode' ? 'episodes' : 'movies';

      /**
       * ⚠️⚠️ ХУУЧИН ВИДЕОНЫ ЗАМЫГ ОДОО ТЭМДЭГЛЭНЭ (устгахын өмнө).
       *
       * БОДИТ АЛДАА: кино дахин байршуулахад `videoKey` нь ШИНЭ утгаар
       * ДАРАГДАЖ, хуучин HLS хавтас R2-д ҮҮРД үлддэг байв. DB-д ямар ч
       * лавлагаа үлдэхгүй тул гараар ч олох боломжгүй.
       *
       * Production дээр хэмжив: 5 орхигдсон хавтас, 4.27 GB. Одоохондоо
       * $0.06/сар боловч watermark-тай/watermark-гүй туршиж эхлэхэд
       * ХУРДАН өснө (кино бүр 1-2 GB).
       *
       * ⚠️ Устгалыг ШИНЭ видео БЭЛЭН БОЛСНЫ ДАРАА л хийнэ — хөрвүүлэлт
       * унавал хуучин видео ҮЛДЭХ ёстой (эс бөгөөс хэрэглэгч юу ч
       * үзэхгүй болно).
       */
      const oldKey = await this.currentVideoKey(target, targetId);

      /* ⚠️ Админы чагтыг DB-ээс уншина — трейлерт watermark ХЭРЭГГҮЙ
         (трейлер нь сурталчилгаа, лого нь илүүдэл) */
      const watermark =
        target === 'trailer' ? false : await this.wantsWatermark(target, targetId);

      const result = await this.hls.convertKeyAndUpload(rawKey, folder, (p: HlsProgress) => {
        // Bull-ийн явц (админ queue хардаг бол)
        void job.progress(p.percent).catch(() => null);

        // ⚠️ DB бичилтийг throttle — segment бүрд бичвэл DB дүүрнэ
        const now = Date.now();
        if (now - lastWrite < PROGRESS_THROTTLE_MS) return;
        lastWrite = now;
        void this.setState(target, targetId, { streamProgress: p.percent }).catch(() => null);
      }, watermark);

      // ⚠️ videoKey = R2 KEY (URL биш) — stream gate presign хийж өгнө
      if (target === 'trailer') {
        await this.prisma.title.update({
          where: { id: targetId },
          data: { trailerKey: result.playlistKey },
        });
      } else {
        /**
         * ⚠️ ПОСТЕР АВТОМАТААР НӨХНӨ — `convertKeyAndUpload` нь видеоны
         * дунд хэсгээс `poster.jpg` гаргаад R2-д АЛЬ ХЭДИЙН тавьдаг байсан
         * ч DB-д хэзээ ч бичигддэггүй, дэмий үрэгддэг байв.
         *
         * Зөвхөн постергүй үед л бичнэ — админ гараар оруулсан жинхэнэ
         * постерыг ХЭЗЭЭ Ч дарж бичихгүй (кадр нь чанараар дутуу).
         */
        const posterFallback = await this.posterIfMissing(target, targetId, result.posterKey);

        await this.setState(target, targetId, {
          videoKey: result.playlistKey,
          durationSec: result.durationSec,
          streamStatus: 'READY',
          streamProgress: 100,
          streamError: null,
          videoRawKey: null,
          ...posterFallback,
        });
      }

      // Raw түр файл устгах (HLS бэлэн)
      await this.storage.delete(rawKey).catch(() => null);

      /**
       * ⚠️⚠️ ХУУЧИН HLS ХАВТСЫГ УСТГАНА — R2 зай дэмий эзлэхээс сэргийлнэ.
       *
       * ЗӨВХӨН энд (шинэ видео БЭЛЭН болсны дараа) — эс бөгөөс хөрвүүлэлт
       * унавал хэрэглэгч юу ч үзэхгүй болно.
       *
       * ⚠️ Шинэ зам ХУУЧИНТАЙ ижил байвал устгахгүй (uuid давхцсан гэсэн
       * онолын тохиолдол) — шинэ видеогоо устгачих эрсдэлтэй.
       */
      if (oldKey && oldKey !== result.playlistKey) {
        const oldPrefix = oldKey.replace(/\/[^/]+$/, '/');
        const newPrefix = result.playlistKey.replace(/\/[^/]+$/, '/');
        if (oldPrefix !== newPrefix) {
          await this.storage
            .deletePrefix(oldPrefix)
            .then(() => this.logger.log(`Хуучин видео устгав: ${oldPrefix}`))
            /* ⚠️ Алдааг ЗААВАЛ бүртгэнэ — чимээгүй залгивал орхигдсон
               файлыг хэн ч мэдэхгүй, зөвхөн тооцоо ирэхэд л илэрнэ */
            .catch((e) =>
              this.logger.error(`Хуучин видео устгаж чадсангүй (${oldPrefix}): ${String(e)}`),
            );
        }
      }
      this.logger.log(
        `HLS бэлэн: ${target}/${targetId} — ${result.segmentCount} segment, ${result.durationSec}s`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`HLS хөрвүүлэлт амжилтгүй: ${target}/${targetId} — ${msg}`);

      /**
       * ⚠️ БЭЛЭН БОЛСОН видеог FAILED болгож ДАРЖ БИЧИХГҮЙ.
       * Давхардсан/хоцрогдсон ажил унахад (raw аль хэдийн устсан) өмнө нь
       * амжилттай хөрвүүлэгдсэн кино "амжилтгүй" гэж харагдаж байв.
       */
      if (target !== 'trailer' && (await this.alreadyReady(target, targetId))) {
        this.logger.warn(
          `Ажил унасан ч видео БЭЛЭН — статус хэвээр үлдээв: ${target}/${targetId}`,
        );
        return;
      }

      // ⚠️ Алдааны шалтгааныг DB-д бичнэ — админ юу болсныг ХАРНА
      await this.setState(target, targetId, {
        streamStatus: 'FAILED',
        streamError: msg.slice(0, 500),
      }).catch(() => null);

      /**
       * ⚠️⚠️ TELEGRAM МЭДЭГДЭЛ — хөрвүүлэлт унасныг ХЭН НЭГЭН мэдэх ёстой.
       *
       * Өмнө нь зөвхөн DB-д `FAILED` тавиад өнгөрдөг байсан тул админ
       * админ панел руу орж шалгатал мэдэхгүй байв. Кино байршуулаад
       * «болсон» гэж бодоод явахад хэрэглэгч үзэж чадахгүй.
       *
       * ⚠️ `void` — мэдэгдэл унасан ч retry логик хэвийн үргэлжилнэ.
       */
      void this.notifyFailure(target, targetId, msg, job.attemptsMade + 1);

      throw err;
    }
  }

  /**
   * Хөрвүүлэлт унасныг Telegram-аар мэдэгдэнэ.
   *
   * ⚠️ Киноны НЭРИЙГ татна — `targetId` нь cuid тул мэдэгдэл дээр
   * «cmsrj...» гэж гарвал админ юу унаснаа мэдэхгүй.
   *
   * ⚠️ ХЭЗЭЭ Ч ШИДЭХГҮЙ — мэдэгдлээс болж retry логик эвдэрч болохгүй.
   */
  private async notifyFailure(
    target: string,
    targetId: string,
    reason: string,
    attempts: number,
  ): Promise<void> {
    try {
      let titleName = targetId;
      let episodeLabel: string | null = null;

      if (target === 'episode') {
        const ep = await this.prisma.episode.findUnique({
          where: { id: targetId },
          /* ⚠️ Episode-д `title` талбар БАЙХГҮЙ — `name` (заавал биш).
             Киноны нэр нь `season.title.title` замаар л олдоно. */
          select: {
            number: true,
            name: true,
            season: { select: { number: true, title: { select: { title: true } } } },
          },
        });
        if (ep) {
          titleName = ep.season?.title?.title ?? targetId;
          episodeLabel = `${ep.season?.number ?? 1}-${ep.number}-р анги`;
        }
      } else {
        const t = await this.prisma.title.findUnique({
          where: { id: targetId },
          select: { title: true },
        });
        if (t) titleName = t.title;
      }

      this.n8n.emitVideoFailed({
        titleName,
        episodeLabel,
        reason,
        attempts,
        failedAt: new Date().toISOString(),
      });
    } catch (e) {
      this.logger.warn(`Мэдэгдэл илгээж чадсангүй: ${String(e).slice(0, 100)}`);
    }
  }

  /**
   * Тухайн кино/анги АЛЬ ХЭДИЙН амжилттай хөрвүүлэгдсэн эсэх.
   * `videoKey` + `READY` хоёул байвал дахин хөрвүүлэх шаардлагагүй.
   */
  /**
   * Ажлын хавтас байрлах дискний СУЛ зай (GB).
   *
   * ⚠️ `statfs` — Node 18.15+. Алдаа гарвал `null` буцаана: зай шалгаж
   * чадаагүй нь хөрвүүлэлтийг ЗОГСООХ шалтгаан биш (false-safe).
   */
  private async freeDiskGb(): Promise<number | null> {
    try {
      const { statfs } = await import('fs/promises');
      const s = await statfs(process.cwd());
      return (s.bavail * s.bsize) / 1024 ** 3;
    } catch {
      return null;
    }
  }

  private async alreadyReady(
    target: VideoHlsJob['target'],
    targetId: string,
  ): Promise<boolean> {
    try {
      if (target === 'movie') {
        const t = await this.prisma.title.findUnique({
          where: { id: targetId },
          select: { videoKey: true, streamStatus: true },
        });
        return Boolean(t?.videoKey && t.streamStatus === 'READY');
      }
      const e = await this.prisma.episode.findUnique({
        where: { id: targetId },
        select: { videoKey: true, streamStatus: true },
      });
      return Boolean(e?.videoKey && e.streamStatus === 'READY');
    } catch {
      // Шалгаж чадсангүй — хөрвүүлэлтийг үргэлжлүүлнэ (алгасахаас илүү аюулгүй)
      return false;
    }
  }

  /**
   * Постер БАЙХГҮЙ бол видеоноос гарсан кадрыг постер болгоно.
   *
   * ⚠️ Байгаа постерыг ХЭЗЭЭ Ч дарж бичихгүй — админ гараар оруулсан
   * жинхэнэ постер нь автомат кадраас үргэлж дээр.
   * Title, Episode хоёул `posterKey` талбартай.
   */
  private async posterIfMissing(
    target: VideoHlsJob['target'],
    targetId: string,
    posterKey: string,
  ): Promise<Record<string, string>> {
    try {
      if (target === 'movie') {
        const t = await this.prisma.title.findUnique({
          where: { id: targetId },
          select: { posterKey: true },
        });
        if (t && !t.posterKey) {
          /**
           * ⚠️⚠️ CDN НЭЭДЭГ ЗАМ РУУ ХУУЛНА — `movies/` зам нь 403.
           *
           * БОДИТ АЛДАА: Cloudflare (`assets.besttv.us`) нь `images/`
           * болон `episodes/` замыг нээдэг ч `movies/` замыг **403**
           * гэж ХААДАГ. Видеоны кадраас гаргасан постер нь
           * `movies/<uuid>/poster.jpg` замд бичигддэг тул 30 киноны
           * постер хэрэглэгчид ОГТ ХАРАГДАХГҮЙ (хоосон хайрцаг) байв.
           *
           * `images/poster/` руу хуулснаар CDN-ээр хүрнэ.
           */
          const cdnKey = await this.copyPosterToCdnPath(posterKey);
          this.logger.log(`Постер алга — видеоноос гаргав: movie/${targetId}`);
          return { posterKey: cdnKey };
        }
      } else if (target === 'episode') {
        const e = await this.prisma.episode.findUnique({
          where: { id: targetId },
          select: { posterKey: true },
        });
        if (e && !e.posterKey) return { posterKey };
      }
    } catch {
      // Постер бол нэмэлт зүйл — алдаа гарвал хөрвүүлэлтийг УНАГААХГҮЙ
    }
    return {};
  }

  /**
   * Постерыг CDN нээдэг зам руу хуулна.
   *
   * ⚠️ Хуулж чадаагүй бол ЭХ түлхүүрийг буцаана — постергүй үлдэхээс
   * (магадгүй харагдахгүй ч) DB-д заалт байсан нь дээр.
   */
  private async copyPosterToCdnPath(srcKey: string): Promise<string> {
    try {
      const buf = await this.storage.downloadBuffer(srcKey);
      const ext = srcKey.endsWith('.webp') ? 'webp' : 'jpg';
      const dest = `images/poster/${randomUUID()}.${ext}`;
      await this.storage.upload(dest, buf, ext === 'webp' ? 'image/webp' : 'image/jpeg');
      return dest;
    } catch (e) {
      this.logger.warn(`Постерыг CDN зам руу хуулж чадсангүй: ${String(e)}`);
      return srcKey;
    }
  }

  /**
   * Title/Episode-ийн төлөв шинэчлэх — нэг цэгээс.
   * ⚠️ trailer нь Title-ийн streamStatus-ыг хөндөхгүй (кинонд зориулагдсан).
   */
  /**
   * Админ watermark чагтласан эсэх.
   *
   * ⚠️ АНГИД: тухайн ангийн чагт, эсвэл КИНОНЫ чагт — аль нэг нь
   * үнэн бол шатаана. Ингэснээр админ цувралын түвшинд НЭГ УДАА
   * чагтлаад бүх ангид үйлчилнэ (анги бүрд дарах шаардлагагүй).
   */
  private async wantsWatermark(
    target: VideoHlsJob['target'],
    targetId: string,
  ): Promise<boolean> {
    if (target === 'movie') {
      const t = await this.prisma.title
        .findUnique({ where: { id: targetId }, select: { watermark: true } })
        .catch(() => null);
      return Boolean(t?.watermark);
    }
    const e = await this.prisma.episode
      .findUnique({
        where: { id: targetId },
        select: { watermark: true, season: { select: { title: { select: { watermark: true } } } } },
      })
      .catch(() => null);
    if (!e) return false;
    /**
     * ⚠️⚠️ АНГИЙН ТОХИРГОО КИНОНЫХЫГ ДАРНА (override, OR БИШ).
     *
     * Өмнө нь `анги || кино` байсан тул:
     *   • кинонд чагтлахад БҮХ ангид ХҮЧЭЭР ордог
     *   • нэг ангид хасах боломж ОГТ байхгүй
     * Гэтэл админ зарим ангийг логогүй үлдээх бодит хэрэгцээтэй
     * (жишээ: өөр эх сурвалжаас авсан, аль хэдийн логотой бичлэг).
     *
     * Гурван төлөв:
     *   null  → кинооос өвлөнө
     *   true  → заавал тавина (кино унтраасан ч)
     *   false → заавал тавихгүй (кино асаасан ч)
     */
    if (e.watermark !== null) return e.watermark;
    return Boolean(e.season.title.watermark);
  }

  /**
   * Одоогийн `videoKey` (эсвэл трейлерийн `trailerKey`).
   * ⚠️ Дахин байршуулахад ХУУЧИН зам — устгахад хэрэгтэй.
   */
  private async currentVideoKey(
    target: VideoHlsJob['target'],
    targetId: string,
  ): Promise<string | null> {
    if (target === 'trailer') {
      const t = await this.prisma.title
        .findUnique({ where: { id: targetId }, select: { trailerKey: true } })
        .catch(() => null);
      return t?.trailerKey ?? null;
    }
    if (target === 'movie') {
      const t = await this.prisma.title
        .findUnique({ where: { id: targetId }, select: { videoKey: true } })
        .catch(() => null);
      return t?.videoKey ?? null;
    }
    const e = await this.prisma.episode
      .findUnique({ where: { id: targetId }, select: { videoKey: true } })
      .catch(() => null);
    return e?.videoKey ?? null;
  }

  private async setState(
    target: VideoHlsJob['target'],
    targetId: string,
    data: Record<string, unknown>,
  ) {
    if (target === 'trailer') return;
    if (target === 'movie') {
      await this.prisma.title.update({ where: { id: targetId }, data }).catch(() => null);
    } else {
      await this.prisma.episode.update({ where: { id: targetId }, data }).catch(() => null);
    }
  }
}
