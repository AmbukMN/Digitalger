import { Module } from '@nestjs/common';
import {
  Body,
  Controller,
  Get,
  Injectable,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
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
/**
 * Нэг сошиал холбоос.
 *
 * ⚠️ `platform` нь `SOCIAL_PLATFORMS`-ийн аль нэг байх ёстой — footer нь
 *    түүгээр icon сонгодог тул танихгүй утга орвол icon-гүй үлдэнэ.
 */
class SocialLinkDto {
  @IsIn(['facebook', 'instagram', 'youtube', 'twitter', 'tiktok'])
  platform!: string;

  @IsUrl({ require_protocol: true })
  @MaxLength(300)
  url!: string;

  /** Ялгах нэр — «Үндсэн хуудас», «Кино мэдээ» гэх мэт */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;
}

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

  /**
   * ⚠️⚠️ ОЛОН ХОЛБООС — нэг сүлжээнд хэдэн ч хаяг.
   *
   * ⚠️ `@Type` ЗААВАЛ — эс бөгөөс дотоод элемент нь энгийн object
   *    хэвээр үлдэж, `@ValidateNested` ажиллахгүй (чимээгүй өнгөрнө).
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  links?: SocialLinkDto[];
}

/**
 * ⚠️⚠️ ОЛОН ХОЛБООС — нэг сүлжээнд ОЛОН хаяг (ж: 2 Facebook хуудас).
 *
 * Өмнө нь сүлжээ бүр ГАНЦ мөр байсан тул хоёр дахь FB хуудсаа нэмэх
 * ямар ч зам байгаагүй.
 *
 * ⚠️ `label` — хэд хэдэн ижил сүлжээг ЯЛГАХ нэр (ж: «Үндсэн»,
 *    «Кино мэдээ»). Хоосон бол сүлжээний нэрийг ашиглана.
 */
export interface SocialLink {
  /** facebook | instagram | youtube | twitter | tiktok */
  platform: string;
  url: string;
  /** Ялгах нэр (заавал биш) — олон ижил сүлжээтэй үед хэрэгтэй */
  label?: string;
}

export interface SocialsSettings {
  /**
   * ⚠️ ХУУЧИН ТАЛБАРУУД ХЭВЭЭР — устгавал DB-д хадгалагдсан одоогийн
   * өгөгдөл алга болно. `links` нь ЭДГЭЭРИЙГ ОРЛОНО, гэхдээ хуучин
   * клиент (кэшлэгдсэн frontend) эвдрэхгүй байхаар зэрэг буцаана.
   */
  facebook: string;
  instagram: string;
  youtube: string;
  twitter: string;
  tiktok: string;
  email: string;
  phone: string;
  /** ⚠️ ШИНЭ — олон холбоос. Эрэмбэ нь footer-т харагдах дараалал. */
  links: SocialLink[];
}

const DEFAULT_SOCIALS: SocialsSettings = {
  facebook: '',
  instagram: '',
  youtube: '',
  twitter: '',
  tiktok: '',
  email: '',
  phone: '',
  links: [],
};

/** ⚠️ `links`-д зөвшөөрөгдөх сүлжээнүүд — footer-ийн icon-той ТААРНА */
const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'youtube', 'twitter', 'tiktok'] as const;

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
    const saved = { ...DEFAULT_SOCIALS, ...((row?.value ?? {}) as Partial<SocialsSettings>) };

    /**
     * ⚠️⚠️ ХУУЧИН ӨГӨГДЛИЙГ АВТОМАТААР ХӨРВҮҮЛНЭ.
     *
     * DB-д одоо ганц мөр хэлбэрээр (`facebook: "https://..."`) хадгалагдсан.
     * Migration бичихийн оронд УНШИХ үедээ хөрвүүлэх нь аюулгүй:
     *   · Буцаад нийцтэй — хуучин талбарууд ХЭВЭЭР буцна
     *   · Гар аргаар DB засах шаардлагагүй
     *   · Админ хадгалмагц `links` бодитоор бичигдэнэ
     *
     * ⚠️ `links` АЛЬ ХЭДИЙН байвал ХӨРВҮҮЛЭХГҮЙ — эс бөгөөс админ
     *    устгасан холбоос дахин амилна.
     */
    if (!saved.links?.length) {
      saved.links = SOCIAL_PLATFORMS.filter((p) => !!saved[p]?.trim()).map((p) => ({
        platform: p,
        url: saved[p].trim(),
      }));
    }
    return saved;
  }

  async updateSocials(dto: SocialsDto) {
    const current = await this.socials();
    const next: SocialsSettings = { ...current };

    /* ⚠️ Зөвхөн МӨРӨН талбарууд — `links` нь массив тул тусад нь */
    for (const k of Object.keys(DEFAULT_SOCIALS) as (keyof SocialsSettings)[]) {
      if (k === 'links') continue;
      const v = dto[k as keyof SocialsDto];
      if (v !== undefined) next[k] = (v as string | undefined ?? '').trim();
    }

    if (dto.links !== undefined) {
      /* ⚠️ Хоосон URL-тай мөрийг ХАЯНА — админ мөр нэмээд хоосон
         орхивол footer-т эвдэрсэн линк гарах ёсгүй. */
      next.links = dto.links
        .filter((l) => l?.url?.trim())
        .map((l) => ({
          platform: l.platform,
          url: l.url.trim(),
          ...(l.label?.trim() ? { label: l.label.trim() } : {}),
        }));

      /**
       * ⚠️⚠️ ХУУЧИН ТАЛБАРУУДЫГ ЭХНИЙ ХОЛБООСООР ЭМХЭТГЭНЭ.
       *
       * Кэшлэгдсэн хуучин frontend (`socials.facebook`-ыг уншдаг) нь
       * шинэ `links`-ыг мэдэхгүй. Тэдгээр хэрэглэгчид footer ХООСОН
       * болохоос сэргийлж, сүлжээ бүрийн ЭХНИЙ холбоосыг хуучин
       * талбарт давхар бичнэ.
       */
      for (const p of SOCIAL_PLATFORMS) {
        next[p] = next.links.find((l) => l.platform === p)?.url ?? '';
      }
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
