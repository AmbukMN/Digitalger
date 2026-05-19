import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';

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

  findAll() {
    return this.prisma.banner.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  create(dto: CreateBannerDto) {
    return this.prisma.banner.create({ data: dto });
  }

  update(id: string, dto: UpdateBannerDto) {
    return this.prisma.banner.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.banner.delete({ where: { id } });
  }
}
