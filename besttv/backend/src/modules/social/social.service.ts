import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  SocialChannel,
  SocialPostStatus,
  SocialScheduleKind,
  SocialTargetStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { MetaGraphService } from '../crosspost/meta-graph.service';
import { validatePost, type ValidationIssue } from './social-validate';
import { nextFreeSlot, reassignSlots, type SlotDef } from './social-slots';

/** Видео эсэхийг key-ээс таана */
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly meta: MetaGraphService,
  ) {}

  // ─── Тусламж ────────────────────────────────────────────────────────────

  private hasVideo(mediaKeys: string[]): boolean {
    return mediaKeys.some((k) => VIDEO_EXT.test(k));
  }

  /** Тодорхойлсон slot-ууд (суваг тус бүрээр) */
  private async slotsFor(channel: SocialChannel): Promise<SlotDef[]> {
    const rows = await this.prisma.socialSlot.findMany({
      where: { channel },
      select: { weekday: true, time: true },
    });
    return rows.map((r) => ({ weekday: r.weekday, time: r.time }));
  }

  /**
   * ⚠️ Аль хэдийн ЭЗЛЭГДСЭН цагууд — давхцлаас сэргийлнэ.
   * Хоёр пост нэг цагт таарвал IG-ийн rate limit-д ойртоно.
   */
  private async takenSlots(channel: SocialChannel): Promise<Date[]> {
    const rows = await this.prisma.socialPost.findMany({
      where: {
        status: SocialPostStatus.SCHEDULED,
        scheduledAt: { not: null, gte: new Date() },
        /**
         * ⚠️ ЗӨВХӨН тухайн сувгийн постууд. Өмнө нь БҮХ постыг
         * тоолдог байсан тул FB болон IG-д ӨӨР хуваарь тавибал
         * IG-ийн пост FB-ийн slot-ыг «эзэлдэг» байв.
         */
        targets: { some: { channel } },
      },
      select: { scheduledAt: true },
    });
    return rows.map((r) => r.scheduledAt!).filter(Boolean);
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────

  /**
   * Пост үүсгэх/засах.
   *
   * ⚠️ Валидацийг ЭНД хийнэ — `block` түвшний асуудал байвал
   * хадгалахыг зөвшөөрөх ч ТОВЛОХГҮЙ (draft хэвээр). Ингэснээр
   * админ ажлаа алдахгүй, гэхдээ эвдэрсэн пост шөнө дунд унахгүй.
   */
  async upsert(params: {
    id?: string;
    body: string;
    mediaKeys: string[];
    channels: SocialChannel[];
    captions?: Partial<Record<SocialChannel, string>>;
    titleId?: string | null;
    recycle?: {
      gap?: number;
      freq?: string;
      expireCount?: number;
      done?: number;
      weekday?: number;
      time?: string;
    } | null;
    createdById?: string;
  }) {
    const { body, mediaKeys, channels, captions = {}, titleId, recycle, createdById } = params;

    if (!channels.length) throw new BadRequestException('Дор хаяж нэг суваг сонгоно уу');

    const issues = validatePost({
      channels,
      captions,
      body,
      mediaCount: mediaKeys.length,
      hasVideo: this.hasVideo(mediaKeys),
    });

    const data = {
      body,
      mediaKeys,
      titleId: titleId ?? null,
      /**
       * ⚠️ `recycle` талбар ИРСЭН үед л хөндөнө. `undefined` бол
       * хуучин утга хэвээр (засварлахад давталтын тохиргоо алдагдахгүй),
       * `null` бол ЗОРИУД унтраасан.
       */
      ...(recycle !== undefined
        ? { recycle: recycle === null ? Prisma.DbNull : (recycle as Prisma.InputJsonValue) }
        : {}),
      ...(createdById ? { createdById } : {}),
    };

    const post = params.id
      ? await this.prisma.socialPost.update({ where: { id: params.id }, data })
      : await this.prisma.socialPost.create({ data });

    /**
     * ⚠️ Target-уудыг ДАХИН БҮТЭЭНЭ (суваг нэмэгдэж/хасагдаж болно).
     * Аль хэдийн НИЙТЛЭГДСЭН target-ыг ХӨНДӨХГҮЙ — түүх алдагдах ёсгүй.
     */
    const existing = await this.prisma.socialPostTarget.findMany({
      where: { postId: post.id },
    });
    const published = new Set(
      existing
        .filter((t) => t.status === SocialTargetStatus.PUBLISHED)
        .map((t) => t.channel),
    );

    await this.prisma.socialPostTarget.deleteMany({
      where: { postId: post.id, status: { not: SocialTargetStatus.PUBLISHED } },
    });

    for (const ch of channels) {
      if (published.has(ch)) continue;
      await this.prisma.socialPostTarget.create({
        data: { postId: post.id, channel: ch, caption: captions[ch] ?? null },
      });
    }

    return { post, issues };
  }

  /**
   * ТОВЛОХ — тодорхой цаг эсвэл дараагийн сул slot.
   *
   * ⚠️⚠️ `block` түвшний валидацийн асуудал байвал ТАТГАЛЗАНА.
   * Энэ бол сүүлчийн хамгаалалт: эвдэрсэн пост товлогдвол шөнө
   * дунд чимээгүй унаж, админ өглөө нь мэдэх болно.
   */
  async schedule(params: {
    postId: string;
    /** `null` = дараагийн сул slot (NEXT_AVAILABLE) */
    at: Date | null;
  }) {
    const post = await this.prisma.socialPost.findUnique({
      where: { id: params.postId },
      include: { targets: true },
    });
    if (!post) throw new NotFoundException('Пост олдсонгүй');

    const channels = post.targets.map((t) => t.channel);
    const captions: Partial<Record<SocialChannel, string>> = {};
    for (const t of post.targets) if (t.caption) captions[t.channel] = t.caption;

    const issues = validatePost({
      channels,
      captions,
      body: post.body,
      mediaCount: post.mediaKeys.length,
      hasVideo: this.hasVideo(post.mediaKeys),
    });
    const blocking = issues.filter((i) => i.level === 'block');
    if (blocking.length) {
      throw new BadRequestException(
        `Товлох боломжгүй: ${blocking.map((b) => b.message).join(' · ')}`,
      );
    }

    let at = params.at;
    let kind: SocialScheduleKind = SocialScheduleKind.CUSTOM;

    if (!at) {
      /**
       * ⚠️ ТОДОРХОЙ ДЭС ДАРААЛАЛ — FACEBOOK давуу.
       *
       * Өмнө нь `channels[0]` байсан нь `findMany`-ийн дараалалаас
       * хамаарч ТОГТВОРГҮЙ байв — ижил постыг дахин товлоход өөр
       * сувгийн хуваарь ашиглагдаж болно.
       */
      const primary = channels.includes(SocialChannel.FACEBOOK)
        ? SocialChannel.FACEBOOK
        : channels[0];
      const slots = await this.slotsFor(primary);
      if (!slots.length) {
        throw new BadRequestException(
          'Хуваарь тодорхойлоогүй байна. Тохиргооноос цаг нэмэх эсвэл огноо сонгоно уу.',
        );
      }
      const free = nextFreeSlot(slots, await this.takenSlots(primary));
      if (!free) {
        throw new BadRequestException(
          'Дараагийн 8 долоо хоногт сул цаг олдсонгүй. Хуваарьт цаг нэмэх эсвэл тодорхой огноо сонгоно уу.',
        );
      }
      at = free;
      kind = SocialScheduleKind.NEXT_AVAILABLE;
    }

    /**
     * ⚠️ FB ӨӨРӨӨ ТОВЛОХ боломжтой (10 мин – 30 хоног). Тэр үед
     * бидний cron нийтлэх шаардлагагүй — Meta автоматаар хийнэ.
     * Гэхдээ IG-д ийм боломж БАЙХГҮЙ.
     */
    const minutesAhead = (at.getTime() - Date.now()) / 60_000;
    const fbNative = minutesAhead >= 10 && minutesAhead <= 30 * 24 * 60;

    await this.prisma.socialPost.update({
      where: { id: post.id },
      data: { status: SocialPostStatus.SCHEDULED, scheduledAt: at, scheduleKind: kind },
    });

    if (fbNative) {
      await this.prisma.socialPostTarget.updateMany({
        where: { postId: post.id, channel: SocialChannel.FACEBOOK },
        data: { fbNativeScheduled: true },
      });
    }

    return { at, kind, issues };
  }

  /**
   * FB-ийн native товлолтыг цуцлана.
   *
   * ⚠️ «Одоо нийтлэх» эсвэл retry үед ЗААВАЛ — өнгөрсөн цагтай
   * `scheduled_publish_time` илгээвэл Meta татгалзана.
   */
  async clearNativeSchedule(postId: string) {
    await this.prisma.socialPostTarget.updateMany({
      where: { postId, fbNativeScheduled: true },
      data: { fbNativeScheduled: false },
    });
  }

  /** Товлолт цуцлах — draft руу буцаана */
  async unschedule(postId: string) {
    const post = await this.prisma.socialPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Пост олдсонгүй');
    if (post.status === SocialPostStatus.PUBLISHED) {
      throw new BadRequestException('Нийтлэгдсэн постыг цуцлах боломжгүй');
    }
    return this.prisma.socialPost.update({
      where: { id: postId },
      data: { status: SocialPostStatus.DRAFT, scheduledAt: null },
    });
  }

  /**
   * ДАХИН НИЙТЛЭХ (repost) — нийтэлсэн постыг ШИНЭ пост болгож хуулна.
   *
   * ⚠️ Анхны постыг ХӨНДӨХГҮЙ — түүх, аналитик хадгалагдана.
   *
   * ⚠️⚠️ ХУУЛБАР нь ЦЭВЭР ЭХЭЛНЭ: `externalId`, `error`, `attempts`,
   * `igContainerId`, `idempotencyKey` зэргийг ХУУЛАХГҮЙ. Эдгээрийг
   * хуулбал Meta-гийн хуучин пост руу заасан хог үлдэж, «аль хэдийн
   * нийтлэгдсэн» гэж андуурч алгасах эрсдэлтэй.
   *
   * @param at  `undefined` = зөвхөн ноорог үүсгэнэ (хуучин зан төлөв)
   *            `null`      = ДАРААГИЙН СУЛ SLOT руу товлоно
   *            `Date`      = ТОДОРХОЙ цагт товлоно
   */
  async duplicate(postId: string, at?: Date | null) {
    const src = await this.prisma.socialPost.findUnique({
      where: { id: postId },
      include: { targets: true },
    });
    if (!src) throw new NotFoundException('Пост олдсонгүй');
    if (!src.targets.length) {
      throw new BadRequestException('Суваггүй постыг дахин нийтлэх боломжгүй');
    }

    const copy = await this.prisma.socialPost.create({
      data: {
        body: src.body,
        mediaKeys: src.mediaKeys,
        titleId: src.titleId,
        createdById: src.createdById,
      },
    });

    for (const t of src.targets) {
      /* ⚠️ ЗӨВХӨН агуулга — төлөвийн талбарууд анхны утгаараа */
      await this.prisma.socialPostTarget.create({
        data: { postId: copy.id, channel: t.channel, caption: t.caption },
      });
    }

    /* Зөвхөн ноорог хүсвэл энд дуусна */
    if (at === undefined) return { post: copy, scheduled: null };

    /**
     * ⚠️ Товлолт УНАВАЛ хуулбарыг УСТГАНА. Эс бөгөөс админд «дахин
     * товлолоо» гэж хэлээд бодит байдалд товлогдоогүй ноорог үлдэнэ.
     */
    try {
      const scheduled = await this.schedule({ postId: copy.id, at });
      /* ⚠️ `post` нь ҮРГЭЛЖ хуулбарын мөр — дуудагч тал `id`-г
         найдвартай авна (schedule нь өөр бүтэц буцаадаг) */
      return { post: copy, scheduled };
    } catch (e) {
      await this.prisma.socialPost.delete({ where: { id: copy.id } }).catch(() => null);
      throw e;
    }
  }

  /**
   * ⚠️⚠️ ОЛОН ЦАГТ ДАХИН НИЙТЛЭХ (bulk repost).
   *
   * ЯАГААД ХУУЛБАР ҮҮСГЭДЭГ ВЭ: нэг `SocialPost` нь НЭГ `scheduledAt`-
   * тай. Нэг мөрийг олон цагт товлох боломжгүй — товлолт бүр өөрийн
   * төлөв (нийтлэгдсэн/унасан), Meta-гийн ID, алдааны мессежтэй байх
   * ЁСТОЙ. Тиймээс товлолт бүрд бие даасан хуулбар үүсгэнэ (Buffer,
   * Publer, Hootsuite бүгд ийм загвартай).
   *
   * ⚠️ ХЭСЭГЧИЛСЭН АМЖИЛТ: нэг огноо унавал бусдыг ЗОГСООХГҮЙ.
   * Админд аль нь болж, аль нь болоогүйг ТОДОРХОЙ хэлнэ.
   *
   * @param at  Тодорхой огноонууд. Хоосон бол `count` ширхэг
   *            дараагийн сул slot руу дараалуулна.
   */
  async repostMany(params: {
    postId: string;
    at?: Date[];
    count?: number;
  }): Promise<{
    created: { id: string; at: Date | null }[];
    failed: { at: string | null; why: string }[];
  }> {
    const { postId, at = [], count = 0 } = params;

    if (!at.length && count <= 0) {
      throw new BadRequestException('Огноо эсвэл тоо заана уу');
    }
    /* ⚠️ Дээд хязгаар — санамсаргүй 500 хуулбараас хамгаална */
    if (at.length > 20 || count > 20) {
      throw new BadRequestException('Нэг удаад дээд тал нь 20 товлолт');
    }

    /* ⚠️ ӨНГӨРСӨН огноог урьдчилан таслана — cron нь шууд илгээх
       гэж оролдоод FB-гийн «10 мин – 30 хоног» алдаанд унана */
    const now = Date.now();
    const past = at.filter((d) => d.getTime() <= now);
    if (past.length) {
      throw new BadRequestException(
        `${past.length} огноо өнгөрсөн байна — ирээдүйн цаг сонгоно уу`,
      );
    }

    /* ⚠️ Ижил огноог хоёр удаа өгвөл нэгийг нь хаяна — эс бөгөөс
       нэг цагт хоёр ижил пост явна */
    const uniq = [...new Map(at.map((d) => [Math.floor(d.getTime() / 60_000), d])).values()].sort(
      (a, b) => a.getTime() - b.getTime(),
    );

    const created: { id: string; at: Date | null }[] = [];
    const failed: { at: string | null; why: string }[] = [];

    /**
     * ⚠️⚠️ ДАРААЛАН (зэрэг БИШ) — `nextFreeSlot` нь одоо эзлэгдсэн
     * цагуудыг DB-ээс уншдаг. Зэрэг ажиллуулбал хоёр хуулбар ИЖИЛ
     * сул slot-ыг олж давхцана.
     */
    const targets: (Date | null)[] = uniq.length ? uniq : Array.from({ length: count }, () => null);

    for (const when of targets) {
      try {
        const { post } = await this.duplicate(postId, when);
        const row = await this.prisma.socialPost.findUnique({
          where: { id: post.id },
          select: { scheduledAt: true },
        });
        created.push({ id: post.id, at: row?.scheduledAt ?? null });
      } catch (e) {
        failed.push({
          at: when ? when.toISOString() : null,
          why: e instanceof Error ? e.message : String(e),
        });
      }
    }

    this.logger.log(
      `Дахин товлолт: ${postId} → ${created.length} үүсэв, ${failed.length} унав`,
    );
    return { created, failed };
  }

  // ─── Хуваарь (slot) ─────────────────────────────────────────────────────

  async listSlots() {
    return this.prisma.socialSlot.findMany({
      orderBy: [{ channel: 'asc' }, { weekday: 'asc' }, { time: 'asc' }],
    });
  }

  /**
   * Хуваарь солих.
   *
   * ⚠️⚠️ `NEXT_AVAILABLE` постуудыг ДАХИН ХУВААРИЛНА (Buffer-ийн
   * баримтжсан зан төлөв). `CUSTOM` постууд ХӨДӨЛДӨГГҮЙ.
   */
  async setSlots(channel: SocialChannel, slots: SlotDef[]) {
    /* ⚠️ Хуучныг устгаад шинийг үүсгэнэ — хэсэгчилсэн засвар нь
       давхардал үүсгэх эрсдэлтэй (unique constraint) */
    await this.prisma.socialSlot.deleteMany({ where: { channel } });
    for (const s of slots) {
      await this.prisma.socialSlot.create({
        data: { channel, weekday: s.weekday, time: s.time },
      });
    }

    /* Дахин хуваарилах — ДАРААЛЛЫГ хадгална */
    const affected = await this.prisma.socialPost.findMany({
      where: {
        status: SocialPostStatus.SCHEDULED,
        scheduleKind: SocialScheduleKind.NEXT_AVAILABLE,
        scheduledAt: { gte: new Date() },
        targets: { some: { channel } },
      },
      orderBy: { scheduledAt: 'asc' },
      select: { id: true },
    });

    /**
     * ⚠️⚠️ `CUSTOM` постуудын цагийг ХАСНА.
     *
     * Админ Даваа 19:00-д тодорхой цагаар пост товлочихсон бол
     * `NEXT_AVAILABLE` пост ЯГ ТЭР цагт хуваарилагдвал нэг цагт
     * хоёр пост давхцаж, IG-ийн rate limit-д ойртоно.
     */
    const customTaken = await this.prisma.socialPost.findMany({
      where: {
        status: SocialPostStatus.SCHEDULED,
        scheduleKind: SocialScheduleKind.CUSTOM,
        scheduledAt: { gte: new Date() },
        targets: { some: { channel } },
      },
      select: { scheduledAt: true },
    });

    const moved = reassignSlots(
      slots,
      affected.map((p) => p.id),
      new Date(),
      customTaken.map((c) => c.scheduledAt!).filter(Boolean),
    );
    for (const [id, at] of moved) {
      await this.prisma.socialPost.update({ where: { id }, data: { scheduledAt: at } });
    }

    this.logger.log(
      `${channel} хуваарь шинэчлэв: ${slots.length} slot · ${moved.size} пост шилжив`,
    );
    return { slots: slots.length, moved: moved.size };
  }

  // ─── Жагсаалт ───────────────────────────────────────────────────────────

  async list(params: { status?: string; from?: Date; to?: Date; limit?: number }) {
    const where: Prisma.SocialPostWhereInput = {};
    if (params.status === 'ATTENTION') {
      /**
       * ⚠️ `PARTIAL` нь ХАМГИЙН яаралтай (FB болсон, IG болоогүй) —
       * `FAILED`-тэй хамт нэг табд гаргана, эс бөгөөс админ хаана ч
       * харахгүй өнгөрнө.
       */
      where.status = { in: [SocialPostStatus.FAILED, SocialPostStatus.PARTIAL] };
    } else if (params.status && params.status !== 'ALL') {
      where.status = params.status as SocialPostStatus;
    }
    if (params.from || params.to) {
      where.scheduledAt = {
        ...(params.from ? { gte: params.from } : {}),
        ...(params.to ? { lte: params.to } : {}),
      };
    }

    const items = await this.prisma.socialPost.findMany({
      where,
      include: {
        targets: true,
        title: { select: { id: true, title: true, slug: true } },
      },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
      take: Math.min(params.limit ?? 100, 300),
    });

    /* Медиаг харуулахад URL хэрэгтэй */
    return Promise.all(
      items.map(async (p) => ({
        ...p,
        mediaUrls: await Promise.all(
          p.mediaKeys.map((k) => this.storage.publicAssetUrl(k, 7200).catch(() => null)),
        ),
      })),
    );
  }

  async get(id: string) {
    const post = await this.prisma.socialPost.findUnique({
      where: { id },
      include: { targets: true, title: { select: { id: true, title: true, slug: true } } },
    });
    if (!post) throw new NotFoundException('Пост олдсонгүй');
    return {
      ...post,
      mediaUrls: await Promise.all(
        post.mediaKeys.map((k) => this.storage.publicAssetUrl(k, 7200).catch(() => null)),
      ),
    };
  }

  async remove(id: string) {
    const post = await this.prisma.socialPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Пост олдсонгүй');
    /* ⚠️ Target-ууд Cascade-аар хамт устана */
    await this.prisma.socialPost.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Сувгийн тохиргоо ───────────────────────────────────────────────────

  async channelSettings() {
    const rows = await this.prisma.socialChannelSetting.findMany();
    const map: Record<string, boolean> = {};
    for (const c of Object.values(SocialChannel)) {
      map[c] = rows.find((r) => r.channel === c)?.paused ?? false;
    }
    return map;
  }

  /**
   * Суваг түр зогсоох.
   *
   * ⚠️ Buffer-т pause нь суваг тус бүрээр. Товлосон постууд
   * ДАРААЛАЛДАА үлдэнэ — сэргээхэд үргэлжилнэ.
   */
  async setPaused(channel: SocialChannel, paused: boolean) {
    await this.prisma.socialChannelSetting.upsert({
      where: { channel },
      create: { channel, paused },
      update: { paused },
    });
    return { channel, paused };
  }

  // ─── Нийтлэх ────────────────────────────────────────────────────────────

  /**
   * Нийтлэх ажилд бэлдэнэ — `idempotencyKey` олгож түгжинэ.
   *
   * ⚠️⚠️ Meta нь idempotency key ДЭМЖДЭГГҮЙ тул давхардлаас
   * сэргийлэх нь бүхэлдээ бидний хариуцлага. Түлхүүр нь `@unique`
   * тул хоёр процесс зэрэг оролдвол нэг нь л амжилттай болно.
   */
  async claimTarget(targetId: string): Promise<{ ok: boolean; attempts: number }> {
    /**
     * ⚠️⚠️ АТОМИК CAS (compare-and-set) — `updateMany` + төлөвийн шүүлт.
     *
     * БОДИТ АЛДАА: өмнө нь `findUnique` → шалгах → `update` гэсэн
     * ГУРВАН алхам байв. Хоёр процесс зэрэг уншвал ХОЁУЛАА `PENDING`
     * хараад ХОЁУЛАА бичнэ → нэг пост ХОЁР УДАА нийтлэгдэнэ.
     *
     * `idempotencyKey` нь хамгаалахгүй: хоёулаа `null` уншсан тул
     * ХОЁР ӨӨР UUID үүсгэнэ, unique зөрчил гарахгүй.
     *
     * `updateMany` нь НЭГ SQL — `WHERE status IN (...)` нөхцөл DB
     * түвшинд шалгагдана. Хоёр процессын ЗӨВХӨН НЭГ нь `count === 1`
     * авна (нөгөө нь 0), тиймээс давхардал БОЛОМЖГҮЙ.
     */
    const claimed = await this.prisma.socialPostTarget.updateMany({
      where: {
        id: targetId,
        /* ⚠️ PUBLISHING-ыг ОРУУЛАХГҮЙ — өөр процесс ажиллаж байна */
        status: { in: [SocialTargetStatus.PENDING, SocialTargetStatus.FAILED] },
      },
      data: {
        status: SocialTargetStatus.PUBLISHING,
        attempts: { increment: 1 },
        error: null,
      },
    });

    if (claimed.count !== 1) return { ok: false, attempts: 0 };

    /**
     * ⚠️ ШИНЭ `attempts` утгыг УНШИЖ буцаана — дуудагч тал retry
     * хязгаарыг ЗӨВ тооцох ёстой. Өмнө нь локал (хуучин) утга
     * ашиглаж байсан тул 1-ээр хоцорч, бодит хязгаар зөрдөг байв.
     */
    const row = await this.prisma.socialPostTarget.findUnique({
      where: { id: targetId },
      select: { attempts: true, idempotencyKey: true },
    });

    /* Анхны оролдлогод idempotency түлхүүр олгоно */
    if (row && !row.idempotencyKey) {
      await this.prisma.socialPostTarget
        .update({ where: { id: targetId }, data: { idempotencyKey: randomUUID() } })
        .catch(() => null);
    }

    return { ok: true, attempts: row?.attempts ?? 1 };
  }

  /**
   * Постын ЕРӨНХИЙ төлөвийг target-уудаас тооцно.
   *
   * ⚠️ ХЭСЭГЧИЛСЭН амжилтыг ЯЛГАНА (`PARTIAL`) — «FB болсон, IG
   * болоогүй» гэдгийг админ мэдэх ёстой, эс бөгөөс дахин илгээж
   * FB дээр ДАВХАР пост үүсгэнэ.
   */
  async syncPostStatus(postId: string) {
    const targets = await this.prisma.socialPostTarget.findMany({ where: { postId } });
    if (!targets.length) return;

    const done = targets.filter((t) => t.status === SocialTargetStatus.PUBLISHED).length;
    const failed = targets.filter((t) => t.status === SocialTargetStatus.FAILED).length;
    const busy = targets.filter(
      (t) => t.status === SocialTargetStatus.PENDING || t.status === SocialTargetStatus.PUBLISHING,
    ).length;

    let status: SocialPostStatus;
    if (busy > 0) status = SocialPostStatus.PUBLISHING;
    else if (done === targets.length) status = SocialPostStatus.PUBLISHED;
    else if (done > 0) status = SocialPostStatus.PARTIAL;
    else if (failed > 0) status = SocialPostStatus.FAILED;
    /**
     * ⚠️ Бүгд `SKIPPED` — хаана ч нийтлэгдээгүй. Өмнө нь `PUBLISHED`
     * гэж тэмдэглэдэг байсан нь ХУДАЛ: админ «нийтэлсэн» гэж хараад
     * хаана ч байхгүйг дараа мэднэ.
     */
    else status = SocialPostStatus.FAILED;

    await this.prisma.socialPost.update({ where: { id: postId }, data: { status } });
  }

  /** Валидацийн үр дүнг гаднаас дуудахад */
  validate(params: {
    channels: SocialChannel[];
    captions: Partial<Record<SocialChannel, string>>;
    body: string;
    mediaKeys: string[];
  }): ValidationIssue[] {
    return validatePost({
      channels: params.channels,
      captions: params.captions,
      body: params.body,
      mediaCount: params.mediaKeys.length,
      hasVideo: this.hasVideo(params.mediaKeys),
    });
  }

  /** IG квот (24 цагт 100 пост) */
  async quota() {
    return this.meta.publishingLimit();
  }
}
