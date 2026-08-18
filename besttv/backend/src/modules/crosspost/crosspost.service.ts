import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CrosspostStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { MetaGraphService, type FbPost } from './meta-graph.service';

/** IG-д шилжүүлэх боломжтой эсэх + шалтгаан */
export interface Transferability {
  kind: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'TEXT' | 'LINK';
  canTransfer: boolean;
  /** Боломжгүй бол ЯАГААД — админд шууд харуулна */
  reason?: string;
  /** Шилжүүлэх медиа хаягууд (FB CDN) */
  mediaUrls: string[];
}

/**
 * ⚠️ Instagram-ийн медиа хязгаарууд (Meta-гийн албан ёсны).
 * Хэтэрвэл IG татахдаа алдаа өгнө — урьдчилж шалгавал дэмий
 * хуулалт хийхгүй.
 */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_VIDEO_BYTES = 300 * 1024 * 1024; // 300MB (Reels)
const MAX_CAPTION = 2200;
const MAX_CAROUSEL = 10;

/** ⚠️ SSRF хамгаалалт — зөвхөн Meta-гийн CDN-ээс татна */
const ALLOWED_HOSTS = ['fbcdn.net', 'fbsbx.com', 'cdninstagram.com', 'facebook.com'];

@Injectable()
export class CrosspostService {
  private readonly logger = new Logger(CrosspostService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly meta: MetaGraphService,
  ) {}

  // ─── Ангилал ──────────────────────────────────────────────────────────────

  /**
   * FB постыг IG рүү шилжүүлэх БОЛОМЖТОЙ эсэхийг тодорхойлно.
   *
   * ⚠️⚠️ ЧИМЭЭГҮЙ АЛГАСАХГҮЙ. Боломжгүй постыг зүгээр нуувал админ
   * «яагаад миний 20 постын 12 нь л орсон бэ?» гэж эргэлзэнэ. Тиймээс
   * шалтгааныг ЗААВАЛ буцаана.
   *
   * Instagram-ийн ҮНДСЭН хязгаарлалт: зураг/видеогүй пост нийтлэхийг
   * ОГТ зөвшөөрдөггүй (энэ нь бидний код биш, платформын дүрэм).
   */
  classify(post: FbPost): Transferability {
    /* Зураг/видеоны хаягуудыг цуглуулна — album бол subattachment-ууд */
    const media: { url: string; isVideo: boolean }[] = [];

    for (const att of post.attachments) {
      const subs = att.subattachments ?? [];
      if (subs.length) {
        for (const s of subs) {
          if (s.url) media.push({ url: s.url, isVideo: this.isVideoType(s.type) });
        }
      } else if (att.url) {
        media.push({ url: att.url, isVideo: this.isVideoType(att.type) });
      }
    }

    /* ⚠️ Линк пост — attachment нь `share`/`link` төрөл. Preview зураг нь
       FB-ийн үүсгэсэн бөгөөд IG-д нийтлэх нь зохисгүй (линк дарагдахгүй,
       зураг нь өөр сайтынх). Зориуд алгасна. */
    const isLink = post.attachments.some((a) =>
      ['share', 'link', 'video_inline'].includes(a.type.toLowerCase()),
    );

    if (!media.length) {
      return {
        kind: isLink ? 'LINK' : 'TEXT',
        canTransfer: false,
        reason: isLink
          ? 'Холбоос хуваалцсан пост — Instagram линк постыг дэмждэггүй'
          : 'Зөвхөн текст — Instagram зураг/видеогүй пост нийтлэхийг зөвшөөрдөггүй',
        mediaUrls: [],
      };
    }

    const videos = media.filter((m) => m.isVideo);
    const images = media.filter((m) => !m.isVideo);

    /* Видео — Reels болно (нэг видео л) */
    if (videos.length) {
      if (videos.length > 1 || images.length) {
        /* ⚠️ Холимог (видео+зураг) carousel-ыг IG дэмждэг ч найдваргүй
           тул эхний видеог л Reels болгоно — админд ил хэлнэ */
        return {
          kind: 'VIDEO',
          canTransfer: true,
          reason: 'Олон медиатай — зөвхөн эхний видео Reels болж орно',
          mediaUrls: [videos[0].url],
        };
      }
      return { kind: 'VIDEO', canTransfer: true, mediaUrls: [videos[0].url] };
    }

    /* Олон зураг — Carousel */
    if (images.length > 1) {
      const urls = images.slice(0, MAX_CAROUSEL).map((m) => m.url);
      return {
        kind: 'CAROUSEL',
        canTransfer: true,
        ...(images.length > MAX_CAROUSEL
          ? { reason: `${images.length} зурагтай — Instagram эхний ${MAX_CAROUSEL}-г л авна` }
          : {}),
        mediaUrls: urls,
      };
    }

    return { kind: 'IMAGE', canTransfer: true, mediaUrls: [images[0].url] };
  }

