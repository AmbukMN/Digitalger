import { Module } from '@nestjs/common';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { CacheInvalidateInterceptor } from '../../common/cache/cache-invalidate.interceptor';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { slugify } from '../../common/slugify';
import { TitlesModule } from '../titles/titles.module';
import { TitleMediaHelper } from '../titles/title-media.helper';

class GenreDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  /** ⚠️ 18+ — ерөнхий каталог/нүүрэнд харагдахгүй, зөвхөн /adult хуудсанд */
  @IsOptional()
  @IsBoolean()
  isAdult?: boolean;
}

/** Жанр доторх киноны эрэмбийг бөөнөөр хадгалах */
class ReorderDto {
  /** Киноны ID-ууд ЯГ харагдах дарааллаар (index → order) */
  @IsArray()
  @IsString({ each: true })
  titleIds: string[];
}

@Injectable()
export class GenresService {
  private readonly logger = new Logger(GenresService.name);

  constructor(
    private readonly prisma: PrismaService,
    /* ⚠️ Постер presign — R2 bucket ХААЛТТАЙ, key ганцаараа зураг гаргахгүй */
    private readonly media: TitleMediaHelper,
    /* ⚠️ `@Global()` тул импорт шаардлагагүй */
    private readonly cache: CacheService,
  ) {}

