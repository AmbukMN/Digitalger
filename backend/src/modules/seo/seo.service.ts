import { BadRequestException, Injectable } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';

// ⚠️ Зөвхөн БОДИТ жагсаалтын хуудас (Page model-гүй). Page хуудсууд
// (/about, /contact, /privacy-policy, /terms-of-use, /data-deletion) нь
// admin Pages хэсэгт өөрийн SEO-г тохируулдаг тул энд ОРОХГҮЙ (давхцалгүй).
export const ALLOWED_PATHS = [
  '/',
  '/products',
  '/categories',
  '/blog',
  '/search',
] as const;

export class UpsertSeoDto {
  @IsString() path!: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() ogImageUrl?: string;
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

  // admin dropdown-д бодит route жагсаалт
  getAllowedPaths(): string[] {
    return [...ALLOWED_PATHS];
  }

  async upsert(dto: UpsertSeoDto) {
    const path = this.normalizePath(dto.path);
    if (!(ALLOWED_PATHS as readonly string[]).includes(path)) {
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
