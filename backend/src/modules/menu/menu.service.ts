import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu-item.dto';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  findPublic() {
    return this.prisma.menuItem.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  findAll() {
    return this.prisma.menuItem.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  create(dto: CreateMenuItemDto) {
    return this.prisma.menuItem.create({ data: dto });
  }

  update(id: string, dto: UpdateMenuItemDto) {
    return this.prisma.menuItem.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.menuItem.delete({ where: { id } });
  }

  async reorder(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.menuItem.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    return this.findAll();
  }
}
