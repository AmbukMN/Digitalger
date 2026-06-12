import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ProductsService } from './products.service';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

// adminOnly бүтээгдэхүүн харах scope контекст (owner-aware).
// - зочин/USER → undefined (зөвхөн public)
// - SUPERADMIN → бүх adminOnly бүтээгдэхүүн (хэн оруулснаас үл хамаарна)
// - ADMIN/EDITOR → зөвхөн ӨӨРИЙН оруулсан adminOnly бүтээгдэхүүн (userId scope)
const adminCtx = (
  user?: JwtPayload | null,
): { role: string; userId?: string } | undefined => {
  if (!user) return undefined;
  if (user.role === 'SUPERADMIN') return { role: 'SUPERADMIN' };
  if (['ADMIN', 'EDITOR'].includes(user.role)) return { role: 'ADMIN', userId: user.sub };
  return undefined;
};

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Үзэлт +1 (public). Throttle тавьсан — @SkipThrottle байсныг арилгав
  // (нэг IP-ээс view тоог хийсвэрээр томруулах спамаас сэргийлнэ).
  // Optional auth — admin adminOnly product-ийн үзэлтийг ч нэмж чадна.
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @UseGuards(OptionalJwtAuthGuard)
  @Post(':slug/view')
  @HttpCode(HttpStatus.OK)
  incrementView(@Param('slug') slug: string, @CurrentUser() user?: JwtPayload) {
    return this.productsService.incrementView(slug, adminCtx(user));
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  list(
    @CurrentUser() user?: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') categorySlug?: string,
    @Query('featured') featured?: string,
    @Query('type') type?: string,
    @Query('types') types?: string,
    @Query('sortBy') sortBy?: string,
    @Query('onSale') onSale?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
  ) {
    const typeFilter = types
      ? types.split(',').map((t) => t.trim()).filter(Boolean)
      : type
      ? [type]
      : undefined;
    // Үнийн range — тоо болгож parse, буруу/сөрөг утга алгасна.
    const parsePrice = (v?: string): number | undefined => {
      if (v === undefined || v === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };
    return this.productsService.findPublished(
      {
        page: page ? parseInt(page, 10) : undefined,
        pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
        categorySlug,
        featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
        types: typeFilter,
        sortBy: (sortBy as any) ?? undefined,
        onSale: onSale === 'true' ? true : undefined,
        minPrice: parsePrice(minPrice),
        maxPrice: parsePrice(maxPrice),
      },
      adminCtx(user),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('search')
  search(
    @CurrentUser() user?: JwtPayload,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.productsService.search(
      q ?? '',
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 12,
      adminCtx(user),
    );
  }

  // "Танд санал болгох" (personalized). Нэвтэрсэн бол userId-аар (view+худалдан авалт),
  // зочин бол viewedIds (localStorage-ийн саяхан үзсэн) query-аар category/type тогтооно.
  // ⚠️ ':slug'-ийн ӨМНӨ байх ёстой — эс бол 'recommended' нь slug гэж андуурагдана.
  @UseGuards(OptionalJwtAuthGuard)
  @Get('recommended')
  recommended(
    @CurrentUser() user?: JwtPayload,
    @Query('viewedIds') viewedIds?: string,
    @Query('limit') limit?: string,
  ) {
    const ids = viewedIds
      ? viewedIds.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 24)
      : [];
    return this.productsService.getRecommended(
      user?.sub,
      ids,
      limit ? Math.min(24, Math.max(1, parseInt(limit, 10))) : 8,
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':slug/suggested')
  suggested(
    @Param('slug') slug: string,
    @CurrentUser() user?: JwtPayload,
    @Query('count') count?: string,
  ) {
    return this.productsService.findSuggested(
      slug,
      count ? parseInt(count, 10) : 8,
      adminCtx(user),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':slug')
  bySlug(@Param('slug') slug: string, @CurrentUser() user?: JwtPayload) {
    return this.productsService.findBySlug(slug, adminCtx(user));
  }
}
