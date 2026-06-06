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
}
