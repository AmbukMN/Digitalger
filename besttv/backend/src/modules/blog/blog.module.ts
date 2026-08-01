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
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
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

  async adminList(params: { q?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, params.limit ?? 20);
    const where = params.q
      ? { title: { contains: params.q, mode: 'insensitive' as const } }
      : {};

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

@Controller('admin/blog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class BlogAdminController {
  constructor(private readonly svc: BlogService) {}

  @Get()
  list(@Query('q') q?: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.svc.adminList({ q, page, limit });
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