  private isVideoType(type: string): boolean {
    const t = type.toLowerCase();
    return t.includes('video') || t === 'reel';
  }

  /**
   * Caption бэлдэнэ — IG-ийн 2200 тэмдэгтийн хязгаарт багтаана.
   *
   * ⚠️ Дундуур тасалбал үг таслагдаж утгагүй болно. Тиймээс сүүлийн
   * бүтэн үгээр таслаад «…» нэмнэ.
   */
  buildCaption(message: string): string {
    const clean = (message ?? '').trim();
    if (clean.length <= MAX_CAPTION) return clean;
    const cut = clean.slice(0, MAX_CAPTION - 1);
    const lastSpace = cut.lastIndexOf(' ');
    return `${lastSpace > MAX_CAPTION * 0.8 ? cut.slice(0, lastSpace) : cut}…`;
  }

  // ─── Медиа хуулах ─────────────────────────────────────────────────────────

  /**
   * FB CDN-ээс татаж R2 руу хуулна → ОЛОН НИЙТЭД нээлттэй URL буцаана.
   *
   * ⚠️⚠️ ЯАГААД ШУУД FB URL ӨГӨХГҮЙ ВЭ: Instagram нь `image_url`-ийг
   * ӨӨРИЙН сервэрээсээ татдаг. Facebook-ийн CDN нь хугацаатай токен
   * агуулсан, эрхийн шалгалттай тул Meta-гийн нийтлэлийн систем ч
   * заримдаа татаж чаддаггүй (алдаа нь тодорхойгүй, дахин
   * давтагддаггүй тул оношлоход хэцүү).
   *
   * R2 руу хуулснаар: найдвартай, `assets.besttv.us` домэйнтэй,
   * хугацаа дуусахгүй.
   */
  /**
   * ⚠️⚠️ ХУУЧИН FB ПОСТЫГ ТОВЛОГЧ РУУ ИМПОРТЛОХ.
   *
   * ЯАГААД ХЭРЭГТЭЙ ВЭ: «FB → Instagram» хэсэг нь ЗӨВХӨН IG руу
   * шилжүүлдэг — FB руу дахин нийтлэхгүй, товлохгүй. Админ хуучин
   * амжилттай постоо дахин эргэлдүүлэх боломжгүй байв.
   *
   * ⚠️⚠️ МЕДИАГ ЗААВАЛ R2 РУУ ТАТНА, Meta-гийн URL-ыг ХАДГАЛАХГҮЙ.
   * Meta-гийн CDN хаяг нь ХУГАЦААТАЙ (хэдэн цагийн дараа 403 болно).
   * Хэрэв шууд хадгалбал 3 хоногийн дараа товлосон пост «медиа
   * татагдсангүй» гэж УНАНА — админ шалтгааныг нь ойлгохгүй.
   *
   * @returns Товлогчийн `upsert`-д шууд өгөх боломжтой өгөгдөл
   */
  async importToScheduler(fbPostId: string): Promise<{
    body: string;
    mediaKeys: string[];
    kind: string;
    /** ⚠️ UI-д харуулах: хэдэн медиа, хэдэн МБ, хэд нь унасан */
    mediaTotal: number;
    mediaFailed: number;
    bytes: number;
    isVideo: boolean;
  }> {
    if (!this.meta.isConfigured()) {
      throw new BadRequestException('Facebook токен тохируулаагүй байна');
    }

    const post = await this.meta.fetchPost(fbPostId);
    if (!post) throw new NotFoundException('Facebook пост олдсонгүй');

    const cls = this.classify(post);
    const isVideo = cls.kind === 'VIDEO';

    /**
     * ⚠️ Медиагүй (TEXT/LINK) постыг ч ИМПОРТЛОНО — товлогч нь FB-д
     * текст пост зөвшөөрдөг. IG-д зөвшөөрөхгүй ч тэр нь товлогчийн
     * валидаци барих асуудал, энд таслах шаардлагагүй.
     */
    const mediaKeys: string[] = [];
    let mediaFailed = 0;
    let bytes = 0;

    for (const url of cls.mediaUrls) {
      try {
        /* ⚠️ Хэмжээг ТАТАХ үедээ тоолно — R2 руу нэмэлт дуудлага
           хийхгүй (`headObject` шаардлагагүй) */
        const { key, bytes: got } = await this.mirrorToR2(url, isVideo);
        mediaKeys.push(key);
        bytes += got;
      } catch (e) {
        mediaFailed++;
        /* ⚠️ Нэг зураг унасан ч бусдыг үргэлжлүүлнэ — хэсэгчилсэн
           импорт нь огт импортлохгүйгээс дээр */
        this.logger.warn(`Медиа татаж чадсангүй (${fbPostId}): ${String(e).slice(0, 120)}`);
      }
    }

    return {
      body: post.message ?? '',
      mediaKeys,
      kind: cls.kind,
      mediaTotal: cls.mediaUrls.length,
      mediaFailed,
      bytes,
      isVideo,
    };
  }

