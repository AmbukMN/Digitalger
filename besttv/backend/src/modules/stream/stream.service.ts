import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
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
    );
    return this.rewritePlaylist(title.videoKey);
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
    );
    return this.rewritePlaylist(episode.videoKey);
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
    return this.rewritePlaylist(title.trailerKey);
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
    return this.rewritePlaylist(key);
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
   * m3u8 доторх segment файлын нэрсийг (seg_000.ts ...) presigned URL болгоно.
   * m3u8 нь жижиг текст (кино ~30KB) тул backend-ээр дамжихад асуудалгүй.
   */
  private async rewritePlaylist(m3u8Key: string): Promise<string> {
    const text = await this.storage.downloadText(m3u8Key);
    const prefix = m3u8Key.slice(0, m3u8Key.lastIndexOf('/') + 1);

    const lines = await Promise.all(
      text.split('\n').map(async (line) => {
        const trimmed = line.trim();
        // Тайлбар/директив мөрүүд хэвээр — зөвхөн segment файлын мөрийг солино
        if (!trimmed || trimmed.startsWith('#')) return line;
        // Абсолют URL байвал (байх ёсгүй) хэвээр
        if (trimmed.startsWith('http')) return line;
        return this.storage.presignGet(prefix + trimmed, this.SEGMENT_EXPIRES);
      }),
    );

    return lines.join('\n');
  }
}
