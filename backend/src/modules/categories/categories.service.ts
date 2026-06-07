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
      // ⚠️ _count.products нь зөвхөн categoryId (single) relation тоолдог тул
      // categoryIds (олон категори array)-д байгаа product-уудыг алгасдаг. Product
      // тухайн категорид categoryId ЭСВЭЛ categoryIds-ийн алинд нь байвал тооцно.
      const counts = await Promise.all(
        categories.map((c) =>
          this.prisma.product.count({
            where: {
              published: true,
              OR: [{ categoryId: c.id }, { categoryIds: { has: c.id } }],
            },
          }),
        ),
      );
      return categories.map((c, i) => ({ ...c, _count: { products: counts[i] } }));
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
