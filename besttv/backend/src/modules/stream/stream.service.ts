import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { VideoHlsService } from '../../storage/video-hls.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

/**
 * Stream gate — Premium контент хамгаалалтын ГОЛ цэг.
 *
 * Урсгал:
 *  1. hls.js манай API-аас m3u8 татна (Bearer token-той)
 *  2. Эрх шалгана (үнэгүй контент → чөлөөтэй; premium → идэвхтэй subscription)
 *  3. R2-оос m3u8 текст уншаад доторх segment мөр бүрийг presigned URL болгож
 *     СОЛИОД буцаана (2 цаг хүчинтэй, LRU кэштэй — локал crypto, хурдан)
 *  4. hls.js segment-үүдийг R2-оос ШУУД татна — bandwidth backend-ээр дамжихгүй
 *
 * ⚠️ Bucket PRIVATE тул m3u8 линк задарсан ч эрхгүй хүн юу ч үзэж чадахгүй.
 */
@Injectable()
export class StreamService {
  // Segment presign хугацаа — урт кино үзэж дуустал хүрэлцэнэ
  private readonly SEGMENT_EXPIRES = 4 * 60 * 60; // 4 цаг

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly subs: SubscriptionsService,
    /** ⚠️ Thumbnail backfill-д — sprite/VTT үүсгэнэ */
    private readonly hls: VideoHlsService,
  ) {}

  /** Киноны үндсэн видео */
  async moviePlaylist(titleId: string, userId?: string | null): Promise<string> {
    const title = await this.prisma.title.findUnique({
      where: { id: titleId },
      select: {
        videoKey: true,
        isPremium: true,
        isActive: true,
        streamStatus: true,
        genres: { select: { genreId: true } },
      },
    });
    if (!title?.videoKey || !title.isActive || title.streamStatus !== 'READY') {
      throw new NotFoundException('Видео бэлэн биш байна');
    }

    await this.assertAccess(
      title.isPremium,
      title.genres.map((g) => g.genreId),
      userId,
      /**
       * ⚠️⚠️ `titleId` ЗААВАЛ — эс бөгөөс ТҮРЭЭС ОГТ ШАЛГАГДАХГҮЙ.
       *
       * `canAccessTitle` нь titleId байвал л идэвхтэй түрээс байгаа
       * эсэхийг хардаг. Өмнө нь энэ параметрийг дамжуулаагүй тул
       * ширхэгээр түрээслэсэн хэрэглэгч 403 авч, кино мөнхөд ачаалж
       * байв (багцтай хүн л үзэж чаддаг байсан).
       */
      titleId,
    );
    // ⚠️ ABR master бол дэд playlist-ыг манай API руу чиглүүлнэ (эрх дахин шалгагдана)
    return this.rewritePlaylist(title.videoKey, `/api/stream/movie/${titleId}/variant.m3u8`);
  }

  /**
   * SEEK THUMBNAIL — WebVTT (sprite зураг руу заана).
   *
   * ⚠️ VTT доторх `thumbs.jpg#xywh=...` нь ХАРЬЦАНГУЙ зам. Player түүнийг
   * VTT-ийн байрлалаас тооцдог тул sprite-ын БҮТЭН presigned URL болгож
   * дарж бичнэ — эс бөгөөс browser нь манай API замаас хайж 404 авна.
   *
   * ⚠️ Эрх шалгана — thumbnail нь киноны агуулгыг харуулдаг тул
   * задгай байвал төлбөргүй хүн киног кадраар нь үзэж болно.
   */
  async movieThumbnails(titleId: string, userId?: string | null): Promise<string> {
    const title = await this.prisma.title.findUnique({
      where: { id: titleId },
      select: {
        videoKey: true,
        isPremium: true,
        isActive: true,
        streamStatus: true,
        genres: { select: { genreId: true } },
      },
    });
    if (!title?.videoKey || !title.isActive || title.streamStatus !== 'READY') {
      throw new NotFoundException('Видео бэлэн биш байна');
    }
    await this.assertAccess(
      title.isPremium,
      title.genres.map((g) => g.genreId),
      userId,
      /**
       * ⚠️⚠️ `titleId` ЗААВАЛ — эс бөгөөс ТҮРЭЭС ОГТ ШАЛГАГДАХГҮЙ.
       *
       * `canAccessTitle` нь titleId байвал л идэвхтэй түрээс байгаа
       * эсэхийг хардаг. Өмнө нь энэ параметрийг дамжуулаагүй тул
       * ширхэгээр түрээслэсэн хэрэглэгч 403 авч, кино мөнхөд ачаалж
       * байв (багцтай хүн л үзэж чаддаг байсан).
       */
      titleId,
    );

    const prefix = title.videoKey.slice(0, title.videoKey.lastIndexOf('/') + 1);
    let vtt: string;
    try {
      vtt = await this.storage.downloadText(`${prefix}thumbs.vtt`);
    } catch {
      /* ⚠️ Хуучин видеонд thumbnail байхгүй — ХООСОН VTT буцаана.
         Player нь preview-гүй л ажиллана (алдаа гаргахгүй). */
      return 'WEBVTT\n';
    }

    const spriteUrl = await this.storage.presignGet(`${prefix}thumbs.jpg`, this.SEGMENT_EXPIRES);
    return vtt.replace(/^thumbs\.jpg(#[^\s]*)?$/gm, (_m, frag) => `${spriteUrl}${frag ?? ''}`);
  }

  /**
   * ХУУЧИН кинонуудад seek thumbnail НӨХӨХ (админ).
   *
   * ⚠️ Thumbnail нь 2026-08-06-нд нэмэгдсэн тул түүнээс өмнө хөрвүүлсэн
   * бүх кинонд байхгүй. Raw файл устсан тул R2 дээрх HLS-ээс уншина:
   * segment бүрийг presign хийсэн playlist-ыг ffmpeg-д өгнө.
   *
   * @returns { done, skipped, failed } — тоо
   */
  /**
   * ХАР ПОСТЕРЫГ дахин үүсгэх (кино + анги).
   *
   * ⚠️⚠️ ЯАГААД: постерыг өмнө нь 1 ДАХЬ СЕКУНДЭЭС авдаг байсан тул
   * бараг үргэлж ХАР ДЭЛГЭЦ/студийн лого гардаг байв. Agent Kim
   * цувралын 10 ангийн thumbnail БҮГД хар хайрцаг (3.5 KB JPEG).
   * `makePoster` одоо 10%-д авдаг болсон ч ӨМНӨ хөрвүүлсэн видео
   * хэвээр — тэднийг ЭНЭ функц засна.
   *
   * ⚠️ Raw файл устсан тул R2 дээрх HLS-ээс уншина.
   * ⚠️ `force=false` бол ЗӨВХӨН жижиг (сэжигтэй) постерыг дарж бичнэ —
   * админ гараар оруулсан сайн постер хөндөгдөхгүй.
   */
  async backfillPosters(
    limit = 10,
    force = false,
  ): Promise<{ done: string[]; skipped: string[]; failed: { title: string; reason: string }[] }> {
    const done: string[] = [];
    const skipped: string[] = [];
    const failed: { title: string; reason: string }[] = [];

    /**
     * ⚠️⚠️ ЗӨВХӨН АНГИ — КИНОНЫ ПОСТЕРТ ХЭЗЭЭ Ч ХҮРЭХГҮЙ.
     *
     * БОДИТ ОСОЛ: энэ функц эхлээд кино+анги ХОЁУЛАНГ хамардаг байсан
     * тул 30 киноны ЖИНХЭНЭ постерыг (TMDB-ээс татсан, админ сонгосон)
     * видеоны кадраар дарж бичсэн. Сэргээхэд R2 дээрх хуучин файл
     * хадгалагдсан нь аварсан — versioning OFF тул азаар л сэргэсэн.
     *
     * Кино нь ПОСТЕРТОЙ (TMDB / админ оруулсан) — кадар хэрэггүй.
     * Зөвхөн АНГИ нь өөрийн зурагтай байдаггүй тул кадар авна.
     */
    const episodes = await this.prisma.episode.findMany({
        where: { streamStatus: 'READY', videoKey: { not: null } },
        select: {
          id: true,
          number: true,
          videoKey: true,
          posterKey: true,
          season: { select: { title: { select: { title: true } } } },
        },
      orderBy: { number: 'asc' },
    });

    const targets = episodes.map((e) => ({
      id: e.id,
      label: `${e.season?.title?.title ?? 'Цуврал'} — ${e.number}-р анги`,
      videoKey: e.videoKey!,
      posterKey: e.posterKey,
    }));

    for (const t of targets) {
      if (done.length >= limit) break;
      const prefix = t.videoKey.slice(0, t.videoKey.lastIndexOf('/') + 1);

      /**
       * ⚠️⚠️ DB-ийн `posterKey`-г шалгана, `poster.jpg`-ыг БИШ.
       *
       * Зассан постер нь ШИНЭ нэртэй (`poster-<ts>.jpg` — CDN кэш
       * тойрох) тул хуучин `poster.jpg` R2-д 3 KB хэвээр үлддэг.
       * Түүнийг шалгавал ДАХИН ажиллах бүрд ижил видеог дахин
       * боловсруулна (дэмий CPU).
       */
      if (!force) {
        try {
          const cur = await this.storage.downloadBuffer(t.posterKey ?? `${prefix}poster.jpg`);
          if (cur.length >= 5120) {
            skipped.push(t.label);
            continue;
          }
        } catch {
          /* байхгүй — үүсгэнэ */
        }
      }

      try {
        /* ⚠️ ХАМГИЙН БАГА чанарын дэд playlist — постер 640px тул
           өндөр чанар хэрэггүй, татах хэмжээ хэд дахин бага */
        const master = await this.storage.downloadText(t.videoKey);
        const variants = master
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => /^v\d+\.m3u8$/.test(l));
        const listKey = variants.length ? `${prefix}${variants[variants.length - 1]}` : t.videoKey;
        const playlist = await this.variantPlaylistRaw(listKey, prefix);

        const newKey = await this.hls.backfillPoster(playlist, prefix);

        /* ⚠️ DB-г ЗААВАЛ шинэчилнэ — постер шинэ нэртэй (CDN кэш
           тойрох) тул хуучин `posterKey` хэвээр үлдвэл хэрэглэгч
           хуучин хар зургийг л харсаар байна */
        await this.prisma.episode.update({ where: { id: t.id }, data: { posterKey: newKey } });
        done.push(t.label);
      } catch (e) {
        failed.push({ title: t.label, reason: String(e).slice(0, 120) });
      }
    }

    return { done, skipped, failed };
  }

  async backfillThumbnails(limit = 5): Promise<{
    done: string[];
    skipped: string[];
    failed: { title: string; reason: string }[];
  }> {
    const titles = await this.prisma.title.findMany({
      where: { streamStatus: 'READY', videoKey: { not: null } },
      select: { id: true, title: true, videoKey: true, durationSec: true },
      orderBy: { createdAt: 'asc' },
    });

    const done: string[] = [];
    const skipped: string[] = [];
    const failed: { title: string; reason: string }[] = [];

    for (const t of titles) {
      if (done.length >= limit) break;
      const prefix = t.videoKey!.slice(0, t.videoKey!.lastIndexOf('/') + 1);

      // Аль хэдийн байвал алгасна (дахин ажиллуулж болно)
      try {
        await this.storage.downloadText(`${prefix}thumbs.vtt`);
        skipped.push(t.title);
        continue;
      } catch {
        /* байхгүй — үүсгэнэ */
      }

      try {
        /**
         * ⚠️ ХАМГИЙН БАГА чанарын дэд playlist-ыг ашиглана — sprite нь
         * 160px өргөн тул өндөр чанар ХЭРЭГГҮЙ, харин татах хэмжээ
         * хэд дахин бага (backfill хурдан дуусна).
         */
        const master = await this.storage.downloadText(t.videoKey!);
        const variants = master
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => /^v\d+\.m3u8$/.test(l));
        const variantName = variants.length ? variants[variants.length - 1] : null;

        const listKey = variantName ? `${prefix}${variantName}` : t.videoKey!;
        const playlist = await this.variantPlaylistRaw(listKey, prefix);

        await this.hls.backfillThumbnails(playlist, prefix, t.durationSec ?? 0);
        done.push(t.title);
      } catch (e) {
        failed.push({ title: t.title, reason: String(e).slice(0, 120) });
      }
    }

    return { done, skipped, failed };
  }


  /**
   * Segment-ийн URL — CDN байвал ТҮҮГЭЭР, эс бөгөөс presign.
   *
   * ⚠️⚠️ ЯАГААД CDN нь ЧУХАЛ ВЭ: R2-ийн S3 endpoint нь кэш ХИЙДЭГГҮЙ
   * (`cf-cache-status` байхгүй) тул хэрэглэгч бүр эх bucket руу очиж,
   * хол улсаас удаан болдог. Cloudflare Worker (`VIDEO_CDN_URL`) нь
   * ижил segment-ийг 330+ хотод кэшлэнэ.
   *
   * ⚠️ `VIDEO_CDN_URL` тохируулаагүй бол ХУУЧИН зан төлөв хэвээр —
   * Worker deploy хийгээгүй байсан ч сайт ажилласаар байна.
   */
  private segmentUrl(key: string): Promise<string> {
    const cdn = this.storage.videoCdnUrl(key, this.SEGMENT_EXPIRES);
    return cdn ? Promise.resolve(cdn) : this.storage.presignGet(key, this.SEGMENT_EXPIRES);
  }

  /** m3u8 уншаад segment мөр бүрийг URL болгоно (нэг түвшин) */
  private async variantPlaylistRaw(m3u8Key: string, prefix: string): Promise<string> {
    const text = await this.storage.downloadText(m3u8Key);
    const lines = await Promise.all(
      text.split('\n').map(async (line) => {
        const t = line.trim();
        if (!t || t.startsWith('#')) return line;
        return this.segmentUrl(prefix + t);
      }),
    );
    return lines.join('\n');
  }

  /** ABR дэд playlist — киноны v0/v1/v2 */
  async movieVariant(titleId: string, variant: string, userId?: string | null): Promise<string> {
    const title = await this.prisma.title.findUnique({
      where: { id: titleId },
      select: {
        videoKey: true,
        isPremium: true,
        isActive: true,
        streamStatus: true,
        genres: { select: { genreId: true } },
      },
    });
    if (!title?.videoKey || !title.isActive || title.streamStatus !== 'READY') {
      throw new NotFoundException('Видео бэлэн биш байна');
    }
    await this.assertAccess(
      title.isPremium,
      title.genres.map((g) => g.genreId),
      userId,
      /**
       * ⚠️⚠️ `titleId` ЗААВАЛ — эс бөгөөс ТҮРЭЭС ОГТ ШАЛГАГДАХГҮЙ.
       *
       * `canAccessTitle` нь titleId байвал л идэвхтэй түрээс байгаа
       * эсэхийг хардаг. Өмнө нь энэ параметрийг дамжуулаагүй тул
       * ширхэгээр түрээслэсэн хэрэглэгч 403 авч, кино мөнхөд ачаалж
       * байв (багцтай хүн л үзэж чаддаг байсан).
       */
      titleId,
    );
    return this.variantPlaylist(title.videoKey, variant);
  }

  /** Цувралын анги */
  async episodePlaylist(episodeId: string, userId?: string | null): Promise<string> {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      select: {
        videoKey: true,
        streamStatus: true,
        isFreePreview: true,
        season: {
          select: {
            title: {
              select: {
                /* Rental нь TITLE дээр бүртгэгддэг тул эцгийн id хэрэгтэй */
                id: true,
                isPremium: true,
                isActive: true,
                genres: { select: { genreId: true } },
              },
            },
          },
        },
      },
    });
    if (
      !episode?.videoKey ||
      episode.streamStatus !== 'READY' ||
      !episode.season.title.isActive
    ) {
      throw new NotFoundException('Видео бэлэн биш байна');
    }

    // Үнэгүй урьдчилан үзэх анги — эрх шалгахгүй
    const premium = episode.season.title.isPremium && !episode.isFreePreview;
    await this.assertAccess(
      premium,
      episode.season.title.genres.map((g) => g.genreId),
      userId,
      /* ⚠️ Түрээс нь ЦУВРАЛ дээр ч боломжтой — эцэг титулын id-аар шалгана */
      episode.season.title.id,
    );
    return this.rewritePlaylist(
      episode.videoKey,
      `/api/stream/episode/${episodeId}/variant.m3u8`,
    );
  }

  /** ABR дэд playlist — ангийн v0/v1/v2 */
  async episodeVariant(
    episodeId: string,
    variant: string,
    userId?: string | null,
  ): Promise<string> {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      select: {
        videoKey: true,
        streamStatus: true,
        isFreePreview: true,
        season: {
          select: {
            title: {
              select: {
                /* Rental нь TITLE дээр бүртгэгддэг тул эцгийн id хэрэгтэй */
                id: true,
                isPremium: true,
                isActive: true,
                genres: { select: { genreId: true } },
              },
            },
          },
        },
      },
    });
    if (!episode?.videoKey || episode.streamStatus !== 'READY' || !episode.season.title.isActive) {
      throw new NotFoundException('Видео бэлэн биш байна');
    }
    const premium = episode.season.title.isPremium && !episode.isFreePreview;
    await this.assertAccess(
      premium,
      episode.season.title.genres.map((g) => g.genreId),
      userId,
      /* ⚠️ Түрээс нь ЦУВРАЛ дээр ч боломжтой — эцэг титулын id-аар шалгана */
      episode.season.title.id,
    );
    return this.variantPlaylist(episode.videoKey, variant);
  }

  /** Трейлер — ҮРГЭЛЖ нээлттэй (hero autoplay, дэлгэрэнгүй хуудас) */
  async trailerPlaylist(titleId: string): Promise<string> {
    const title = await this.prisma.title.findUnique({
      where: { id: titleId },
      select: { trailerKey: true, isActive: true },
    });
    if (!title?.trailerKey || !title.isActive) {
      throw new NotFoundException('Трейлер олдсонгүй');
    }
    return this.rewritePlaylist(title.trailerKey, `/api/stream/trailer/${titleId}/variant.m3u8`);
  }

  /** ABR дэд playlist — трейлерийн v0/v1/v2 (нээлттэй) */
  async trailerVariant(titleId: string, variant: string): Promise<string> {
    const title = await this.prisma.title.findUnique({
      where: { id: titleId },
      select: { trailerKey: true, isActive: true },
    });
    if (!title?.trailerKey || !title.isActive) {
      throw new NotFoundException('Трейлер олдсонгүй');
    }
    return this.variantPlaylist(title.trailerKey, variant);
  }

  /**
   * АДМИН PREVIEW — байршуулсан видеогоо шалгах.
   *
   * ⚠️ Эрх шалгалт (assertAccess) ХИЙХГҮЙ: админ багц худалдаж авалгүйгээр
   * өөрийн контентоо шалгах ёстой. Гэхдээ `isActive` шалгахгүй — идэвхгүй
   * (нийтлээгүй) контентоо ч урьдчилан үзэх шаардлагатай.
   * Хамгаалалт: controller дээр JwtAuthGuard + RolesGuard(ADMIN).
   */
  async adminPreview(kind: 'movie' | 'episode' | 'trailer', id: string): Promise<string> {
    let key: string | null = null;

    if (kind === 'episode') {
      const ep = await this.prisma.episode.findUnique({
        where: { id },
        select: { videoKey: true, streamStatus: true },
      });
      if (ep?.streamStatus !== 'READY') throw new NotFoundException('Видео бэлэн биш байна');
      key = ep.videoKey;
    } else if (kind === 'movie') {
      const t = await this.prisma.title.findUnique({
        where: { id },
        select: { videoKey: true, streamStatus: true },
      });
      if (t?.streamStatus !== 'READY') throw new NotFoundException('Видео бэлэн биш байна');
      key = t.videoKey;
    } else {
      const t = await this.prisma.title.findUnique({
        where: { id },
        select: { trailerKey: true },
      });
      key = t?.trailerKey ?? null;
    }

    if (!key) throw new NotFoundException('Видео олдсонгүй');
    /**
     * ⚠️ ABR master бол дэд playlist-ыг АДМИН variant endpoint руу чиглүүлнэ.
     * Өмнө нь `variantBase`-гүй дуудаж байсан тул `v0.m3u8`-ыг presign хийж,
     * ДОТОРХ segment-үүд presign хийгдээгүй үлдэж, видео ОГТ ТОГЛОХГҮЙ байв.
     */
    return this.rewritePlaylist(key, `/api/admin/stream/${kind}/${id}/variant.m3u8`);
  }

  /** Админ preview-ийн ABR дэд playlist (эрх шалгахгүй, ADMIN guard хамгаална) */
  async adminVariant(
    kind: 'movie' | 'episode' | 'trailer',
    id: string,
    variant: string,
  ): Promise<string> {
    let key: string | null = null;
    if (kind === 'episode') {
      const ep = await this.prisma.episode.findUnique({
        where: { id },
        select: { videoKey: true },
      });
      key = ep?.videoKey ?? null;
    } else {
      const t = await this.prisma.title.findUnique({
        where: { id },
        select: { videoKey: true, trailerKey: true },
      });
      key = kind === 'trailer' ? (t?.trailerKey ?? null) : (t?.videoKey ?? null);
    }
    if (!key) throw new NotFoundException('Видео олдсонгүй');
    return this.variantPlaylist(key, variant);
  }

  /**
   * ⚠️ Эрхийн ГОЛ шалгуур — багц ↔ жанраар.
   * Контентын жанруудын АЛЬ НЭГИЙГ нээдэг багцтай (эсвэл VIP) бол зөвшөөрнө.
   */
  private async assertAccess(
    isPremium: boolean,
    titleGenreIds: string[],
    userId?: string | null,
    titleId?: string,
  ) {
    if (!isPremium) return; // үнэгүй контент
    // ⚠️ titleId дамжуулснаар ТҮРЭЭС ч шалгагдана (багцгүй ч үзэж болно)
    const ok = await this.subs.canAccessTitle(userId, titleGenreIds, titleId);
    if (!ok) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Энэ контентыг үзэхэд багц эсвэл түрээс шаардлагатай',
      });
    }
  }

  /**
   * m3u8 доторх файлын нэрсийг presigned URL болгоно.
   *
   * ⚠️ ХОЁР ТӨРЛИЙН playlist:
   *   1. MASTER (ABR) — доторх мөрүүд нь `v0.m3u8` гэх мэт ДЭД PLAYLIST.
   *      Эдгээрийг presign хийвэл болохгүй: тэдгээр нь эргээд segment
   *      жагсаалттай бөгөөд presign хийгдээгүй байна. Тиймээс дэд
   *      playlist-ыг ЭНД ДОТОР нь задалж, segment-үүдийг нь presign хийж,
   *      бүхэл ABR бүтцийг НЭГ хариунд буцаах боломжгүй (HLS стандарт
   *      зөвшөөрөхгүй) → оронд нь дэд playlist-ыг манай API руу чиглүүлнэ.
   *   2. MEDIA (нэг түвшин, хуучин видео) — segment шууд presign.
   */
  /**
   * ⚠️⚠️ PLAYLIST КЭШ — SEEK УДААН БАЙСНЫ ГОЛ ШАЛТГААН.
   *
   * `rewritePlaylist` нь playlist доторх segment БҮРД presigned URL
   * үүсгэдэг (нэг кинонд 170-2000 ширхэг). Монголоос хэмжихэд дуудалт
   * бүр ~0.8 СЕКУНД зарцуулж байв. Player нь seek хийх бүрт, чанар
   * солих бүрт playlist-ыг ДАХИН татдаг тул хэрэглэгч тэр 0.8с-ыг
   * дахин дахин хүлээнэ.
   *
   * Presigned URL 4 ЦАГ хүчинтэй тул үр дүнг 30 минут кэшлэх нь бүрэн
   * аюулгүй — кэшнээс гарсан URL хамгийн муудаа 3.5 цаг хүчинтэй хэвээр.
   *
   * ⚠️ Кэш нь ЗӨВХӨН R2 presign-ийг хэмнэнэ. Эрхийн шалгалт нь controller
   * түвшинд, дуудалт бүрт хийгдсээр байна (кэш эрх тойрохгүй).
   */
  private readonly playlistCache = new Map<string, { at: number; text: string }>();
  private static readonly PLAYLIST_TTL_MS = 30 * 60 * 1000;

  private async rewritePlaylist(m3u8Key: string, variantBase?: string): Promise<string> {
    const cacheKey = `${m3u8Key}|${variantBase ?? ''}`;
    const hit = this.playlistCache.get(cacheKey);
    if (hit && Date.now() - hit.at < StreamService.PLAYLIST_TTL_MS) return hit.text;

    const text = await this.storage.downloadText(m3u8Key);
    const prefix = m3u8Key.slice(0, m3u8Key.lastIndexOf('/') + 1);
    const isMaster = text.includes('#EXT-X-STREAM-INF');

    const lines = await Promise.all(
      text.split('\n').map(async (line) => {
        const trimmed = line.trim();
        // Тайлбар/директив мөрүүд хэвээр — зөвхөн файлын мөрийг солино
        if (!trimmed || trimmed.startsWith('#')) return line;
        // Абсолют URL байвал (байх ёсгүй) хэвээр
        if (trimmed.startsWith('http')) return line;

        /**
         * ⚠️ MASTER доторх дэд playlist — presign ХИЙХГҮЙ, манай API руу
         * чиглүүлнэ. Ингэснээр player дэд playlist авахдаа ДАХИН эрхийн
         * шалгалтаас өнгөрч, зөвхөн segment нь R2-оос шууд урсана.
         */
        if (isMaster && variantBase) {
          return `${variantBase}?v=${encodeURIComponent(trimmed)}`;
        }
        return this.segmentUrl(prefix + trimmed);
      }),
    );

    const out = lines.join('\n');
    this.playlistCache.set(cacheKey, { at: Date.now(), text: out });

    /**
     * ⚠️ Санах ой хамгаалалт — хугацаа дууссан бичлэгүүдийг цэвэрлэнэ.
     * Кэш хязгааргүй өсвөл олон кинотой сайт дээр RAM дүүрнэ.
     */
    if (this.playlistCache.size > 200) {
      const now = Date.now();
      for (const [k, v] of this.playlistCache) {
        if (now - v.at >= StreamService.PLAYLIST_TTL_MS) this.playlistCache.delete(k);
      }
    }
    return out;
  }

  /**
   * ABR-ийн ДЭД playlist (v0.m3u8 / v1.m3u8 ...) — segment-үүдийг presign.
   *
   * ⚠️ `variant` нь ГАДНААС ирдэг тул зам гарах халдлагаас хамгаална:
   * зөвхөн `vN.m3u8` хэлбэрийг зөвшөөрнө ("../" гэх мэт бүрэн хаагдана).
   */
  private async variantPlaylist(m3u8Key: string, variant: string): Promise<string> {
    if (!/^v\d+\.m3u8$/.test(variant)) {
      throw new NotFoundException('Буруу playlist');
    }
    const prefix = m3u8Key.slice(0, m3u8Key.lastIndexOf('/') + 1);
    return this.rewritePlaylist(prefix + variant);
  }
}
