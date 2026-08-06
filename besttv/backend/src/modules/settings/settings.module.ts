import { Module } from '@nestjs/common';
import {
  Body,
  Controller,
  Get,
  Injectable,
  Put,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

/** Брэндийн тохиргооны Settings түлхүүр */
const BRAND_KEY = 'brand';
/** Сошиал холбоосуудын Settings түлхүүр */
const SOCIALS_KEY = 'socials';

class BrandDto {
  /** Үндсэн лого (R2 key) — толгой, footer, нэвтрэх хуудсанд */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  logoKey?: string | null;

  /** Favicon (R2 key) */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  faviconKey?: string | null;

  /** Сайтын нэр — лого байхгүй үед текстээр харагдана */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  siteName?: string;

  /**
   * Хэрэглэгч АНХ ОРОХОД аль өнгөний горим идэвхжих вэ.
   *   dark   — бараан (кино сайтын анхдагч)
   *   light  — гэрэл
   *   system — хэрэглэгчийн ҮЙЛДЛИЙН СИСТЕМИЙН сонголтыг дагана
   *
   * ⚠️ Зөвхөн АНХНЫ утга. Хэрэглэгч header-ийн товчоор өөрчилсөн бол
   * түүний сонголт (localStorage) ДАВАМГАЙЛНА — админ дарж бичихгүй.
   */
  @IsOptional()
  @IsIn(['dark', 'light', 'system'])
  defaultTheme?: 'dark' | 'light' | 'system';
}

/**
 * Сошиал холбоос.
 *
 * ⚠️ Хоосон мөр = "тохируулаагүй" → footer-т ТУХАЙН icon огт харагдахгүй.
 * Хэрэглэхгүй сүлжээгээ хоосон орхиход л хангалттай.
 */
class SocialsDto {
  @IsOptional()
  @ValidateIf((_o, v) => !!v)
  @IsUrl({ require_protocol: true })
  @MaxLength(300)
  facebook?: string;

  @IsOptional()
  @ValidateIf((_o, v) => !!v)
  @IsUrl({ require_protocol: true })
  @MaxLength(300)
  instagram?: string;

  @IsOptional()
  @ValidateIf((_o, v) => !!v)
  @IsUrl({ require_protocol: true })
  @MaxLength(300)
  youtube?: string;

  @IsOptional()
  @ValidateIf((_o, v) => !!v)
  @IsUrl({ require_protocol: true })
  @MaxLength(300)
  twitter?: string;

  @IsOptional()
  @ValidateIf((_o, v) => !!v)
  @IsUrl({ require_protocol: true })
  @MaxLength(300)
  tiktok?: string;

  /** Холбоо барих — footer-т харагдана */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

export interface SocialsSettings {
  facebook: string;
  instagram: string;
  youtube: string;
  twitter: string;
  tiktok: string;
  email: string;
  phone: string;
}

const DEFAULT_SOCIALS: SocialsSettings = {
  facebook: '',
  instagram: '',
  youtube: '',
  twitter: '',
  tiktok: '',
  email: '',
  phone: '',
};

export interface BrandSettings {
  logoKey: string | null;
  faviconKey: string | null;
  siteName: string;
  /** Хэрэглэгч анх орох үеийн өнгөний горим (сонголтоо хийвэл тэр давамгайлна) */
  defaultTheme: 'dark' | 'light' | 'system';
}

const DEFAULT_BRAND: BrandSettings = {
  logoKey: null,
  faviconKey: null,
  siteName: 'BestTV',
  /* ⚠️ Кино сайт тул анхдагч нь БАРААН */
  defaultTheme: 'dark',
};

/**
 * Сайтын брэнд тохиргоо — лого админаас удирдана.
 *
 * ⚠️ Лого нь БҮХ хуудсанд (navbar, footer, нэвтрэх, админ панель) ашиглагдах
 * тул public endpoint нь кэшлэгддэг байх ёстой.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Түүхий тохиргоо (key) */
  private async raw(): Promise<BrandSettings> {
    const row = await this.prisma.settings
      .findUnique({ where: { key: BRAND_KEY } })
      .catch(() => null);
    if (!row) return { ...DEFAULT_BRAND };
    return { ...DEFAULT_BRAND, ...(row.value as Partial<BrandSettings>) };
  }

  /** Нийтэд — key-г бэлэн URL болгож буцаана */
  async publicBrand() {
    const b = await this.raw();
    const [logoUrl, faviconUrl] = await Promise.all([
      b.logoKey ? this.storage.publicAssetUrl(b.logoKey, 86400) : Promise.resolve(null),
      b.faviconKey ? this.storage.publicAssetUrl(b.faviconKey, 86400) : Promise.resolve(null),
    ]);
    /* ⚠️ `defaultTheme` нийтэд ч хэрэгтэй — хэрэглэгч АНХ орох үед
       frontend түүнийг уншиж, өнгөний горимоо тохируулна. */
    return { siteName: b.siteName, logoUrl, faviconUrl, defaultTheme: b.defaultTheme ?? 'dark' };
  }

  /** Админ — key-тэй хамт (засварлахад хэрэгтэй) */
  async adminBrand() {
    const b = await this.raw();
    const pub = await this.publicBrand();
    return { ...b, ...pub };
  }

  /** Сошиал холбоосууд — нийтэд ч, админд ч ижил (нууц зүйл байхгүй) */
  async socials(): Promise<SocialsSettings> {
    const row = await this.prisma.settings
      .findUnique({ where: { key: SOCIALS_KEY } })
      .catch(() => null);
    return { ...DEFAULT_SOCIALS, ...((row?.value ?? {}) as Partial<SocialsSettings>) };
  }

  async updateSocials(dto: SocialsDto) {
    const current = await this.socials();
    const next: SocialsSettings = { ...current };
    for (const k of Object.keys(DEFAULT_SOCIALS) as (keyof SocialsSettings)[]) {
      const v = dto[k as keyof SocialsDto];
      if (v !== undefined) next[k] = (v ?? '').trim();
    }
    await this.prisma.settings.upsert({
      where: { key: SOCIALS_KEY },
      create: { key: SOCIALS_KEY, value: next as object },
      update: { value: next as object },
    });
    return next;
  }

  async updateBrand(dto: BrandDto) {
    const current = await this.raw();
    const next: BrandSettings = {
      logoKey: dto.logoKey !== undefined ? (dto.logoKey || null) : current.logoKey,
      faviconKey:
        dto.faviconKey !== undefined ? (dto.faviconKey || null) : current.faviconKey,
      siteName: dto.siteName?.trim() || current.siteName,
      defaultTheme: dto.defaultTheme ?? current.defaultTheme ?? 'dark',
    };

    await this.prisma.settings.upsert({
      where: { key: BRAND_KEY },
      create: { key: BRAND_KEY, value: next as object },
      update: { value: next as object },
    });

    return this.adminBrand();
  }
}

/** Нийтийн — нэвтрэлт шаардахгүй (лого бүх хуудсанд хэрэгтэй) */
@Controller('settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get('brand')
  brand() {
    return this.svc.publicBrand();
  }

  /** Сошиал холбоос — footer-т хэрэгтэй (нэвтрэлт шаардахгүй) */
  @Get('socials')
  socials() {
    return this.svc.socials();
  }
}

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SettingsAdminController {
  constructor(private readonly svc: SettingsService) {}

  @Get('brand')
  brand() {
    return this.svc.adminBrand();
  }

  @Put('brand')
  update(@Body() dto: BrandDto) {
    return this.svc.updateBrand(dto);
  }

  @Get('socials')
  socials() {
    return this.svc.socials();
  }

  @Put('socials')
  updateSocials(@Body() dto: SocialsDto) {
    return this.svc.updateSocials(dto);
  }
}

@Module({
  controllers: [SettingsController, SettingsAdminController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
