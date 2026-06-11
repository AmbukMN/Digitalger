import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppCacheService, CacheKeys } from '../../common/cache/app-cache.service';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu-item.dto';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { assertPermission } from '../../common/permission';

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

  async findAll(me: JwtPayload) {
    await assertPermission(this.prisma, me, 'menu', 'view');
    return this.prisma.menuItem.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async create(dto: CreateMenuItemDto, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'menu', 'create');
    const item = await this.prisma.menuItem.create({ data: dto });
    await this.cache.del(CacheKeys.publicMenu);
    return item;
  }

  async update(id: string, dto: UpdateMenuItemDto, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'menu', 'edit');
    const item = await this.prisma.menuItem.update({ where: { id }, data: dto });
    await this.cache.del(CacheKeys.publicMenu);
    return item;
  }

  async remove(id: string, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'menu', 'delete');
    const item = await this.prisma.menuItem.delete({ where: { id } });
    await this.cache.del(CacheKeys.publicMenu);
    return item;
  }

  async reorder(ids: string[], me: JwtPayload) {
    await assertPermission(this.prisma, me, 'menu', 'edit');
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.menuItem.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    await this.cache.del(CacheKeys.publicMenu);
    return this.findAll(me);
  }
}
