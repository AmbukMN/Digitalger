import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import {
  CreateTestimonialDto,
  TestimonialsService,
  UpdateTestimonialDto,
} from './testimonials.service';

// Public: all active testimonials for home page
@Controller('testimonials')
export class TestimonialsPublicController {
  constructor(private readonly svc: TestimonialsService) {}

  @Get()
  list() {
    return this.svc.findAllActive();
  }

  @Get('product/:productId')
  byProduct(@Param('productId') productId: string) {
    return this.svc.findByProductId(productId);
  }
}

// Admin CRUD
@Controller('admin/testimonials')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class TestimonialsAdminController {
  constructor(private readonly svc: TestimonialsService) {}

  @Get()
  list() {
    return this.svc.findAll();
  }

  @Post()
  create(@Body() dto: CreateTestimonialDto, @CurrentUser() me: JwtPayload) {
    return this.svc.create(dto, me.sub);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTestimonialDto,
    @CurrentUser() me: JwtPayload,
  ) {
    return this.svc.update(id, dto, me);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() me: JwtPayload) {
    return this.svc.remove(id, me);
  }

  // Get testimonial ids assigned to product
  @Get('product/:productId')
  getForProduct(@Param('productId') productId: string) {
    return this.svc.getProductTestimonialIds(productId);
  }

  // Assign testimonials to product
  @Post('product/:productId')
  assignToProduct(
    @Param('productId') productId: string,
    @Body() body: { testimonialIds: string[] },
  ) {
    return this.svc.assignToProduct(productId, body.testimonialIds);
  }
}
