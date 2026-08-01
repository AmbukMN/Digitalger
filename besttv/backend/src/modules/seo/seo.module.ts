import { Module } from '@nestjs/common';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

const SEO_KEY = 'seo';
/**
 * Хуудас тус бүрийн SEO override.
 * ⚠️ Settings key-value-д хадгална — Prisma migration шаардлагагүй, аюулгүй.
 */
const SEO_PAGES_KEY = 'seo_pages';

/**
 * Админаас тохируулж болох ТОГТМОЛ хуудсууд.
 * ⚠️ Кино/цуврал/блог дэлгэрэнгүй нь өөрсдийн датагаас OG үүсгэдэг тул энд орохгүй.
 */
export const SEO_PATHS = [
  { path: '/', label: 'Нүүр хуудас' },
  { path: '/movies', label: 'Бүх кино' },
  { path: '/series', label: 'Олон ангит' },
  { path: '/blog', label: 'Блог / Мэдээ' },
  { path: '/faq', label: 'Түгээмэл асуулт' },
  { path: '/pricing', label: 'Багцууд' },
  { path: '/search', label: 'Хайлт' },
  { path: '/my-list', label: 'Миний дуртай' },
  { path: '/adult', label: 'Насанд хүрэгчдийн' },
] as const;

export interface SeoPageOverride {
  title?: string;
  description?: string;
  ogImageUrl?: string | null;
  keywords?: string;
  noindex?: boolean;
}

export interface SeoSettings {
  siteName: string;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string | null;
  twitterCard: string;
  noindex: boolean;
  googleAnalyticsId: string;
  googleTagManagerId: string;
  facebookPixelId: string;
  siteVerification: string;
}

const DEFAULT_SEO: SeoSettings = {
  siteName: 'BestTV',
  metaTitle: 'BestTV — Үз, мэдэр, дахин үз',
  metaDescription: 'Монголын киноны стриминг платформ',
  ogImageUrl: null,
  twitterCard: 'summary_large_image',
  noindex: false,
  googleAnalyticsId: '',
  googleTagManagerId: '',
  facebookPixelId: '',
  siteVerification: '',
};

class SeoDto {
  @IsOptional() @IsString() siteName?: string;
  @IsOptional() @IsString() metaTitle?: string;
  @IsOptional() @IsString() metaDescription?: string;
  @IsOptional() @IsString() ogImageUrl?: string | null;
  @IsOptional() @IsString() twitterCard?: string;
  @IsOptional() @IsBoolean() noindex?: boolean;
  @IsOptional() @IsString() googleAnalyticsId?: string;
  @IsOptional() @IsString() googleTagManagerId?: string;
  @IsOptional() @IsString() facebookPixelId?: string;
  @IsOptional() @IsString() siteVerification?: string;
}

