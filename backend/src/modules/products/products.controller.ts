import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Үзэлт +1 (public, frontend client-side нэг удаа дуудна)
  @Post(':slug/view')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  incrementView(@Param('slug') slug: string) {
    return this.productsService.incrementView(slug);
  }

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') categorySlug?: string,
    @Query('featured') featured?: string,
    @Query('type') type?: string,
    @Query('types') types?: string,
    @Query('sortBy') sortBy?: string,
    @Query('onSale') onSale?: string,
  ) {
    const typeFilter = types
      ? types.split(',').map((t) => t.trim()).filter(Boolean)
      : type
      ? [type]
      : undefined;
    return this.productsService.findPublished({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      categorySlug,
      featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      types: typeFilter,
      sortBy: (sortBy as any) ?? undefined,
      onSale: onSale === 'true' ? true : undefined,
    });
  }

  @Get('search')
  search(
    @Query('q') q: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.productsService.search(
      q ?? '',
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 12,
    );
  }

  @Get(':slug/suggested')
  suggested(@Param('slug') slug: string, @Query('count') count?: string) {
    return this.productsService.findSuggested(slug, count ? parseInt(count, 10) : 8);
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }
}
