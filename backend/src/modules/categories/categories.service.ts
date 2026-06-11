import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppCacheService, CacheKeys } from '../../common/cache/app-cache.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { assertOwner, assertCanDelete, isSuperadmin } from '../../common/ownership';
import { assertPermission } from '../../common/permission';

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

  async create(dto: CreateCategoryDto, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'categories', 'create');
    const exists = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });

    if (exists) {
      throw new ConflictException('Category slug already exists');
    }

    const created = await this.prisma.category.create({
      data: { ...dto, createdByUserId: me.sub },
    });
    await this.cache.del(CacheKeys.categories);
    return created;
  }

  async update(id: string, dto: UpdateCategoryDto, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'categories', 'edit');
    const row = await this.ensureExists(id);
    // ⚠️ IDOR: зөвхөн өөрийн (эсвэл SUPERADMIN) category-г засна.
    assertOwner(me, row, 'засах');

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

  async remove(id: string, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'categories', 'delete');
    // ⚠️ IDOR: EDITOR устгаж чадахгүй + зөвхөн өөрийн category-г устгана.
    assertCanDelete(me);
    const row = await this.ensureExists(id);
    assertOwner(me, row, 'устгах');
    // ⚠️ Phase 3: ӨӨР admin-ийн product энэ category-г ашиглаж байвал устгахгүй
    // (categoryId single ЭСВЭЛ categoryIds array). SUPERADMIN-д хамаарахгүй.
    if (!isSuperadmin(me)) {
      const usedByOther = await this.prisma.product.findFirst({
        where: {
          createdByUserId: { not: me.sub },
          OR: [{ categoryId: id }, { categoryIds: { has: id } }],
        },
        select: { id: true },
      });
      if (usedByOther) {
        throw new ForbiddenException(
          'Энэ ангиллыг өөр админы бүтээгдэхүүн ашиглаж байгаа тул устгах боломжгүй (зөвхөн засах)',
        );
      }
    }
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
