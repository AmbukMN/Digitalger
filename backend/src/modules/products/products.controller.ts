import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') categorySlug?: string,
    @Query('featured') featured?: string,
    @Query('type') type?: string,
  ) {
    return this.productsService.findPublished({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      categorySlug,
      featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      type,
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
    return this.productsService.findSuggested(slug, count ? parseInt(count, 10) : 4);
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }
}
