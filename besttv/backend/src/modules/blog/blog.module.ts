import { Module } from '@nestjs/common';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { slugify } from '../../common/slugify';

class BlogPostDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  coverKey?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsString()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;
}

@Injectable()
export class BlogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private async decorate<T extends { coverKey: string | null }>(post: T) {
    return { ...post, coverUrl: post.coverKey ? await this.storage.publicAssetUrl(post.coverKey, 7200) : null };
  }

  async list(page = 1, limit = 12) {
    const [items, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.blogPost.count({ where: { isPublished: true } }),
    ]);
    return {
      items: await Promise.all(items.map((p) => this.decorate(p))),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBySlug(slug: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { slug } });
    if (!post || !post.isPublished) throw new NotFoundException('Нийтлэл олдсонгүй');
    await this.prisma.blogPost.update({ where: { slug }, data: { views: { increment: 1 } } });
    return this.decorate(post);
  }

  async adminList(params: {
    q?: string;
    page?: number;
    limit?: number;
    /** 'published' | 'draft' — ХООСОН бол бүгд */
    status?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, params.limit ?? 20);
    /**
     * ⚠️ НООРОГ/НИЙТЛЭГДСЭН ШҮҮЛТ — хүснэгтэд badge харуулдаг мөртлөө
     * шүүх арга байгаагүй тул админ дуусгаагүй ноорогуудаа ОЛОХ
     * боломжгүй байв (20-оор хуудаслагдсан жагсаалт гүйлгэх л).
     */
    const where = {
      ...(params.q ? { title: { contains: params.q, mode: 'insensitive' as const } } : {}),
      ...(params.status === 'published'
        ? { isPublished: true }
        : params.status === 'draft'
          ? { isPublished: false }
          : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.blogPost.count({ where }),
    ]);
    return {
      items: await Promise.all(items.map((p) => this.decorate(p))),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async adminGet(id: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Нийтлэл олдсонгүй');
    return this.decorate(post);
  }

  async create(dto: BlogPostDto) {
    if (!dto.title.trim()) throw new BadRequestException('Гарчиг шаардлагатай');
    const base = slugify(dto.title);
    const exists = await this.prisma.blogPost.findUnique({ where: { slug: base } });
    const slug = exists ? `${base}-${Date.now() % 1000}` : base;

    return this.prisma.blogPost.create({
      data: {
        title: dto.title,
        slug,
        excerpt: dto.excerpt ?? '',
        content: dto.content,
        coverKey: dto.coverKey,
        tags: dto.tags ?? [],
        author: dto.author,
        isPublished: dto.isPublished ?? false,
        publishedAt: dto.isPublished ? new Date() : null,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
      },
    });
  }

  async update(id: string, dto: Partial<BlogPostDto>) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Нийтлэл олдсонгүй');

    const wasPublished = post.isPublished;
    const willPublish = dto.isPublished ?? wasPublished;

    return this.prisma.blogPost.update({
      where: { id },
      data: {
        ...dto,
        publishedAt: !wasPublished && willPublish ? new Date() : undefined,
      },
    });
  }

  /**
   * Нийтлэл устгах.
   *
   * ⚠️ Өмнө нь `.catch(() => null)` байсан тул алдаа НУУГДАЖ, бүтэлгүйтсэн ч
   * `ok: true` буцаадаг байсан — хэрэглэгч "устгагдлаа" гэсэн мэдэгдэл авах
   * мөртлөө мөр хэвээр үлддэг байсан. Одоо алдааг ил гаргана.
   */
  /**
   * Олон нийтлэлийг нэг дор устгана (админ).
   *
   * ⚠️ R2 дээрх cover зургийг ч цэвэрлэнэ — эс бөгөөс DB-ээс устсан ч
   * зураг үлдэж, storage дэмий дүүрнэ (нэгээр устгах `remove`-той ижил
   * зарчим). Устгал амжилттай болсны ДАРАА, fire-and-forget.
   */
  async bulkDelete(ids: string[]) {
    if (!ids.length) return { deleted: 0 };

    const posts = await this.prisma.blogPost.findMany({
      where: { id: { in: ids } },
      select: { id: true, coverKey: true },
    });
    if (!posts.length) return { deleted: 0 };

    const res = await this.prisma.blogPost.deleteMany({
      where: { id: { in: posts.map((p) => p.id) } },
    });

    for (const p of posts) {
      if (p.coverKey) void this.storage.delete(p.coverKey).catch(() => null);
    }
    return { deleted: res.count };
  }

  async remove(id: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { id },
      select: { id: true, coverKey: true },
    });
    if (!post) throw new NotFoundException('Нийтлэл олдсонгүй');

    await this.prisma.blogPost.delete({ where: { id } });

    // R2 зургийг цэвэрлэнэ — DB устгал амжилттай болсны ДАРАА (fire-and-forget)
    if (post.coverKey) {
      void this.storage.delete(post.coverKey).catch(() => null);
    }

    return { ok: true };
  }
}

@Controller('blog')
export class BlogController {
  constructor(private readonly svc: BlogService) {}

  @Get()
  list(@Query('page') page?: number) {
    return this.svc.list(page);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.svc.getBySlug(slug);
  }
}

/** Олноор устгах — нэг дуудалтад дээд тал нь 100 нийтлэл */
class BlogBulkDeleteDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  ids: string[];
}

@Controller('admin/blog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class BlogAdminController {
  constructor(private readonly svc: BlogService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    /* ⚠️ 'published' | 'draft' — ноорогоо олох цорын ганц зам */
    @Query('status') status?: string,
  ) {
    return this.svc.adminList({ q, page, limit, status });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.adminGet(id);
  }

  @Post()
  create(@Body() dto: BlogPostDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<BlogPostDto>) {
    return this.svc.update(id, dto);
  }

  /**
   * Олноор устгах.
   * ⚠️ `@Delete(':id')`-ЭЭС ӨМНӨ байрлана — эс бөгөөс Nest нь
   * 'bulk-delete'-ыг `:id` гэж үзэж, буруу route барина.
   */
  @Post('bulk-delete')
  bulkDelete(@Body() dto: BlogBulkDeleteDto) {
    return this.svc.bulkDelete(dto.ids);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

@Module({
  controllers: [BlogController, BlogAdminController],
  providers: [BlogService],
})
export class BlogModule {}
