import { Module } from '@nestjs/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { CacheInvalidateInterceptor } from '../../common/cache/cache-invalidate.interceptor';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class BannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string;

  /** 16:9 өргөн зураг — R2 key (админ upload хийсний дараа) */
  @IsOptional()
  @IsString()
  imageKey?: string;

  /** ⚠️ Хоосон бол `imageKey` хэрэглэгдэнэ (өргөн зураг утсанд нарийн) */
  @IsOptional()
  @IsString()
  mobileImageKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ctaHref?: string;

  /** Хэддэх жанрын эгнээний дараа орох (0 = хамгийн дээр) */
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * ⚠️ `@IsISO8601` — `@IsDateString` нь хоосон мөрийг ч зөвшөөрдөг.
   * Хугацаа арилгахад frontend `null` илгээнэ.
   */
  @IsOptional()
  @IsISO8601()
  startsAt?: string | null;

  @IsOptional()
  @IsISO8601()
  endsAt?: string | null;
}

@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Нүүрэнд харуулах баннерууд.
   *
   * ⚠️ ХУГАЦААГ ЭНД шүүнэ (DB талд) — frontend-д шүүвэл дууссан баннер
   * сүлжээгээр дамжиж, кэшлэгдээд хугацаа дуусахад ч харагдана.
   */
  async listPublic() {
    const now = new Date();
    const rows = await this.prisma.homeBanner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ position: 'asc' }, { order: 'asc' }],
      select: {
        id: true,
        title: true,
        subtitle: true,
        imageKey: true,
        mobileImageKey: true,
        ctaText: true,
        ctaHref: true,
        position: true,
      },
    });

    /* ⚠️ Bucket PRIVATE тул key-гээр шууд харуулж болохгүй — presign */
    return Promise.all(
      rows.map(async (b) => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        ctaText: b.ctaText,
        ctaHref: b.ctaHref,
        position: b.position,
        imageUrl: await this.storage.publicAssetUrl(b.imageKey, 7200),
        mobileImageUrl: b.mobileImageKey
          ? await this.storage.publicAssetUrl(b.mobileImageKey, 7200)
          : null,
      })),
    );
  }

  /** Админ — идэвхгүй/хугацаа дууссаныг ч харуулна */
  async listAdmin() {
    const rows = await this.prisma.homeBanner.findMany({
      orderBy: [{ position: 'asc' }, { order: 'asc' }],
    });
    return Promise.all(
      rows.map(async (b) => ({
        ...b,
        imageUrl: await this.storage.publicAssetUrl(b.imageKey, 7200),
        mobileImageUrl: b.mobileImageKey
          ? await this.storage.publicAssetUrl(b.mobileImageKey, 7200)
          : null,
      })),
    );
  }

  async create(dto: BannerDto) {
    if (!dto.imageKey) {
      throw new NotFoundException('Зураг заавал — эхлээд зургаа байршуулна уу');
    }
    return this.prisma.homeBanner.create({
      data: {
        title: dto.title ?? '',
        subtitle: dto.subtitle ?? '',
        imageKey: dto.imageKey,
        mobileImageKey: dto.mobileImageKey || null,
        ctaText: dto.ctaText ?? '',
        ctaHref: dto.ctaHref ?? '',
        position: dto.position ?? 2,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });
  }

  async update(id: string, dto: BannerDto) {
    const found = await this.prisma.homeBanner.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Баннер олдсонгүй');

    /**
     * ⚠️ Хуучин зургийг R2-оос УСТГАНА — эс бөгөөс админ зураг солих
     * бүрд хуучин нь үүрд үлдэж, сарын хадгалалтын төлбөр өснө.
     */
    const oldKeys: string[] = [];
    if (dto.imageKey && dto.imageKey !== found.imageKey) oldKeys.push(found.imageKey);
    if (
      dto.mobileImageKey !== undefined &&
      found.mobileImageKey &&
      dto.mobileImageKey !== found.mobileImageKey
    ) {
      oldKeys.push(found.mobileImageKey);
    }

    const row = await this.prisma.homeBanner.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle } : {}),
        ...(dto.imageKey ? { imageKey: dto.imageKey } : {}),
        ...(dto.mobileImageKey !== undefined
          ? { mobileImageKey: dto.mobileImageKey || null }
          : {}),
        ...(dto.ctaText !== undefined ? { ctaText: dto.ctaText } : {}),
        ...(dto.ctaHref !== undefined ? { ctaHref: dto.ctaHref } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.startsAt !== undefined
          ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null }
          : {}),
        ...(dto.endsAt !== undefined
          ? { endsAt: dto.endsAt ? new Date(dto.endsAt) : null }
          : {}),
      },
    });

    /* ⚠️ Fire-and-forget — админыг R2-ын хариу хүлээлгэхгүй */
    for (const k of oldKeys) void this.storage.delete(k).catch(() => null);
    return row;
  }

  async remove(id: string) {
    const found = await this.prisma.homeBanner.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Баннер олдсонгүй');
    await this.prisma.homeBanner.delete({ where: { id } });
    /* ⚠️ Зургийг ч устгана — орхивол R2-д үүрд үлдэнэ */
    void this.storage.delete(found.imageKey).catch(() => null);
    if (found.mobileImageKey) void this.storage.delete(found.mobileImageKey).catch(() => null);
    return { ok: true };
  }
}

@Controller('banners')
export class BannersController {
  constructor(private readonly svc: BannersService) {}

  /** Нүүрэнд — нэвтрэлт шаардахгүй */
  @Get()
  list() {
    return this.svc.listPublic();
  }
}

@Controller('admin/banners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
/* ⚠️ Баннер өөрчлөгдмөгц нүүрний кэш цэвэрлэгдэнэ — эс бөгөөс админ
   90 секунд хүлээх шаардлагатай болж "нэмсэн баннер гарахгүй" гэнэ */
@UseInterceptors(CacheInvalidateInterceptor)
export class BannersAdminController {
  constructor(private readonly svc: BannersService) {}

  @Get()
  list() {
    return this.svc.listAdmin();
  }

  @Post()
  create(@Body() dto: BannerDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: BannerDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

@Module({
  controllers: [BannersController, BannersAdminController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
