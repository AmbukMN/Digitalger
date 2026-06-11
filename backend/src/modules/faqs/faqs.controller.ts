import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CreateFaqDto, FaqsService, UpdateFaqDto } from './faqs.service';

// Public: get FAQs for a product
@Controller('products/:productId/faqs')
export class FaqsPublicController {
  constructor(private readonly faqs: FaqsService) {}

  @Get()
  list(@Param('productId') productId: string) {
    return this.faqs.findByProductId(productId);
  }
}

// Admin: full CRUD + product assignment
@Controller('admin/faqs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class FaqsAdminController {
  constructor(private readonly faqs: FaqsService) {}

  @Get()
  list() {
    return this.faqs.findAll();
  }

  @Post()
  create(@Body() dto: CreateFaqDto, @CurrentUser() me: JwtPayload) {
    return this.faqs.create(dto, me.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFaqDto) {
    return this.faqs.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.faqs.remove(id);
  }

  // Get FAQ ids assigned to a product
  @Get('product/:productId')
  getProductFaqs(@Param('productId') productId: string) {
    return this.faqs.getProductFaqIds(productId);
  }

  // Assign FAQs to a product
  @Post('product/:productId')
  assignToProduct(
    @Param('productId') productId: string,
    @Body() body: { faqIds: string[] },
  ) {
    return this.faqs.assignToProduct(productId, body.faqIds);
  }
}
