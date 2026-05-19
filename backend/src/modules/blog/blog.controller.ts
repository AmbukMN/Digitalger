import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { BlogService, CreateBlogPostDto, UpdateBlogPostDto } from './blog.service';

@Controller('blog')
export class BlogPublicController {
  constructor(private readonly service: BlogService) {}

  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('tag') tag?: string) {
    return this.service.findAllPublished({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 12,
      tag,
    });
  }

  @Get('latest')
  latest(@Query('count') count?: string) {
    return this.service.findLatest(count ? parseInt(count) : 3);
  }

  @Get('search')
  search(@Query('q') q?: string) {
    if (!q?.trim()) return [];
    return this.service.search(q.trim());
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }
}

@Controller('admin/blog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class BlogAdminController {
  constructor(private readonly service: BlogService) {}

  @Get()
  adminList() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateBlogPostDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
