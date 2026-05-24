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

    // Email editable only for guests or if no oauth provider
    if (dto.email !== undefined) {
      const canEditEmail = user.isGuest || (!user.oauthProvider);
      if (!canEditEmail) {
        throw new BadRequestException('Cannot change email for OAuth accounts');
      }
      // Check email uniqueness
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Email already in use');
      }
    }

    // Normalize empty string phone to null
    const phone = dto.phone === '' ? null : dto.phone;

    // Phone uniqueness check
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
        ...(dto.email !== undefined && {
          email: dto.email.toLowerCase(),
          isGuest: false,
          emailVerified: new Date(),
        }),
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
      // Guest → set email + password to become a full user
      if (!dto.email) throw new BadRequestException('И-мэйл шаардлагатай');
      const normalizedEmail = dto.email.toLowerCase();
      const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing && existing.id !== userId) throw new ConflictException('Энэ и-мэйл аль хэдийн бүртгэлтэй байна');
      const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
      return this.prisma.user.update({
        where: { id: userId },
        data: { email: normalizedEmail, passwordHash, isGuest: false, emailVerified: new Date() },
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

  async updateByAdmin(id: string, dto: { name?: string; role?: string; image?: string; phone?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.role !== undefined && { role: dto.role as any }),
      },
      select: USER_SELECT,
    });
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

    await this.prisma.$transaction([
      this.prisma.zipJob.deleteMany({ where: { userId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
  }
}
