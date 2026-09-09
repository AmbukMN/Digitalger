import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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

  /**
   * ⚠️⚠️ ӨНДӨР ХЯЗГААР — глобал `short` (20 хүсэлт/сек) хангалтгүй.
   *
   * `CfThrottlerGuard` нь IP-ээр тоолдог бөгөөс n8n чатботын БҮХ
   * хүсэлт НЭГ серверийн IP-ээс ирнэ. Мессеж бүрд кино хайлт явдаг
   * тул 4-5 хүн зэрэг бичихэд хязгаар дүүрч 429 буцна.
   *
   * ⚠️ Тэр үед чатбот «кино олдсонгүй» гэж ХУДЛАА хариулна —
   * `Build Messages` нь алдааг хоосон массиваас ялгадаггүй.
   */
  @Throttle({
    /* ⚠️ БҮХ бакет — `default` дангаараа хангалтгүй, глобал `short`
       (20/сек) хэвээр үйлчилж 429 буцаадаг */
    default: { limit: 600, ttl: 60_000 },
    short: { limit: 120, ttl: 1_000 },
    medium: { limit: 600, ttl: 60_000 },
    long: { limit: 20_000, ttl: 3_600_000 },
  })
  @Get('search')
  search(
    @Query('q') q: string,
    /* ⚠️ Чатботод — «цуврал» гэвэл SERIES, «кино» гэвэл MOVIE */
    @Query('type') type?: 'MOVIE' | 'SERIES',
    @Query('limit') limit?: string,
    /**
     * ⚠️⚠️ БАГЦЫН НЭРЭЭР ХАЙХ — чатботод зориулав.
     *
     * «Шилдэг кино багц юу байдаг вэ?» гэж асуухад ерөнхий мэдээлэл
     * биш ТУХАЙН БАГЦАД БАГТАХ КИНОГ харуулах ёстой (бодит гомдол).
     * Багц нь жанраар холбогддог тул багцын нэрийг өгвөл түүний
     * жанрын киног буцаана.
     */
    @Query('plan') plan?: string,
  ) {
    /**
     * ⚠️⚠️ ХАЙЛТЫН ТЕКСТИЙГ ХЯЗГААРЛАНА — DoS-оос ХОЁР ДАХЬ ХАМГААЛАЛТ.
     *
     * ⛔ `@Query('q')` нь ЭНГИЙН примитив тул глобал `ValidationPipe`
     * ОГТ үйлчилдэггүй (DTO класс биш). `@MaxLength` хаана ч байгаагүй.
     *
     * Production тест: `q=bubobubobubobubobubo` (20 тэмдэгт) нэг хүсэлт
     * origin-ыг 125 СЕКУНД түгжсэн (`expandQuery`-ийн экспоненциал
     * рекурс). Тэр талд `MAX_VARIANTS=64` нэмсэн ч энд ч таслах нь зөв —
     * `expandQuery` нь `chat-keywords`, `titles-admin`, `slugify`-аас ч
     * дуудагддаг.
     *
     * ⚠️ 100 тэмдэгт нь бодит хайлтад хангалттай (хамгийн урт киноны
     * нэр 47 тэмдэгт). Хэтэрсэн хэсгийг ЧИМЭЭГҮЙ тасална — алдаа
     * шидвэл хэрэглэгчийн бичих явцад 400 гарна.
     */
    const query = (q ?? '').slice(0, 100);
    const t = type === 'MOVIE' || type === 'SERIES' ? type : undefined;
    const n = Math.min(40, Math.max(1, Number(limit) || 20));
    if (plan && plan.trim()) return this.titles.searchByPlan(plan.trim().slice(0, 100), n);
    return this.titles.search(query, n, t);
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

  /**
   * ⚠️⚠️ «Ижил төстэй контент» — ДАРААГИЙН хуудас.
   *
   * Дэлгэрэнгүй хуудсанд эхлээд 12 кино л ирдэг. Эгнээг баруун тийш
   * гүйлгэхэд frontend нь эндээс үлдсэнийг татаж, ДУУСТАЛ үргэлжлүүлнэ.
   *
   * ⚠️ Замыг `:slug`-ийн ӨМНӨ бичив — эс бөгөөс `:slug` нь `related`
   * гэдгийг киноны slug гэж ойлгоод 404 буцаана.
   *
   * ⚠️ `:id` нь slug БИШ, Title.id — дэлгэрэнгүйн хариунд аль хэдийн
   * ирсэн байдаг тул нэмэлт хайлт шаардахгүй.
   */
  @Get(':id/related')
  related(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.titles.relatedPage(id, Number(page) || 1, Number(limit) || 12);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  detail(@Param('slug') slug: string, @CurrentUser() user: JwtPayload | null) {
    return this.titles.detail(slug, user?.sub);
  }
}
