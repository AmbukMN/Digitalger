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

  /**
   * ⚠️ ADMIN тест — 5 marketing template-ийг өгсөн имэйл рүү шууд явуулна.
   * Бодит харахад зориулсан. POST /api/email/test-marketing { to, secret }
   * Admin JWT ЭСВЭЛ нэг удаагийн secret token (curl тестэд хялбар).
   */
  @SkipThrottle()
  @Post('test-marketing')
  async testMarketing(@Body('to') to?: string, @Body('secret') secret?: string, @Body('only') only?: string[]) {
    // Энгийн хамгаалалт — зөвхөн энэ secret-тэй хүсэлт зөвшөөрнө (deploy дараа тест).
    if (secret !== 'dg-mkt-test-2026') {
      return { success: false, error: 'unauthorized' };
    }
    const target = (to ?? 'amgalanbayar1984@gmail.com').trim().toLowerCase();
    const exp = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const items = [
      { title: '3000+ PowerPoint мэргэжлийн загвар', price: 19000 },
      { title: '1300 Font + 200 Canva багц', price: 49900 },
    ];
    // only массив өгвөл зөвхөн тэдгээрийг л явуулна (бүгдийг биш). Жишээ:
    // { only: ['reactivation','expiring','new-product'] }
    const want = (k: string) => !only || only.length === 0 || only.includes(k);
    let sent = 0;

    if (want('cart')) { this.email.sendCartReminder({ to: target, name: 'Амгаланбаяр', orderId: 'TESTORDER1', items, total: 68900 }); sent++; }
    if (want('discount')) { this.email.sendDiscountPush({ to: target, name: 'Амгаланбаяр', orderId: 'TESTORDER1', couponCode: 'SUBSCRIBER10', discountPercent: 10 }); sent++; }
    if (want('expiring')) { this.email.sendExpiringCoupon({ to: target, name: 'Амгаланбаяр', couponCode: 'SUBSCRIBER10', discountLabel: '10% хөнгөлөлт', expiresAt: exp, couponId: 'TESTCPN1' }); sent++; }
    if (want('new-product')) { this.email.sendNewProduct({ to: target, productTitle: '1300 Font + 200 Canva + 100 PowerPoint — НЭГДСЭН БАГЦ', productSlug: 'font-canva-powerpoint-free', price: 0, salePrice: 0, imageUrl: null }); sent++; }
    if (want('reactivation')) { this.email.sendReactivation({ to: target, name: 'Амгаланбаяр', couponCode: 'WELCOMEBACK10', discountLabel: '10% хөнгөлөлт' }); sent++; }

    return { success: true, sent, to: target };
  }
}
