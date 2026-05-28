import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

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

@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('pageview')
  async trackPageView(
    @Body() body: { path: string; sessionId?: string; referrer?: string },
    @Req() req: Request,
  ) {
    const ua = req.headers['user-agent'] ?? '';
    if (isBot(ua)) return { ok: true };
    const device = detectDevice(ua);
    await this.analyticsService.trackPageView({
      path: body.path,
      sessionId: body.sessionId,
      referrer: body.referrer,
      device,
    });
    return { ok: true };
  }

  @Post('product-event')
  async trackProductEvent(
    @Body() body: { type: string; productId: string; productSlug: string; sessionId?: string },
    @Req() req: Request,
  ) {
    const ua = req.headers['user-agent'] ?? '';
    if (isBot(ua)) return { ok: true };
    await this.analyticsService.trackProductEvent(body);
    return { ok: true };
  }

  @Post('search')
  async trackSearch(
    @Body() body: { query: string; results: number; sessionId?: string },
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
