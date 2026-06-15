import { BadRequestException, Injectable } from '@nestjs/common';
import { IsOptional, IsString, ValidateIf } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';

// ⚠️ Зөвхөн БОДИТ жагсаалтын хуудас (Page model-гүй). Page хуудсууд
// (/about, /contact, /privacy-policy, /terms-of-use, /data-deletion) нь
// admin Pages хэсэгт өөрийн SEO-г тохируулдаг тул энд ОРОХГҮЙ (давхцалгүй).
// ТОГТМОЛ хуудас (бүх хэрэглэгчдэд нийтлэг). Эдгээрээс гадна динамикаар
// БОДИТ category (/categories/{slug}) + БОДИТ published blog (/blog/{slug})
// нэмэгдэнэ (getAllowedPaths / upsert validation доор).
export const ALLOWED_PATHS = [
  '/',
  '/products',
  '/categories',
  '/blog',
  '/search',
] as const;

// admin dropdown-д ойлгомжтой нэг мөр
export interface AllowedPath {
  path: string;
  label: string;
}

// бүлэглэсэн хариу (admin dropdown — Тогтмол / Ангилал / Блог)
export interface AllowedPathsGrouped {
  static: AllowedPath[];
  categories: AllowedPath[];
  blog: AllowedPath[];
}

// ⚠️ Frontend нь хоосон талбарыг null илгээдэг (form.title.trim() || null).
// @IsString() нь null дээр унаж 400 Bad Request өгдөг тул @ValidateIf-ээр
// null/undefined үед validation алгасна (upsert дотор ?? null болгоно).
export class UpsertSeoDto {
  // Frontend PUT-д бүх body-г (id-тэй хамт) илгээдэг. forbidNonWhitelisted нь
  // DTO-д байхгүй талбарт 400 өгдөг тул id-г энд зөвшөөрнө (upsert path-аар л
  // ажилладаг, id-г ашигладаггүй).
  @IsOptional() @IsString() id?: string;
  @IsString() path!: string;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() title?: string | null;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() description?: string | null;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() ogImageUrl?: string | null;
}

@Injectable()
export class SeoService {
  constructor(private readonly prisma: PrismaService) {}

  // path нормчлох: эхэндээ / заавал, сүүлийн / хасах ("/" хэвээр)
  private normalizePath(raw: string): string {
    let p = (raw || '').trim();
    if (!p.startsWith('/')) p = '/' + p;
    if (p.length > 1) p = p.replace(/\/+$/, '');
    return p === '' ? '/' : p;
  }

  // frontend generateMetadata уншина — байхгүй бол null (default ажиллана)
  getByPath(path: string) {
    const normalized = this.normalizePath(path);
    return this.prisma.seoOverride.findUnique({ where: { path: normalized } });
  }

  // admin жагсаалт
  listAll() {
    return this.prisma.seoOverride.findMany({ orderBy: { path: 'asc' } });
  }

  // Тогтмол хуудсуудын ойлгомжтой label
  private static readonly STATIC_LABELS: Record<string, string> = {
    '/': 'Нүүр хуудас',
    '/products': 'Бүтээгдэхүүн',
    '/categories': 'Ангилал (жагсаалт)',
    '/blog': 'Блог (жагсаалт)',
    '/search': 'Хайлт',
  };

  // admin dropdown-д бодит route жагсаалт (динамик + label, бүлэглэсэн).
  // ⚠️ findMany хөнгөн — зөвхөн slug/name/title select.
  async getAllowedPaths(): Promise<AllowedPathsGrouped> {
    const [categories, blogPosts] = await Promise.all([
      this.prisma.category.findMany({
        select: { slug: true, name: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.blogPost.findMany({
        where: { published: true },
        select: { slug: true, title: true },
        orderBy: { publishedAt: 'desc' },
      }),
    ]);

    const staticPaths: AllowedPath[] = (ALLOWED_PATHS as readonly string[]).map(
      (path) => ({
        path,
        label: `${path} (${SeoService.STATIC_LABELS[path] ?? path})`,
      }),
    );

    const categoryPaths: AllowedPath[] = categories.map((c) => ({
      path: `/categories/${c.slug}`,
      label: `/categories/${c.slug} (${c.name})`,
    }));

    const blogPaths: AllowedPath[] = blogPosts.map((b) => ({
      path: `/blog/${b.slug}`,
      label: `/blog/${b.slug} (${b.title})`,
    }));

    return { static: staticPaths, categories: categoryPaths, blog: blogPaths };
  }

  // path нь зөвшөөрөгдсөн эсэх (тогтмол + БОДИТ category/blog slug).
  // ⚠️ DB-ээс баталгаажуулна — буруу/404 URL биш.
  private async isPathAllowed(path: string): Promise<boolean> {
    if ((ALLOWED_PATHS as readonly string[]).includes(path)) return true;

    const categoryMatch = path.match(/^\/categories\/([^/]+)$/);
    if (categoryMatch) {
      const slug = categoryMatch[1];
      const count = await this.prisma.category.count({ where: { slug } });
      return count > 0;
    }

    const blogMatch = path.match(/^\/blog\/([^/]+)$/);
    if (blogMatch) {
      const slug = blogMatch[1];
      const count = await this.prisma.blogPost.count({
        where: { slug, published: true },
      });
      return count > 0;
    }

    return false;
  }

  async upsert(dto: UpsertSeoDto) {
    const path = this.normalizePath(dto.path);
    if (!(await this.isPathAllowed(path))) {
      throw new BadRequestException('Энэ хуудас байхгүй');
    }
    const data = {
      title: dto.title ?? null,
      description: dto.description ?? null,
      ogImageUrl: dto.ogImageUrl ?? null,
    };
    return this.prisma.seoOverride.upsert({
      where: { path },
      update: data,
      create: { path, ...data },
    });
  }

  // устгах → frontend override олдохгүй → хуудсын өөрийн default meta
  remove(id: string) {
    return this.prisma.seoOverride.delete({ where: { id } });
  }
}
