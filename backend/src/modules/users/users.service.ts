import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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
}
