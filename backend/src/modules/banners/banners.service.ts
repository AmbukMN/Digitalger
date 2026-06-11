import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { buildOwnerWhere, assertOwner, assertCanDelete } from '../../common/ownership';
import { assertPermission } from '../../common/permission';

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  findActive() {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        active: true,
        OR: [
          { startsAt: null },
          { startsAt: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { endsAt: null },
              { endsAt: { gte: now } },
            ],
          },
        ],
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findAll(me: JwtPayload) {
    await assertPermission(this.prisma, me, 'banners', 'view');
    return this.prisma.banner.findMany({
      where: { ...buildOwnerWhere(me) },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(dto: CreateBannerDto, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'banners', 'create');
    return this.prisma.banner.create({
      data: { ...dto, createdByUserId: me.sub },
    });
  }

  async update(id: string, dto: UpdateBannerDto, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'banners', 'edit');
    const existing = await this.prisma.banner.findUniqueOrThrow({ where: { id } });
    assertOwner(me, existing, 'засах');
    return this.prisma.banner.update({ where: { id }, data: dto });
  }

  async remove(id: string, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'banners', 'delete');
    assertCanDelete(me);
    const existing = await this.prisma.banner.findUniqueOrThrow({ where: { id } });
    assertOwner(me, existing, 'устгах');
    return this.prisma.banner.delete({ where: { id } });
  }
}
