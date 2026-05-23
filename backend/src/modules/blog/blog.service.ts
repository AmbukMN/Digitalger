import { Injectable } from '@nestjs/common';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  async findAllPublished(params?: { page?: number; pageSize?: number; tag?: string }) {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 12;
    const skip = (page - 1) * pageSize;
    const where: any = { published: true };
    if (params?.tag) where.tags = { has: params.tag };
    const select = { id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, publishedAt: true, tags: true, authorName: true, createdAt: true };
    const [items, total] = await Promise.all([
      this.prisma.blogPost.findMany({ where, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }], take: pageSize, skip, select }),
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
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 10,
      select: { id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, publishedAt: true, tags: true, authorName: true, createdAt: true },
    });
  }

  findLatest(count = 3) {
    return this.prisma.blogPost.findMany({
      where: { published: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: count,
      select: { id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, publishedAt: true, authorName: true, createdAt: true },
    });
  }

  findBySlug(slug: string) {
    return this.prisma.blogPost.findUniqueOrThrow({ where: { slug } });
  }

  findAll() {
    return this.prisma.blogPost.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  create(dto: CreateBlogPostDto) {
    return this.prisma.blogPost.create({
      data: {
        ...dto,
        publishedAt: dto.published ? new Date() : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateBlogPostDto) {
    const existing = await this.prisma.blogPost.findUniqueOrThrow({ where: { id } });
    return this.prisma.blogPost.update({
      where: { id },
      data: {
        ...dto,
        publishedAt: dto.published && !existing.published ? new Date() : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.blogPost.findUniqueOrThrow({ where: { id } });
    return this.prisma.blogPost.delete({ where: { id } });
  }
}