  private async mirrorToR2(
    url: string,
    isVideo: boolean,
  ): Promise<{ key: string; bytes: number }> {
    /* ⚠️ SSRF — зөвхөн Meta-гийн CDN. `chat.service.ts`-тэй ижил зарчим */
    let host: string;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      throw new Error('Медиа хаяг буруу байна');
    }
    if (!ALLOWED_HOSTS.some((d) => host === d || host.endsWith(`.${d}`))) {
      throw new Error(`Зөвшөөрөгдөөгүй медиа сервер: ${host}`);
    }

    const res = await fetch(url, {
      /* Том видео татахад хугацаа хэрэгтэй */
      signal: AbortSignal.timeout(isVideo ? 180_000 : 45_000),
    });
    if (!res.ok) throw new Error(`Медиаг татаж чадсангүй (HTTP ${res.status})`);

    const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > limit) {
      throw new Error(
        `Медиа хэт том (${Math.round(declared / 1024 / 1024)}MB). ` +
          `Instagram-ийн хязгаар ${Math.round(limit / 1024 / 1024)}MB.`,
      );
    }

    const buf = Buffer.from(await res.arrayBuffer());
    /* ⚠️ `content-length` худал байж болно — бодит хэмжээг ДАХИН шалгана */
    if (buf.length > limit) {
      throw new Error(
        `Медиа хэт том (${Math.round(buf.length / 1024 / 1024)}MB). ` +
          `Instagram-ийн хязгаар ${Math.round(limit / 1024 / 1024)}MB.`,
      );
    }

    const ct = res.headers.get('content-type') ?? (isVideo ? 'video/mp4' : 'image/jpeg');
    /**
     * ⚠️⚠️ WebP-Д ХӨРВҮҮЛЭХГҮЙ. Төслийн `uploadImage()` нь бүх зургийг
     * WebP болгодог — гэтэл Instagram WebP-г ТАТДАГГҮЙ. Тиймээс FB-ээс
     * ирсэн JPEG-ийг ХЭВЭЭР нь хадгална.
     */
    const ext = isVideo ? 'mp4' : ct.includes('png') ? 'png' : 'jpg';
    const key = `crosspost/${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;

    await this.storage.upload(key, buf, ct);
    return { key, bytes: buf.length };
  }

  // ─── Нийтлэх ──────────────────────────────────────────────────────────────

  /**
   * Нэг постыг Instagram руу шилжүүлнэ.
   *
   * ⚠️ Энэ функц УДААН (видео 1-5 минут) тул дараалалаас дуудагдана.
   */
  async publishOne(crosspostId: string): Promise<void> {
    const row = await this.prisma.socialCrosspost.findUnique({ where: { id: crosspostId } });
    if (!row) throw new NotFoundException('Бүртгэл олдсонгүй');
    if (row.status === CrosspostStatus.PUBLISHED) {
      this.logger.warn(`Аль хэдийн нийтлэгдсэн — алгаслаа (${crosspostId})`);
      return;
    }

    await this.prisma.socialCrosspost.update({
      where: { id: crosspostId },
      data: { status: CrosspostStatus.PROCESSING, attempts: { increment: 1 }, error: null },
    });

    const keys: string[] = [];
    try {
      if (!this.meta.isIgConfigured()) {
        throw new Error(
          'Instagram холболт тохируулаагүй байна (IG_USER_ID эсвэл FB_PAGE_ACCESS_TOKEN дутуу)',
        );
      }

      /* ⚠️ FB постыг ДАХИН татна — хуучин хаяг хугацаа дууссан байж болно */
      const post = await this.meta.fetchPost(row.fbPostId);
      const cls = this.classify(post);
      if (!cls.canTransfer) throw new Error(cls.reason ?? 'Шилжүүлэх боломжгүй');

      const caption = row.caption ?? this.buildCaption(post.message);
      const isVideo = cls.kind === 'VIDEO';

      /* 1) Медиаг R2 руу толидуулна */
      const publicUrls: string[] = [];
      for (const url of cls.mediaUrls) {
        const { key } = await this.mirrorToR2(url, isVideo);
        keys.push(key);
        publicUrls.push(await this.storage.publicAssetUrl(key, 24 * 3600));
      }

      /* 2) IG контейнер үүсгэнэ */
      let containerId: string;
      if (cls.kind === 'CAROUSEL') {
        const childIds: string[] = [];
        for (const u of publicUrls) {
          const cid = await this.meta.createContainer({ imageUrl: u, isCarouselItem: true });
          childIds.push(cid);
        }
        containerId = await this.meta.createCarouselContainer(childIds, caption);
      } else if (isVideo) {
        containerId = await this.meta.createContainer({ videoUrl: publicUrls[0], caption });
      } else {
        containerId = await this.meta.createContainer({ imageUrl: publicUrls[0], caption });
      }

      /* 3) Боловсруулж дуустал хүлээнэ (видеонд ЗААВАЛ) */
      await this.meta.waitForContainer(containerId);

      /* 4) Нийтэлнэ */
      const igMediaId = await this.meta.publishContainer(containerId);

      await this.prisma.socialCrosspost.update({
        where: { id: crosspostId },
        data: {
          status: CrosspostStatus.PUBLISHED,
          igMediaId,
          caption,
          mediaKeys: keys,
          publishedAt: new Date(),
          error: null,
        },
      });
      this.logger.log(`IG-д нийтлэв: fb=${row.fbPostId} ig=${igMediaId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      /**
       * ⚠️ Амжилтгүй болсон медиаг R2-оос ЦЭВЭРЛЭНЭ — эс бөгөөс
       * дахин оролдох бүрд шинэ хуулбар үлдэж, хадгалалтын төлбөр
       * дэмий өснө.
       */
      for (const k of keys) {
        await this.storage.delete(k).catch(() => null);
      }
      await this.prisma.socialCrosspost.update({
        where: { id: crosspostId },
        data: { status: CrosspostStatus.FAILED, error: msg, mediaKeys: [] },
      });
      this.logger.error(`IG нийтлэл амжилтгүй (fb=${row.fbPostId}): ${msg}`);
      throw e;
    }
  }

  // ─── Админд зориулсан үйлдлүүд ────────────────────────────────────────────

  /**
   * FB постуудыг татаж, шилжүүлэлтийн төлөвтэй нь ХАМТ буцаана.
   *
   * ⚠️ Аль пост нь аль хэдийн орсныг ЗААВАЛ харуулна — админ давхар
   * нийтлэхийг оролдохгүй.
   */
  async listPosts(limit = 25, after?: string) {
    if (!this.meta.isConfigured()) {
      throw new BadRequestException('Facebook токен тохируулаагүй байна');
    }

    const { posts, next } = await this.meta.fetchPosts(limit, after);
    const ids = posts.map((p) => p.id);
    const existing = await this.prisma.socialCrosspost.findMany({
      where: { fbPostId: { in: ids } },
    });
    const byId = new Map(existing.map((e) => [e.fbPostId, e]));

    return {
      items: posts.map((p) => {
        const cls = this.classify(p);
        const rec = byId.get(p.id);
        return {
          fbPostId: p.id,
          message: p.message,
          preview: p.previewUrl,
          permalink: p.permalink,
          postedAt: p.createdTime,
          kind: cls.kind,
          canTransfer: cls.canTransfer,
          reason: cls.reason ?? null,
          mediaCount: cls.mediaUrls.length,
          /* Аль хэдийн шилжүүлсэн бол төлөв нь */
          status: rec?.status ?? null,
          crosspostId: rec?.id ?? null,
          igMediaId: rec?.igMediaId ?? null,
          error: rec?.error ?? null,
        };
      }),
      next,
    };
  }

  /**
   * Постуудыг дараалалд оруулна.
   *
   * ⚠️⚠️ `upsert` — нэг постыг хоёр удаа оруулбал шинэ мөр үүсэхгүй,
   * хуучныг нь дахин оролдоно. `fbPostId @unique` нь DB талын хамгаалалт.
   */
  async enqueue(fbPostIds: string[], captions?: Record<string, string>) {
    if (!fbPostIds.length) throw new BadRequestException('Пост сонгоогүй байна');
    if (fbPostIds.length > 50) {
      throw new BadRequestException('Нэг удаад 50 хүртэл пост сонгоно уу');
    }

    const created: string[] = [];
    const skipped: { fbPostId: string; reason: string }[] = [];

    for (const fbPostId of fbPostIds) {
      try {
        const post = await this.meta.fetchPost(fbPostId);
        const cls = this.classify(post);

        if (!cls.canTransfer) {
          /* ⚠️ Боломжгүйг ч БҮРТГЭНЭ — админ дараа нь яагаад
             ороогүйг харах ёстой */
          await this.prisma.socialCrosspost.upsert({
            where: { fbPostId },
            create: {
              fbPostId,
              message: post.message,
              fbPostedAt: new Date(post.createdTime),
              kind: cls.kind,
              status: CrosspostStatus.SKIPPED,
              error: cls.reason,
            },
            update: { status: CrosspostStatus.SKIPPED, error: cls.reason },
          });
          skipped.push({ fbPostId, reason: cls.reason ?? 'Боломжгүй' });
          continue;
        }

        const row = await this.prisma.socialCrosspost.upsert({
          where: { fbPostId },
          create: {
            fbPostId,
            message: post.message,
            fbPostedAt: new Date(post.createdTime),
            kind: cls.kind,
            status: CrosspostStatus.QUEUED,
            caption: captions?.[fbPostId] ?? this.buildCaption(post.message),
          },
          update: {
            status: CrosspostStatus.QUEUED,
            error: null,
            ...(captions?.[fbPostId] ? { caption: captions[fbPostId] } : {}),
          },
        });

        /* Аль хэдийн нийтлэгдсэнийг ДАХИН дараалалд оруулахгүй */
        if (row.status === CrosspostStatus.PUBLISHED) {
          skipped.push({ fbPostId, reason: 'Аль хэдийн Instagram-д нийтлэгдсэн' });
          continue;
        }
        created.push(row.id);
      } catch (e) {
        skipped.push({ fbPostId, reason: e instanceof Error ? e.message : String(e) });
      }
    }

    return { queued: created, skipped };
  }

  /** Шилжүүлэлтийн түүх */
  async history(params: { status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));

    const where =
      params.status && params.status !== 'ALL'
        ? { status: params.status as CrosspostStatus }
        : {};

    const [items, total, counts] = await Promise.all([
      this.prisma.socialCrosspost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.socialCrosspost.count({ where }),
      this.prisma.socialCrosspost.groupBy({ by: ['status'], _count: true }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: Object.fromEntries(counts.map((c) => [c.status, c._count])),
    };
  }

  /** Дараалалд хүлээж буй ажлууд (worker татна) */
  async claimNext(): Promise<string | null> {
    /**
     * ⚠️ АТОМИК ЗАХИАЛГА — `updateMany` нь нөхцөл хангасан мөрийг
     * барьж авна. Хоёр worker зэрэг ажиллавал зөвхөн нэг нь авна.
     */
    const row = await this.prisma.socialCrosspost.findFirst({
      where: { status: CrosspostStatus.QUEUED, attempts: { lt: 3 } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!row) return null;

    const claimed = await this.prisma.socialCrosspost.updateMany({
      where: { id: row.id, status: CrosspostStatus.QUEUED },
      data: { status: CrosspostStatus.PROCESSING },
    });
    return claimed.count > 0 ? row.id : null;
  }
}