@Injectable()
export class SeoService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<SeoSettings> {
    const row = await this.prisma.settings.findUnique({ where: { key: SEO_KEY } });
    return row ? { ...DEFAULT_SEO, ...(row.value as object) } : DEFAULT_SEO;
  }

  async update(dto: SeoDto): Promise<SeoSettings> {
    const current = await this.get();
    const next = { ...current, ...dto };
    await this.prisma.settings.upsert({
      where: { key: SEO_KEY },
      create: { key: SEO_KEY, value: next as object },
      update: { value: next as object },
    });
    return next;
  }

  // ── Хуудас тус бүрийн override ──────────────────────────────────────────

  /** Бүх override — админ жагсаалтад */
  async allPages(): Promise<Record<string, SeoPageOverride>> {
    const row = await this.prisma.settings.findUnique({ where: { key: SEO_PAGES_KEY } });
    return (row?.value as Record<string, SeoPageOverride>) ?? {};
  }

  /**
   * Нэг замын override. Байхгүй бол null — frontend анхдагч meta-гаа хэвээр
   * ашиглана (override нь ЗӨВХӨН бөглөсөн талбарыг дарж бичих зарчимтай).
   */
  async pageOverride(path: string): Promise<SeoPageOverride | null> {
    const all = await this.allPages();
    const found = all[path];
    if (!found) return null;
    // Бүх талбар хоосон бол override байхгүйтэй адил
    const hasValue =
      found.title || found.description || found.ogImageUrl || found.keywords || found.noindex;
    return hasValue ? found : null;
  }

  /** Нэг замын override хадгалах (хоосон талбарууд устана) */
  async setPageOverride(path: string, dto: SeoPageOverride): Promise<SeoPageOverride> {
    if (!SEO_PATHS.some((p) => p.path === path)) {
      throw new BadRequestException(`Зөвшөөрөгдөөгүй зам: ${path}`);
    }
    const all = await this.allPages();
    const clean: SeoPageOverride = {};
    if (dto.title?.trim()) clean.title = dto.title.trim();
    if (dto.description?.trim()) clean.description = dto.description.trim();
    if (dto.ogImageUrl?.trim()) clean.ogImageUrl = dto.ogImageUrl.trim();
    if (dto.keywords?.trim()) clean.keywords = dto.keywords.trim();
    if (dto.noindex) clean.noindex = true;

    all[path] = clean;
    await this.prisma.settings.upsert({
      where: { key: SEO_PAGES_KEY },
      create: { key: SEO_PAGES_KEY, value: all as object },
      update: { value: all as object },
    });
    return clean;
  }

  /** Override устгах — анхдагч meta руу буцна */
  async deletePageOverride(path: string): Promise<{ ok: true }> {
    const all = await this.allPages();
    delete all[path];
    await this.prisma.settings.upsert({
      where: { key: SEO_PAGES_KEY },
      create: { key: SEO_PAGES_KEY, value: all as object },
      update: { value: all as object },
    });
    return { ok: true };
  }
}

class SeoPageDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() ogImageUrl?: string | null;
  @IsOptional() @IsString() keywords?: string;
  @IsOptional() @IsBoolean() noindex?: boolean;
}

@Controller('seo')
export class SeoController {
  constructor(private readonly svc: SeoService) {}

  @Get()
  get() {
    return this.svc.get();
  }

  /**
   * Хуудасны override — frontend generateMetadata-аас дуудна.
   * ⚠️ Байхгүй бол null буцаана (алдаа БИШ) — frontend анхдагчаа хэрэглэнэ.
   */
  @Get('override')
  override(@Query('path') path: string) {
    return this.svc.pageOverride(path);
  }
}

@Controller('admin/seo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SeoAdminController {
  constructor(private readonly svc: SeoService) {}

  @Get()
  get() {
    return this.svc.get();
  }

  @Put()
  update(@Body() dto: SeoDto) {
    return this.svc.update(dto);
  }

  // ── Хуудас тус бүрийн override ──────────────────────────────────────────

  /** Тохируулж болох замуудын жагсаалт — админ dropdown-д */
  @Get('paths')
  paths() {
    return SEO_PATHS;
  }

  /** Бүх override нэг дор — админ хүснэгтэд */
  @Get('pages')
  pages() {
    return this.svc.allPages();
  }

  /**
   * ⚠️ Замыг QUERY-гээр авна (`?path=/movies`) — path param-д "/" орвол
   * route таарахгүй (Express 5-д wildcard синтакс өөрчлөгдсөн).
   */
  @Put('pages')
  setPage(@Query('path') path: string, @Body() dto: SeoPageDto) {
    if (!path) throw new BadRequestException('path шаардлагатай');
    return this.svc.setPageOverride(path, dto);
  }

  @Delete('pages')
  deletePage(@Query('path') path: string) {
    if (!path) throw new BadRequestException('path шаардлагатай');
    return this.svc.deletePageOverride(path);
  }
}

@Module({
  controllers: [SeoController, SeoAdminController],
  providers: [SeoService],
})
export class SeoModule {}
