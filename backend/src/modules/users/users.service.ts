import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';

const BCRYPT_ROUNDS = 12;

const USER_SELECT = {
  id: true,
  email: true,
  phone: true,
  name: true,
  image: true,
  role: true,
  isGuest: true,
  blocked: true,
  oauthProvider: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMe(
    userId: string,
    dto: { name?: string; image?: string; phone?: string; email?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // ⚠️ ИМЭЙЛ ЭНД СОЛИХГҮЙ. Имэйл солих нь зөвхөн OTP баталгаажуулалтаар
    // явдаг: POST /auth/request-email-change → confirm-email-change.
    // (Өмнө энд имэйлийг verify-гүй шууд хадгалдаг буг байсан.)
    if (dto.email !== undefined && dto.email !== '' &&
        dto.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new BadRequestException(
        'Имэйл солихын тулд баталгаажуулалт шаардлагатай (request-email-change)',
      );
    }

    // Normalize empty string phone to null
    const phone = dto.phone === '' ? null : dto.phone;

    // Phone uniqueness check (утас verify шаарддаггүй — шууд солино)
    if (phone) {
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Phone already in use');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name || null }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.phone !== undefined && { phone }),
        // email-ийг ЗОРИУДААР оруулахгүй — verify flow-р л солино
      },
      select: USER_SELECT,
    });
  }

  async updatePassword(
    userId: string,
    dto: { email?: string; currentPassword?: string; newPassword: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.isGuest) {
      // Guest → нууц үг хадгалаад, имэйлийг pendingEmail-д тавина.
      // ⚠️ User.email-ийг ЭНД СОЛИХГҮЙ — frontend дараа нь
      // request-email-change/confirm-email-change-ээр имэйлийг баталгаажуулна.
      if (!dto.email) throw new BadRequestException('И-мэйл шаардлагатай');
      const normalizedEmail = dto.email.toLowerCase();
      const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing && existing.id !== userId) throw new ConflictException('Энэ и-мэйл аль хэдийн бүртгэлтэй байна');
      const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
      return this.prisma.user.update({
        where: { id: userId },
        // email хэвээр (guest_xxx@...), зөвхөн нууц үг + pendingEmail хадгална.
        // Имэйл баталгаажихад confirmEmailChange нь email солих + isGuest:false болгоно.
        data: { passwordHash, pendingEmail: normalizedEmail },
        select: USER_SELECT,
      });
    }

    if (user.oauthProvider) {
      throw new BadRequestException('OAuth бүртгэлд нууц үг тохируулах боломжгүй');
    }

    // Regular user → change password
    if (!dto.currentPassword) throw new BadRequestException('Одоогийн нууц үг шаардлагатай');
    if (!user.passwordHash) throw new BadRequestException('Нууц үг тохируулагдаагүй байна');
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Одоогийн нууц үг буруу байна');
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: USER_SELECT,
    });
  }

  async findAllAdmin(query: { page?: number; pageSize?: number; search?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: 'insensitive' } },
            { name: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          phone: true,
          name: true,
          role: true,
          image: true,
          isGuest: true,
          blocked: true,
          oauthProvider: true,
          createdAt: true,
          _count: { select: { orders: true, downloads: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOneAdmin(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_SELECT,
        _count: { select: { orders: true, reviews: true, downloads: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateByAdmin(
    id: string,
    dto: { name?: string; role?: string; image?: string; phone?: string; email?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // Утас давхцал шалгах (хоосон → null)
    const phone = dto.phone === '' ? null : dto.phone;
    if (phone) {
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      if (existing && existing.id !== id) {
        throw new ConflictException('Энэ утасны дугаар өөр хэрэглэгчид бүртгэлтэй байна');
      }
    }

    // Email давхцал шалгах. Админ нь verify-гүйгээр ШУУД солино
    // (зочин биш бол emailVerified=now, зочин бол хэвээр).
    let emailData: { email: string; emailVerified: Date; isGuest: false } | undefined;
    if (dto.email !== undefined && dto.email !== '' &&
        dto.email.toLowerCase() !== user.email.toLowerCase()) {
      const normalizedEmail = dto.email.toLowerCase();
      const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing && existing.id !== id) {
        throw new ConflictException('Энэ имэйл өөр хэрэглэгчид бүртгэлтэй байна');
      }
      emailData = { email: normalizedEmail, emailVerified: new Date(), isGuest: false };
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.phone !== undefined && { phone }),
        ...(dto.role !== undefined && { role: dto.role as any }),
        ...(emailData ?? {}),
      },
      select: USER_SELECT,
    });
  }

  /** Админ хэрэглэгчийн нууц үгийг ШУУД тохируулна (одоогийн нууц үг шаардахгүй) */
  async setPasswordByAdmin(id: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.oauthProvider) {
      throw new BadRequestException('OAuth бүртгэлд нууц үг тохируулах боломжгүй');
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { success: true };
  }

  async blockUser(id: string, blocked: boolean, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') throw new ForbiddenException('Админ хэрэглэгчийг block хийх боломжгүй');
    if (id === adminId) throw new ForbiddenException('Өөрийгөө block хийх боломжгүй');

    return this.prisma.user.update({
      where: { id },
      data: { blocked },
      select: USER_SELECT,
    });
  }

  async deleteUser(id: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') throw new ForbiddenException('Админ хэрэглэгчийг устгах боломжгүй');
    if (id === adminId) throw new ForbiddenException('Өөрийгөө устгах боломжгүй');

    // Хэрэглэгчтэй холбоотой БҮХ өгөгдлийг устгана.
    // orders/reviews/downloads/wishlists/notifications/accounts/sessions нь
    // schema-д onDelete:Cascade тул user.delete-д автоматаар устана.
    // ZipJob (FK relation-гүй) болон EmailOtp (email-ээр холбоотой) гар аргаар устгана.
    await this.prisma.$transaction([
      this.prisma.zipJob.deleteMany({ where: { userId: id } }),
      this.prisma.emailOtp.deleteMany({ where: { email: user.email } }),
      this.prisma.user.delete({ where: { id } }),
    ]);

    // Frontend res.json() амжилттай parse хийхэд { success: true } буцаана
    // (өмнө void буцаадгаас 'Unexpected end of JSON input' алдаа гардаг байсан).
    return { success: true };
  }

  // ─── Admin: хэрэглэгчид бүтээгдэхүүн ҮНЭГҮЙ идэвхжүүлэх (grant) ──────────────
  // total=0, status=PAID, source=ADMIN_GRANT захиалга үүсгэнэ. Ингэснээр бүх
  // эзэмшлийн логик (татах/сургалт/Миний сан) яг худалдаж авсан мэт ажиллана.

  /** Хэрэглэгчид сонгосон бүтээгдэхүүнүүдийг үнэгүй идэвхжүүлнэ. Аль хэдийн
   * эзэмшсэн (худалдаж авсан эсвэл grant) бүтээгдэхүүнийг алгасна. */
  async grantProductsToUser(userId: string, productIds: string[], adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');

    const ids = [...new Set((productIds || []).filter(Boolean))];
    if (!ids.length) throw new BadRequestException('Бүтээгдэхүүн сонгоно уу');

    // Бодит бүтээгдэхүүн эсэхийг шалгана
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, price: true },
    });
    if (!products.length) throw new BadRequestException('Сонгосон бүтээгдэхүүн олдсонгүй');

    // Хэрэглэгч аль хэдийн эзэмшсэн (PAID order) бүтээгдэхүүнийг алгасна (давхардахгүй)
    const ownedItems = await this.prisma.orderItem.findMany({
      where: {
        productId: { in: products.map((p) => p.id) },
        order: { userId, status: OrderStatus.PAID },
      },
      select: { productId: true },
    });
    const ownedSet = new Set(ownedItems.map((i) => i.productId));
    const toGrant = products.filter((p) => !ownedSet.has(p.id));

    if (!toGrant.length) {
      return { granted: 0, skipped: products.length, message: 'Бүгд аль хэдийн идэвхтэй' };
    }

    // total=0, PAID, ADMIN_GRANT захиалга үүсгэнэ (item бүр price=0)
    const order = await this.prisma.order.create({
      data: {
        userId,
        total: 0,
        status: OrderStatus.PAID,
        source: 'ADMIN_GRANT',
        grantedByAdminId: adminId,
        items: {
          create: toGrant.map((p) => ({ productId: p.id, price: 0 })),
        },
      },
      include: { items: { include: { product: { select: { title: true } } } } },
    });

    // Хэрэглэгчид имэйл (худалдаж авсан шиг — Миний санд нэмэгдсэн тухай)
    if (user.email) {
      this.email
        .sendPaymentConfirmation({
          to: user.email,
          name: user.name,
          orderId: order.id,
          total: 0,
          items: order.items.map((i) => ({ title: i.product.title, price: 0 })),
        })
        .catch(() => null);
    }

    return { granted: toGrant.length, skipped: ownedSet.size, orderId: order.id };
  }

  /** Хэрэглэгчид админаас идэвхжүүлсэн (ADMIN_GRANT) бүтээгдэхүүний жагсаалт. */
  async listGrantedProducts(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId, source: 'ADMIN_GRANT', status: OrderStatus.PAID },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        items: {
          select: {
            productId: true,
            product: {
              select: {
                id: true,
                title: true,
                type: true,
                price: true,
                images: { where: { isPrimary: true }, take: 1, select: { fileKey: true } },
              },
            },
          },
        },
      },
    });

    // Бүх grant item-ийг нэг жагсаалт болгоно (orderId хадгална — цуцлахад хэрэгтэй)
    const items = orders.flatMap((o) =>
      o.items.map((it) => ({
        orderId: o.id,
        grantedAt: o.createdAt,
        productId: it.productId,
        title: it.product.title,
        type: it.product.type,
        price: it.product.price,
        imageKey: it.product.images?.[0]?.fileKey ?? null,
      })),
    );
    return { items };
  }

  /** Админаас идэвхжүүлсэн нэг бүтээгдэхүүнийг ЦУЦЛАХ (зөвхөн ADMIN_GRANT).
   * Худалдаж авсан (PURCHASE) захиалгыг цуцлахгүй. Нэг item бол захиалга
   * бүхэлдээ устгана, олон item бол зөвхөн тэр item-ийг устгана. */
  async revokeGrantedProduct(userId: string, productId: string) {
    // Тухайн хэрэглэгчийн ADMIN_GRANT order доторх энэ бүтээгдэхүүний item
    const item = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: { userId, source: 'ADMIN_GRANT', status: OrderStatus.PAID },
      },
      include: { order: { select: { id: true, _count: { select: { items: true } } } } },
    });

    if (!item) {
      throw new NotFoundException('Идэвхжүүлсэн бүтээгдэхүүн олдсонгүй (зөвхөн админ идэвхжүүлсэнийг цуцална)');
    }

    if (item.order._count.items <= 1) {
      // Захиалгад ганц л item — захиалга бүхэлдээ устгана (item cascade)
      await this.prisma.order.delete({ where: { id: item.order.id } });
    } else {
      // Олон item — зөвхөн энэ item-ийг устгана
      await this.prisma.orderItem.delete({ where: { id: item.id } });
    }

    return { success: true };
  }
}
