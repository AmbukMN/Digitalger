import {
  Controller,
  Delete,
  Get,
  Global,
  Injectable,
  Logger,
  Module,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

/**
 * ХЭРЭГЛЭГЧИЙН МЭДЭГДЭЛ.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: дансаар төлсөн хэрэглэгч «баталгаажсан уу?»
 * гэдгээ мэдэхгүй хүлээнэ. Имэйл хоцордог/спамд ордог, Telegram нь
 * зөвхөн админд. Сайт дээр шууд харагдах мэдэгдэл нь дэмжлэгийн
 * дуудлагыг эрс багасгана.
 *
 * ⚠️ Мэдэгдэл үүсгэх нь ХЭЗЭЭ Ч алдаа шидэхгүй — үндсэн үйлдэл
 * (төлбөр баталгаажуулах) мэдэгдлээс болж зогсох ёсгүй.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Мэдэгдэл үүсгэнэ.
   *
   * ⚠️ `void`-оор дуудагдана — `await` шаардахгүй. Алдаа гарвал зөвхөн
   * лог үлдэнэ.
   */
  create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    link?: string,
  ): void {
    void this.prisma.notification
      .create({ data: { userId, type, title, body, link: link ?? null } })
      .catch((e) => {
        this.logger.warn(`Мэдэгдэл үүсгэж чадсангүй (user=${userId}): ${String(e)}`);
      });
  }

  /**
   * Транзакц дотор үүсгэх хувилбар.
   * ⚠️ Төлбөр баталгаажих + мэдэгдэл нь АТОМАР байх шаардлагатай үед.
   */
  async createTx(
    tx: Prisma.TransactionClient,
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    link?: string,
  ): Promise<void> {
    await tx.notification.create({
      data: { userId, type, title, body, link: link ?? null },
    });
  }

  async list(userId: string, limit = 30) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unread };
  }

  /** Зөвхөн уншаагүйн тоо — хонхны улаан цэгт (хөнгөн query) */
  async unreadCount(userId: string): Promise<{ unread: number }> {
    const unread = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { unread };
  }

  async markRead(userId: string, id: string) {
    /* ⚠️ `updateMany` + userId — өөр хүний мэдэгдэл уншсан болгох
       IDOR-оос хамгаална */
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true, count: res.count };
  }

  async remove(userId: string, id: string) {
    await this.prisma.notification.deleteMany({ where: { id, userId } });
    return { ok: true };
  }

  /** Админ: бүх хэрэглэгчийн мэдэгдэл (tracking-д) */
  adminForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.svc.list(user.sub, limit ? Number(limit) : 30);
  }

  /**
   * ⚠️ Хөнгөн endpoint — хонхны тоог 60 секунд тутам шалгана.
   * Бүтэн жагсаалт татвал хэрэггүй өгөгдөл дамжина.
   */
  @Get('unread-count')
  unread(@CurrentUser() user: JwtPayload) {
    return this.svc.unreadCount(user.sub);
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.markRead(user.sub, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.svc.markAllRead(user.sub);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.remove(user.sub, id);
  }
}

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class NotificationsAdminController {
  constructor(private readonly svc: NotificationsService) {}

  /** Хэрэглэгчийн мэдэгдлийн түүх — tracking хэсэгт */
  @Get('user/:userId')
  forUser(@Param('userId') userId: string) {
    return this.svc.adminForUser(userId);
  }
}

/**
 * ⚠️ `@Global` — мэдэгдэл нь олон модулиас үүсгэгдэнэ (bank, payments,
 * subscriptions). Модуль бүрд import шаардвал шинэ газарт мартагдана.
 */
@Global()
@Module({
  controllers: [NotificationsController, NotificationsAdminController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
