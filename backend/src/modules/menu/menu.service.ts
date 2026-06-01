import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppCacheService, CacheKeys } from '../../common/cache/app-cache.service';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu-item.dto';

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AppCacheService,
  ) {}

  // Public navbar меню — хүсэлт бүрд DB-ээс уншихгүйгээр 10 мин cache.
  // Admin өөрчлөлт хийхэд доорх mutation-ууд cache-г del хийнэ.
  findPublic() {
    return this.cache.getOrSet(CacheKeys.publicMenu, 10 * 60_000, () =>
      this.prisma.menuItem.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  }

  findAll() {
    return this.prisma.menuItem.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async create(dto: CreateMenuItemDto) {
    const item = await this.prisma.menuItem.create({ data: dto });
    await this.cache.del(CacheKeys.publicMenu);
    return item;
  }

  async update(id: string, dto: UpdateMenuItemDto) {
    const item = await this.prisma.menuItem.update({ where: { id }, data: dto });
    await this.cache.del(CacheKeys.publicMenu);
    return item;
  }

  async remove(id: string) {
    const item = await this.prisma.menuItem.delete({ where: { id } });
    await this.cache.del(CacheKeys.publicMenu);
    return item;
  }

  async reorder(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.menuItem.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    await this.cache.del(CacheKeys.publicMenu);
    return this.findAll();
  }
}
