import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface TrackContext {
  userId?: string | null;
  sessionId?: string | null;
  device?: string | null;
  ip?: string | null;
}

/**
 * Tracking — хэрэглэгчийн зан төлөвийг бүртгэнэ (хуудас, кино, хайлт).
 *
 * ⚠️ ЗАРЧИМ: tracking нь ХЭЗЭЭ Ч үндсэн урсгалыг унагаахгүй. Бүх бичилт
 * try/catch дотор — DB алдаа гарсан ч хэрэглэгч кино үзсээр байна.
 */
@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** User-Agent-аас төхөөрөмжийн төрөл таана */
  static deviceFromUa(ua?: string): string {
    if (!ua) return 'unknown';
    const s = ua.toLowerCase();
    if (/ipad|tablet|playbook|silk/.test(s)) return 'tablet';
    if (/mobi|iphone|android|phone/.test(s)) return 'mobile';
    return 'desktop';
  }

  /** Алдааг залгиж, зөвхөн лог үлдээнэ (fail-open) */
  private async safe(op: () => Promise<unknown>, what: string) {
    try {
      await op();
    } catch (err) {
      this.logger.warn(`Tracking бичилт амжилтгүй (${what}): ${(err as Error).message}`);
    }
  }

  async pageView(path: string, ctx: TrackContext, referrer?: string) {
    if (!path || path.length > 500) return;
    await this.safe(
      () =>
        this.prisma.pageView.create({
          data: {
            path,
            referrer: referrer?.slice(0, 500) ?? null,
            userId: ctx.userId ?? null,
            sessionId: ctx.sessionId ?? null,
            device: ctx.device ?? null,
          },
        }),
      'pageView',
    );
  }

  async titleEvent(
    data: {
      type: string;
      titleId: string;
      titleSlug?: string;
      titleName?: string;
      episodeId?: string;
      positionSec?: number;
      durationSec?: number;
    },
    ctx: TrackContext,
  ) {
    if (!data.titleId || !data.type) return;
    await this.safe(
      () =>
        this.prisma.titleEvent.create({
          data: {
            type: data.type,
            titleId: data.titleId,
            titleSlug: data.titleSlug ?? null,
            titleName: data.titleName ?? null,
            episodeId: data.episodeId ?? null,
            positionSec: data.positionSec ?? null,
            durationSec: data.durationSec ?? null,
            userId: ctx.userId ?? null,
            sessionId: ctx.sessionId ?? null,
            device: ctx.device ?? null,
          },
        }),
      'titleEvent',
    );
  }

  async searchEvent(query: string, results: number, ctx: TrackContext) {
    const q = query?.trim();
    if (!q || q.length > 200) return;
    await this.safe(
      () =>
        this.prisma.searchEvent.create({
          data: {
            query: q,
            results,
            userId: ctx.userId ?? null,
            sessionId: ctx.sessionId ?? null,
          },
        }),
      'searchEvent',
    );
  }

  /** Аккаунтын өөрчлөлт/нэвтрэлтийн түүх */
  async audit(
    userId: string,
    field: string,
    opts: {
      oldValue?: string | null;
      newValue?: string | null;
      actor?: 'self' | 'admin' | 'system';
      actorId?: string;
      ip?: string | null;
    } = {},
  ) {
    if (!userId) return;
    await this.safe(
      () =>
        this.prisma.userAuditLog.create({
          data: {
            userId,
            field,
            oldValue: opts.oldValue ?? null,
            newValue: opts.newValue ?? null,
            actor: opts.actor ?? 'self',
            actorId: opts.actorId ?? null,
            ip: opts.ip ?? null,
          },
        }),
      'audit',
    );
  }

  // ─── Админ: нэг хэрэглэгчийн бүрэн insight ────────────────────────────────

  async userInsight(userId: string) {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      watchProgress,
      recentTitleEvents,
      topPages,
      recentPages,
      searches,
      auditLogs,
      pageViewCount,
      titleEventCount,
    ] = await Promise.all([
      // Одоо үзэж байгаа / сүүлд үзсэн
      this.prisma.watchProgress.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          title: { select: { id: true, title: true, slug: true, posterKey: true, type: true } },
          episode: { select: { id: true, number: true, name: true } },
        },
      }),
      // Кино дээрх сүүлийн үйлдлүүд
      this.prisma.titleEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      // Хамгийн их зочилсон хуудсууд
      this.prisma.pageView.groupBy({
        by: ['path'],
        where: { userId, createdAt: { gte: since30d } },
        _count: { path: true },
        orderBy: { _count: { path: 'desc' } },
        take: 15,
      }),
      // Сүүлд зочилсон хуудсууд (цагийн дараалалаар)
      this.prisma.pageView.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: { path: true, device: true, referrer: true, createdAt: true },
      }),
      this.prisma.searchEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { query: true, results: true, createdAt: true },
      }),
      this.prisma.userAuditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      this.prisma.pageView.count({ where: { userId } }),
      this.prisma.titleEvent.count({ where: { userId } }),
    ]);

    // Нийт үзсэн хугацаа (watchProgress-ийн байрлалуудын нийлбэр — ойролцоо)
    const totalWatchSec = watchProgress.reduce((s, w) => s + (w.positionSec ?? 0), 0);
    const completed = watchProgress.filter(
      (w) => w.durationSec > 0 && w.positionSec / w.durationSec >= 0.9,
    ).length;

    // Хамгийн сүүлийн идэвх
    const lastActive =
      recentPages[0]?.createdAt ??
      recentTitleEvents[0]?.createdAt ??
      watchProgress[0]?.updatedAt ??
      null;

    return {
      summary: {
        totalWatchSec,
        titlesStarted: watchProgress.length,
        titlesCompleted: completed,
        pageViewCount,
        titleEventCount,
        searchCount: searches.length,
        lastActive,
      },
      watching: watchProgress.map((w) => ({
        titleId: w.title.id,
        title: w.title.title,
        slug: w.title.slug,
        posterKey: w.title.posterKey,
        type: w.title.type,
        episode: w.episode ? { number: w.episode.number, name: w.episode.name } : null,
        positionSec: w.positionSec,
        durationSec: w.durationSec,
        percent: w.durationSec > 0 ? Math.round((w.positionSec / w.durationSec) * 100) : 0,
        updatedAt: w.updatedAt,
      })),
      titleEvents: recentTitleEvents,
      topPages: topPages.map((p) => ({ path: p.path, count: p._count.path })),
      recentPages,
      searches,
      auditLogs,
    };
  }
}
