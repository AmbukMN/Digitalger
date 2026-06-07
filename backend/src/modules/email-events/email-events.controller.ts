import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';

// 1×1 透明 GIF (tracking pixel) — base64-аас нэг удаа decode хийж кэшилнэ.
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

@Controller('email')
export class EmailEventsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /**
   * Имэйл нээлт хянах pixel.
   * GET /api/email/open?c=campaign&e=email&r=refId
   *
   * ⚠️ Имэйл client олон удаа дуудна (нээх болгонд) тул throttle ӨНДӨР.
   * ⚠️ ЯМАР Ч АЛДАА гарсан байсан pixel-ийг ЗААВАЛ буцаана (имэйл client эвдрэхгүй).
   */
  @SkipThrottle()
  @Get('open')
  async open(
    @Query('c') campaign: string,
    @Query('e') email: string,
    @Query('r') refId: string | undefined,
    @Res() res: Response,
  ) {
    // Бичих ажил pixel хариуг хойшлуулахгүй — fire-and-forget.
    if (campaign && email) {
      this.prisma.emailOpen
        .create({
          data: {
            email,
            campaign,
            refId: refId || null,
          },
        })
        .catch(() => null);

      this.email.recordEmailOpen(campaign, email, refId || undefined).catch(() => null);
    }

    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL_GIF.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.end(PIXEL_GIF);
  }

  /**
   * Marketing имэйлээс гарах (unsubscribe).
   * POST /api/email/unsubscribe { email }
   *
   * - User.marketingOptOut = true (transactional имэйл ҮРГЭЛЖИЛНЭ)
   * - Subscriber.status = UNSUBSCRIBED
   * - Идемпотент: дахин дарж болно (updateMany 0 row ч алдаа гаргахгүй).
   */
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('unsubscribe')
  async unsubscribe(@Body('email') email?: string) {
    const clean = (email ?? '').trim().toLowerCase();
    if (!clean) return { success: true };

    try {
      await Promise.all([
        this.prisma.user.updateMany({
          where: { email: clean },
          data: { marketingOptOut: true },
        }),
        this.prisma.subscriber.updateMany({
          where: { email: clean },
          data: { status: 'UNSUBSCRIBED' },
        }),
      ]);
    } catch {
      // Идемпотент — алдаа гарсан ч success буцаана (давхар дарахад асуудалгүй).
    }

    return { success: true };
  }
}
