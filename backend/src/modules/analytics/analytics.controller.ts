import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

function detectDevice(ua: string): string {
  if (/mobile|android|iphone|ipad|tablet/i.test(ua)) {
    if (/tablet|ipad/i.test(ua)) return 'tablet';
    return 'mobile';
  }
  return 'desktop';
}

function isBot(ua: string): boolean {
  return /bot|crawler|spider|googlebot|bingbot|slurp|duckduckbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegram/i.test(ua);
}

@SkipThrottle()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // Public track endpoint — class-ийн @SkipThrottle-ийг override хийж throttle
  // тавина (бот DB дүүргэх DoS-аас сэргийлнэ). 120/мин нэг IP-д хангалттай.
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Post('pageview')
  async trackPageView(
    @Body() body: { path: string; sessionId?: string; referrer?: string; userId?: string },
    @Req() req: Request,
  ) {
    const ua = req.headers['user-agent'] ?? '';
    if (isBot(ua)) return { ok: true };
    const device = detectDevice(ua);
    await this.analyticsService.trackPageView({
      path: body.path,
      sessionId: body.sessionId,
      referrer: body.referrer,
      userId: body.userId,
      device,
    });
    return { ok: true };
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Post('product-event')
  async trackProductEvent(
    @Body()
    body: {
      type: string;
      productId: string;
      productSlug: string;
      sessionId?: string;
      userId?: string;
    },
    @Req() req: Request,
  ) {
    const ua = req.headers['user-agent'] ?? '';
    if (isBot(ua)) return { ok: true };
    const device = detectDevice(ua);
    await this.analyticsService.trackProductEvent({ ...body, device });
    return { ok: true };
  }

  // Хичээлийн видео үзэлтийн event (premium player/watch page дуудна).
  // Public, throttle-той — бот/спам DB дүүргэхээс сэргийлнэ. event утгыг
  // зөвшөөрөгдсөн жагсаалтаар шалгана (хог утга хадгалахгүй).
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Post('lesson')
  async trackLesson(
    @Body()
    body: {
      event: string;
      lessonId: string;
      productId?: string;
      sessionId?: string;
      userId?: string;
      watchedSeconds?: number;
      durationSec?: number;
      playbackSpeed?: number;
      position?: number;
    },
    @Req() req: Request,
  ) {
    const ua = req.headers['user-agent'] ?? '';
    if (isBot(ua)) return { ok: true };
    const allowed = ['lesson_started', 'lesson_completed', 'lesson_progress'];
    if (!body?.lessonId || !allowed.includes(body?.event)) {
      return { ok: true };
    }
    const device = detectDevice(ua);
    await this.analyticsService.trackLessonEvent({ ...body, device });
    return { ok: true };
  }

  // Нэвтрэх агшинд frontend дуудна: тухайн session-ийн зочин үед бичигдсэн (userId-
  // гүй) бүх үзэлт/дарсныг нэвтэрсэн хэрэглэгчид холбоно. userId-ийг token-оос авна
  // (body-оос биш — өөр хэрэглэгчийн event-ийг булаахаас сэргийлж).
  @Post('backfill-session')
  @UseGuards(JwtAuthGuard)
  async backfillSession(
    @Body() body: { sessionId: string },
    @Req() req: Request,
  ) {
    const userId = (req.user as { sub?: string } | undefined)?.sub;
    if (userId && body?.sessionId) {
      await this.analyticsService.backfillSessionEvents(body.sessionId, userId);
    }
    return { ok: true };
  }

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Post('search')
  async trackSearch(
    @Body() body: { query: string; results: number; sessionId?: string; userId?: string },
    @Req() req: Request,
  ) {
    const ua = req.headers['user-agent'] ?? '';
    if (isBot(ua)) return { ok: true };
    await this.analyticsService.trackSearch(body);
    return { ok: true };
  }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getDashboard(@Query('days') days?: string) {
    return this.analyticsService.getDashboardStats(days ? parseInt(days) : 30);
  }

  // Хичээлийн аналитик (курс дуусгалт / lesson dropoff) — admin only.
  @Get('lessons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getLessons(@Query('days') days?: string) {
    return this.analyticsService.getLessonAnalytics(days ? parseInt(days) : 30);
  }

  // Имэйл маркетингийн кампанит ажлуудын нээлтийн статистик — admin only.
  @Get('email')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getEmail(@Query('days') days?: string) {
    return this.analyticsService.getEmailAnalytics(days ? parseInt(days) : 30);
  }

  // Нэг кампанит ажлын хаяг бүрийн илгээлтийн жагсаалт (modal-д) — admin only.
  // ⚠️ Email analytics нь site-level — dashboard-д зөвхөн superadmin-д харагддаг
  // (page.tsx isSuperadmin). Тиймээс @Roles(ADMIN) хэвээр.
  @Get('email/campaign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getEmailCampaign(
    @Query('key') key: string,
    @Query('days') days?: string,
    @Query('page') page?: string,
  ) {
    return this.analyticsService.getCampaignRecipients(
      key ?? 'transactional',
      days ? parseInt(days) : 30,
      page ? parseInt(page) : 1,
    );
  }
}