  /** Admin — бүх жанр (18+ хамт) */
  list() {
    return this.prisma.genre.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { titles: true } } },
    });
  }

  /**
   * Public жанрын жагсаалт — 18+ жанр ч ОРНО (нүүр/шүүлтүүрт харагдана).
   * ⚠️ Контент нь эрхтэй хүнд л тоглоно (subscriptions.canAccessTitle).
   */
  /**
   * ⚠️⚠️ КЭШТЭЙ — `_count` нь жанр БҮРД correlated subquery үүсгэдэг
   * (30 жанр = 30 дэд асуулга). Гэтэл жанр нь бараг өөрчлөгддөггүй
   * өгөгдөл атлаа header цэс, каталогийн шүүлтүүр, нүүр бүрээс
   * дуудагддаг байв.
   */
  listPublic() {
    return this.cache.wrap('genres:public:v1', 300, () =>
      this.prisma.genre.findMany({
        orderBy: { order: 'asc' },
        include: { _count: { select: { titles: true } } },
      }),
    );
  }

  async create(dto: GenreDto) {
    const base = slugify(dto.name);
    const exists = await this.prisma.genre.findUnique({ where: { slug: base } });
    const slug = exists ? `${base}-${Date.now() % 1000}` : base;
    return this.prisma.genre.create({ data: { ...dto, slug } });
  }

  async update(id: string, dto: GenreDto) {
    const genre = await this.prisma.genre.findUnique({ where: { id } });
    if (!genre) throw new NotFoundException('Жанр олдсонгүй');
    return this.prisma.genre.update({ where: { id }, data: dto });
  }

  /**
   * ⚠️⚠️ ЖАНР УСТГАХ — ТӨЛБӨРТЭЙ ЭРХ УСТГАХ ЭРСДЭЛТЭЙ.
   *
   * БОДИТ АЛДАА: энэ функц ямар ч шалгалтгүй `delete` хийдэг байв.
   * `PlanGenre.genre` нь `onDelete: Cascade` тул жанрыг устгамагц
   * түүнийг агуулсан БҮХ багцын холбоос ЧИМЭЭГҮЙ устдаг.
   *
   * Үр дүн: «Солонгос кино» жанрыг устгавал зөвхөн тэр жанртай багц
   * авсан ХЭДЭН ЗУУН төлбөртэй захиалагч бүх контентоо АЛДАНА —
   * мөнгө нь буцаагдахгүй, ямар ч бүртгэл үлдэхгүй, сэргээх ч
   * боломжгүй (`PlanGenre` мөр устсан).
   *
   * Одоо: багцад ашиглагдаж байвал ТАТГАЛЗНА. Админд ЯМАР багц,
   * ХЭДЭН идэвхтэй захиалагч хамрагдахыг ЯГ хэлнэ.
   *
   * ⚠️ `force` нь СҮҮЛИЙН арга — админ үр дагаврыг нүдээр хараад
   * зориуд баталсан үед л. `plans.remove`-той ижил зарчим.
   */
  async remove(id: string, force = false) {
    const genre = await this.prisma.genre.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!genre) throw new NotFoundException('Жанр олдсонгүй');

    const planLinks = await this.prisma.planGenre.findMany({
      where: { genreId: id },
      select: { plan: { select: { id: true, name: true } } },
    });

    if (planLinks.length && !force) {
      const planIds = planLinks.map((p) => p.plan.id);
      /* Тухайн багцуудын ИДЭВХТЭЙ захиалагчийн тоо — админд
         «хэдэн хүн хохирохыг» ЯГ харуулна */
      const affected = await this.prisma.subscription.count({
        where: { planId: { in: planIds }, expiresAt: { gt: new Date() } },
      });
      const names = planLinks.map((p) => p.plan.name).join(', ');
      throw new BadRequestException(
        `«${genre.name}» жанрыг ${planLinks.length} багц ашиглаж байна (${names}). ` +
          `Устгавал идэвхтэй ${affected} захиалагч энэ жанрын контентоо АЛДАНА. ` +
          `Эхлээд багцаас нь хасна уу.`,
      );
    }

    await this.prisma.genre.delete({ where: { id } });
    if (planLinks.length) {
      this.logger.warn(
        `Жанр "${genre.name}" ХҮЧЭЭР устгав — ${planLinks.length} багцын холбоос цуг устлаа`,
      );
    }
    return { ok: true };
  }

  /**
   * ⚠️⚠️ Жанр доторх кинонууд — НҮҮР ХУУДАСТАЙ ЯГ ИЖИЛ эрэмбээр.
   *
   * `titles.service.ts`-ийн нүүрний query нь `[{ order: 'asc' },
   * { title: { createdAt: 'desc' } }]` гэж эрэмбэлдэг. Админ өөр
   * эрэмбээр харвал чирж өөрчилсний дараа нүүр хуудсанд ӨӨР дараалал
   * гарч, "яагаад миний тавьсанаар болоогүй вэ?" гэсэн будлиан үүснэ.
   * Тиймээс ЭНД ЧУХ ТЭР эрэмбийг давтав.
   *
   * ⚠️ `isActive/comingSoon`-оор ШҮҮХГҮЙ — админ идэвхгүй киног ч
   * харж, урьдчилан эрэмбэлж тавих ёстой (идэвхжүүлэхэд шууд
   * зөв байрандаа орно).
   */
  async titlesOfGenre(genreId: string) {
    const genre = await this.prisma.genre.findUnique({
      where: { id: genreId },
      select: { id: true, name: true, slug: true },
    });
    if (!genre) throw new NotFoundException('Жанр олдсонгүй');

    const rows = await this.prisma.titleGenre.findMany({
      where: { genreId },
      orderBy: [{ order: 'asc' }, { title: { createdAt: 'desc' } }],
      select: {
        order: true,
        title: {
          select: {
            id: true,
            title: true,
            slug: true,
            type: true,
            year: true,
            views: true,
            posterKey: true,
            isActive: true,
            comingSoon: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      genre,
      /* ⚠️ Постер нь ХААЛТТАЙ bucket-д — presign хийхгүй бол зураг гарахгүй */
      items: await Promise.all(
        rows.map(async (r) => ({
          ...r.title,
          order: r.order,
          posterUrl: await this.media.url(r.title.posterKey),
        })),
      ),
    };
  }

  /**
   * ⚠️⚠️ Эрэмбийг БӨӨНӨӨР хадгална — `$transaction` дотор.
   *
   * Нэг нэгээр нь update хийвэл дунд нь алдаа гарахад ХАГАС эрэмбэ
   * үлдэж, нүүр хуудас эмх замбараагүй болно. Транзакц нь бүгд эсвэл
   * юу ч биш гэдгийг баталгаажуулна.
   *
   * ⚠️ Илгээсэн ID-ууд нь ТУХАЙН ЖАНРЫНХ мөн эсэхийг шалгана — өөр
   * жанрын киног дамжуулж холбоо үүсгэх боломжийг хаана.
   */
  async reorder(genreId: string, titleIds: string[]) {
    const existing = await this.prisma.titleGenre.findMany({
      where: { genreId },
      select: { titleId: true },
    });
    const valid = new Set(existing.map((e) => e.titleId));
    const clean = titleIds.filter((id) => valid.has(id));

    await this.prisma.$transaction(
      clean.map((titleId, i) =>
        this.prisma.titleGenre.update({
          where: { titleId_genreId: { titleId, genreId } },
          data: { order: i },
        }),
      ),
    );
    return { ok: true, updated: clean.length };
  }
}

@Controller('genres')
export class GenresController {
  constructor(private readonly svc: GenresService) {}

  @Get()
  list() {
    return this.svc.listPublic();
  }
}

@Controller('admin/genres')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
/* ⚠️ Жанрын нэр/эрэмбэ нүүрний эгнээнд харагддаг тул кэш цэвэрлэнэ */
@UseInterceptors(CacheInvalidateInterceptor)
export class GenresAdminController {
  constructor(private readonly svc: GenresService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Body() dto: GenreDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: GenreDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('force') force?: string) {
    /* ⚠️ `force=1` — админ багц алдагдахыг НҮДЭЭР хараад баталсан үед л */
    return this.svc.remove(id, force === '1' || force === 'true');
  }

  /** Жанр доторх кинонууд — нүүр хуудсанд гарах ЯГ ТЭР дарааллаар */
  @Get(':id/titles')
  titles(@Param('id') id: string) {
    return this.svc.titlesOfGenre(id);
  }

  /**
   * Чирж эрэмбэлсний дараа хадгална.
   * ⚠️ `CacheInvalidateInterceptor` нь non-GET тул нүүрний кэш автоматаар
   * цэвэрлэгдэнэ — засвар ШУУД харагдана.
   */
  @Patch(':id/reorder')
  reorder(@Param('id') id: string, @Body() dto: ReorderDto) {
    return this.svc.reorder(id, dto.titleIds);
  }
}

@Module({
  /* ⚠️ `TitleMediaHelper` (постер presign) — TitlesModule-оос экспортлогддог */
  imports: [TitlesModule],
  controllers: [GenresController, GenresAdminController],
  providers: [GenresService],
})
export class GenresModule {}
