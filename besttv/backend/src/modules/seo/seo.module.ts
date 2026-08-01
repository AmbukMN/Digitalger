import { Module } from '@nestjs/common';
import { Body, Controller, Get, Injectable, Put, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

const SEO_KEY = 'seo';

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
}

@Controller('seo')
export class SeoController {
  constructor(private readonly svc: SeoService) {}

  @Get()
  get() {
    return this.svc.get();
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
}

@Module({
  controllers: [SeoController, SeoAdminController],
  providers: [SeoService],
})
export class SeoModule {}
