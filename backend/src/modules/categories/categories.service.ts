import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppCacheService, CacheKeys } from '../../common/cache/app-cache.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AppCacheService,
  ) {}

  // Ангилал жагсаалт navbar/products/footer-д байнга уншигддаг — 10 мин cache.
  findAll() {
    return this.cache.getOrSet(CacheKeys.categories, 10 * 60_000, async () => {
      const categories = await this.prisma.category.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });

      // ⚠️ Product тухайн категорид categoryId (single) ЭСВЭЛ categoryIds (array)-ийн
      // алинд нь байвал тооцно. Өмнө нь категори бүрд тус тусдаа count query явдаг
      // (N+1) байсныг НЭГ raw query болгов: published product бүрийн categoryId болон
      // categoryIds-ийг нэгтгэн (UNION) тэгшилж (unnest), категори тус бүрээр
      // DISTINCT product тоолно. Нэг product нэг категорид олон удаа орохгүй.
      const rows = await this.prisma.$queryRaw<{ categoryId: string; count: bigint }[]>`
        SELECT "categoryId", COUNT(DISTINCT "productId")::bigint AS count
        FROM (
          SELECT "id" AS "productId", "categoryId"
          FROM "Product"
          WHERE "published" = true AND "adminOnly" = false AND "categoryId" IS NOT NULL
          UNION ALL
          SELECT "id" AS "productId", UNNEST("categoryIds") AS "categoryId"
          FROM "Product"
          WHERE "published" = true AND "adminOnly" = false
        ) AS t
        GROUP BY "categoryId"
      `;

      const countMap = new Map(rows.map((r) => [r.categoryId, Number(r.count)]));
      return categories.map((c) => ({
        ...c,
        _count: { products: countMap.get(c.id) ?? 0 },
      }));
    });
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({ where: { slug } });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // categoryId ЭСВЭЛ categoryIds-д байгаа published product-ийг тоолно.
    const products = await this.prisma.product.count({
      where: {
        published: true,
        adminOnly: false,
        OR: [{ categoryId: category.id }, { categoryIds: { has: category.id } }],
      },
    });

    return { ...category, _count: { products } };
  }

  async create(dto: CreateCategoryDto) {
    const exists = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });

    if (exists) {
      throw new ConflictException('Category slug already exists');
    }

    const created = await this.prisma.category.create({ data: dto });
    await this.cache.del(CacheKeys.categories);
    return created;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.ensureExists(id);

    if (dto.slug) {
      const conflict = await this.prisma.category.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException('Category slug already exists');
      }
    }

    const updated = await this.prisma.category.update({ where: { id }, data: dto });
    await this.cache.del(CacheKeys.categories);
    return updated;
  }

  async remove(id: string) {
    await this.ensureExists(id);
    const removed = await this.prisma.category.delete({ where: { id } });
    await this.cache.del(CacheKeys.categories);
    return removed;
  }

  private async ensureExists(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }
}
