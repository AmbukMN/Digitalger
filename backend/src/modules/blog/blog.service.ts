import { Injectable } from '@nestjs/common';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { AppCacheService, CacheKeys } from '../../common/cache/app-cache.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { assertOwner, assertCanDelete } from '../../common/ownership';
import { assertPermission } from '../../common/permission';

export class CreateBlogPostDto {
  @IsString() title!: string;
  @IsString() slug!: string;
  @IsOptional() @IsString() excerpt?: string;
  @IsString() content!: string;
  @IsOptional() @IsString() coverImageUrl?: string;
  @IsOptional() @IsBoolean() published?: boolean;
  @IsOptional() @IsString() authorName?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsNumber() @Min(0) sortOrder?: number;
}

export class UpdateBlogPostDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() excerpt?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() coverImageUrl?: string;
  @IsOptional() @IsBoolean() published?: boolean;
  @IsOptional() @IsString() authorName?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsNumber() @Min(0) sortOrder?: number;
}

@Injectable()
export class BlogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AppCacheService,
  ) {}

  async findAllPublished(params?: { page?: number; pageSize?: number; tag?: string }) {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 12;
    const skip = (page - 1) * pageSize;
    const where: any = { published: true };
    if (params?.tag) where.tags = { has: params.tag };
    const select = { id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, publishedAt: true, tags: true, authorName: true, createdAt: true };
    const [items, total] = await Promise.all([
      this.prisma.blogPost.findMany({ where, orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }], take: pageSize, skip, select }),
      this.prisma.blogPost.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  search(q: string) {
    return this.prisma.blogPost.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { excerpt: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } },
          { tags: { has: q } },
        ],
      },
      orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 10,
      select: { id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, publishedAt: true, tags: true, authorName: true, createdAt: true },
    });
  }

  // Homepage-д харагддаг — ховор өөрчлөгддөг тул 5 мин cache.
  // Blog post create/update/remove үед blog:latest:* invalidate болно.
  findLatest(count = 3) {
    return this.cache.getOrSet(`${CacheKeys.blogLatestPrefix}${count}`, 5 * 60_000, () =>
      this.prisma.blogPost.findMany({
        where: { published: true },
        orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        take: count,
        select: { id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, publishedAt: true, authorName: true, createdAt: true },
      }),
    );
  }

  findBySlug(slug: string) {
    return this.prisma.blogPost.findUniqueOrThrow({ where: { slug } });
  }

  // Уншилт +1 — frontend client-side (нэг л удаа) дуудна. Fire-and-forget.
  async incrementView(slug: string) {
    await this.prisma.blogPost
      .updateMany({ where: { slug, published: true }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});
    return { ok: true };
  }

  async findAll(me: JwtPayload) {
    await assertPermission(this.prisma, me, 'blog', 'view');
    // ⚠️ SHARED resource: бүх admin БҮГД blog-ийг ХАРНА (owner scope ХАСав).
    // Гэхдээ update/remove ownership ХЭВЭЭР (assertOwner) — зөвхөн өөрийнхөө засна/устгана.
    return this.prisma.blogPost.findMany({
      where: {},
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateBlogPostDto, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'blog', 'create');
    const created = await this.prisma.blogPost.create({
      data: {
        ...dto,
        publishedAt: dto.published ? new Date() : undefined,
        createdByUserId: me.sub,
      },
    });
    await this.cache.delByPrefix(CacheKeys.blogLatestPrefix);
    return created;
  }

  async update(id: string, dto: UpdateBlogPostDto, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'blog', 'edit');
    const existing = await this.prisma.blogPost.findUniqueOrThrow({ where: { id } });
    assertOwner(me, existing, 'засах');
    const updated = await this.prisma.blogPost.update({
      where: { id },
      data: {
        ...dto,
        publishedAt: dto.published && !existing.published ? new Date() : undefined,
      },
    });
    await this.cache.delByPrefix(CacheKeys.blogLatestPrefix);
    return updated;
  }

  async remove(id: string, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'blog', 'delete');
    assertCanDelete(me);
    const existing = await this.prisma.blogPost.findUniqueOrThrow({ where: { id } });
    assertOwner(me, existing, 'устгах');
    const removed = await this.prisma.blogPost.delete({ where: { id } });
    await this.cache.delByPrefix(CacheKeys.blogLatestPrefix);
    return removed;
  }
}
