import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';

/**
 * ХУГАЦАА ДУУСАХ САНУУЛГА — багц болон түрээс.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: `EmailService.sendExpiringSoon()` нь бичигдсэн
 * атлаа кодын санд ХААНА Ч дуудагддаггүй байв (dead code). Үр дүнд
 * хэрэглэгч багцаа дуусахыг МЭДЭХГҮЙ өнгөрч, сунгахгүй → subscription
 * загварын гол retention суваг ажиллахгүй, орлого шууд алдагдана.
 *
 * ⚠️ ЭРХ ХААХ энд ХИЙХГҮЙ. Эрх нь query бүрт `expiresAt > now()`-ээр
 * шалгагддаг (`subscriptions.service.ts`) тул хугацаа дуусмагц ӨӨРӨӨ
 * хаагдана. Энэ сервис нь ЗӨВХӨН мэдэгдэл илгээнэ — cron унасан ч
 * эрхийн логик эвдрэхгүй.
 */
@Injectable()
export class ExpiryNotifyService {
  private readonly logger = new Logger(ExpiryNotifyService.name);

  /** Багц дуусахаас хэдэн хоногийн өмнө сануулах */
  private static readonly PLAN_WARN_DAYS = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /**
   * ⚠️ ӨДӨРТ НЭГ УДАА, 10:00-д (Улаанбаатарын өглөө биш — сервер UTC).
   *
   * ЯАГААД өдөрт нэг вэ: сануулга нь яаралтай биш. Илүү олон ажиллуулбал
   * `EmailLog` шалгалт байгаа ч дэмий ачаалал өгнө.
   * ⚠️ Цаг сонголт: шөнө дунд (00:00) бол бусад cron-той давхцаж, мөн
   * хэрэглэгч өглөө сэрэхэд имэйл "шинэ" харагдах нь дээр.
   */
  @Cron('0 10 * * *')
  async notifyExpiring() {
    await Promise.allSettled([this.notifyPlans(), this.notifyRentals()]);
  }

  /** Багц дуусахаас 3 хоногийн өмнө */
  private async notifyPlans() {
    const now = new Date();
    const until = new Date(now.getTime() + ExpiryNotifyService.PLAN_WARN_DAYS * 86_400_000);

    const subs = await this.prisma.subscription.findMany({
      where: {
        /* ⚠️ ОДОО хүчинтэй БӨГӨӨД 3 хоногийн дотор дуусах */
        expiresAt: { gt: now, lte: until },
        user: { isActive: true },
      },
      select: {
        id: true,
        expiresAt: true,
        userId: true,
        user: { select: { email: true, name: true } },
        plan: { select: { name: true } },
      },
    });
    if (!subs.length) return;

    /**
     * ⚠️⚠️ ДАВХАР ИЛГЭЭХЭЭС СЭРГИЙЛНЭ.
     *
     * Cron өдөр бүр ажиллах ба ижил subscription 3 өдөр дараалан
     * "3 хоногийн дотор дуусах" нөхцөлд тохирно. Шалгахгүй бол
     * хэрэглэгч ГУРВАН ижил имэйл авна → spam гэж тэмдэглэнэ →
     * бүх имэйлийн хүргэлт муудна (домэйны нэр хүнд унана).
     *
     * `EmailLog`-оос сүүлийн 7 хоногт `expiring` илгээсэн эсэхийг
     * шалгана (`@@index([template, createdAt])` байгаа тул хурдан).
     */
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const sent = await this.prisma.emailLog.findMany({
      where: {
        template: 'expiring',
        createdAt: { gte: weekAgo },
        userId: { in: subs.map((s) => s.userId) },
      },
      select: { userId: true },
    });
    const already = new Set(sent.map((s) => s.userId));

    let count = 0;
    for (const s of subs) {
      if (already.has(s.userId) || !s.user.email) continue;
      const daysLeft = Math.max(
        1,
        Math.ceil((s.expiresAt.getTime() - now.getTime()) / 86_400_000),
      );
      this.email.sendExpiringSoon({
        to: s.user.email,
        name: s.user.name,
        planName: s.plan.name,
        expiresAt: s.expiresAt,
        daysLeft,
        userId: s.userId,
      });
      count++;
    }
    if (count) this.logger.log(`Багц дуусах сануулга: ${count} хэрэглэгчид`);
  }

  /**
   * Түрээс дуусахаас ~6 цагийн өмнө.
   *
   * ⚠️ Түрээс нь ихэвчлэн 48 цаг тул ХОНОГООР сануулах нь утгагүй —
   * цагаар тооцно. Өдөрт нэг ажилладаг тул 6-30 цагийн хооронд
   * дуусахыг барина (дараагийн ажиллалт хүртэлх цонх).
   */
  private async notifyRentals() {
    const now = new Date();
    const from = new Date(now.getTime() + 6 * 3600_000);
    const to = new Date(now.getTime() + 30 * 3600_000);

    const rentals = await this.prisma.rental.findMany({
      where: { expiresAt: { gt: from, lte: to }, user: { isActive: true } },
      select: {
        userId: true,
        expiresAt: true,
        user: { select: { email: true, name: true } },
        title: { select: { title: true, slug: true } },
      },
    });
    if (!rentals.length) return;

    /* ⚠️ Түрээсийн сануулгыг 2 хоногт нэг л удаа (түрээс өөрөө богино) */
    const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000);
    const sent = await this.prisma.emailLog.findMany({
      where: {
        template: 'rental-expiring',
        createdAt: { gte: twoDaysAgo },
        userId: { in: rentals.map((r) => r.userId) },
      },
      select: { userId: true },
    });
    const already = new Set(sent.map((s) => s.userId));

    let count = 0;
    for (const r of rentals) {
      if (already.has(r.userId) || !r.user.email) continue;
      const hoursLeft = Math.max(
        1,
        Math.round((r.expiresAt.getTime() - now.getTime()) / 3600_000),
      );
      this.email.sendRentalExpiring({
        to: r.user.email,
        name: r.user.name,
        titleName: r.title.title,
        titleSlug: r.title.slug,
        expiresAt: r.expiresAt,
        hoursLeft,
        userId: r.userId,
      });
      count++;
    }
    if (count) this.logger.log(`Түрээс дуусах сануулга: ${count} хэрэглэгчид`);
  }
}
