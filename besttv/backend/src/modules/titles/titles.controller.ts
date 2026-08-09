import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TitleType } from '@prisma/client';
import { TitlesService } from './titles.service';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller('titles')
export class TitlesController {
  constructor(private readonly titles: TitlesService) {}

  @Get('home')
  @UseGuards(OptionalJwtAuthGuard)
  home(@CurrentUser() user: JwtPayload | null) {
    return this.titles.home(user?.sub);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.titles.search(q ?? '');
  }

  /** 18+ хуудас — ерөнхий каталогт харагдахгүй контент (нас баталгаажуулсны дараа) */
  @Get('adult')
  adult(
    @Query('type') type?: TitleType,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.titles.adult({ type, page, limit });
  }

  /**
   * ID-аар олон кино авах — ЗОЧНЫ "Дуртай" жагсаалт (localStorage-д зөвхөн id
   * хадгална). Нэвтэрсэн хэрэглэгч GET /my-list ашиглана.
   */
  @Get('by-ids')
  byIds(@Query('ids') ids?: string) {
    return this.titles.byIds((ids ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  }

  /**
   * ⚠️⚠️ SITEMAP-Д ЗОРИУЛСАН — БҮХ киноны slug (хязгааргүй).
   *
   * БОДИТ АЛДАА: `sitemap.ts` нь `/titles?limit=1000` дуудаж байсан ч
   * `list()` нь `Math.min(60, ...)` тул ЗӨВХӨН 60 буцаадаг. 131
   * киноны 71 нь Google-д ХЭЗЭЭ Ч индексжихгүй байв.
   *
   * ⚠️ `limit` хязгаарыг ӨСГӨЖ БОЛОХГҮЙ — тэр нь хэрэглэгчийн
   * каталогийг хамгаалдаг (1000 кино нэг хуудсанд = удаан + их санах ой).
   * Оронд нь ЭНЭ хөнгөн endpoint: зөвхөн `slug` + `updatedAt`,
   * постер/тайлбар/жанр ОГТ татахгүй.
   */
  @Get('sitemap')
  sitemap() {
    return this.titles.allSlugs();
  }

  @Get()
  list(
    @Query('type') type?: TitleType,
    @Query('genre') genre?: string,
    @Query('year') year?: number,
    @Query('sort') sort?: 'new' | 'popular' | 'rating',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.titles.list({ type, genre, year, sort, page, limit });
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  detail(@Param('slug') slug: string, @CurrentUser() user: JwtPayload | null) {
    return this.titles.detail(slug, user?.sub);
  }
}
