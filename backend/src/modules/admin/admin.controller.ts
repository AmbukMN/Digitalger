import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminProductsService } from './admin-products.service';
import { AdminAiService } from './admin-ai.service';
import { CategoriesService } from '../categories/categories.service';
import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto } from '../categories/dto/create-category.dto';
import { UpdateCategoryDto } from '../categories/dto/update-category.dto';
import { UpdateSiteDto, UpdateThemeDto } from './dto/update-settings.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly adminProducts: AdminProductsService,
    private readonly adminAi: AdminAiService,
    private readonly categories: CategoriesService,
    private readonly orders: OrdersService,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('dashboard')
  async dashboard() {
    const [
      usersCount,
      productsCount,
      ordersCount,
      revenueAgg,
      recentOrders,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.product.count(),
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        where: { status: 'PAID' },
        _sum: { total: true },
      }),
      this.prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, name: true } },
          items: { include: { product: { select: { title: true } } } },
        },
      }),
    ]);

    return {
      stats: {
        users: usersCount,
        products: productsCount,
        orders: ordersCount,
        revenue: revenueAgg._sum.total ?? 0,
      },
      recentOrders,
    };
  }

  // AI generate
  @Post('products/generate')
  generateProduct(
    @Body()
    body: {
      fileNames: string[];
      fileTypes: string[];
      productType: string;
      categoryName?: string;
    },
  ) {
    return this.adminAi.generateProductContent(body);
  }

  // Products
  @Get('products')
  listProducts(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.adminProducts.findAll({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      search,
    });
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.adminProducts.findOne(id);
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.adminProducts.create(dto);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.adminProducts.update(id, dto);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.adminProducts.remove(id);
  }

  @Post('products/:id/clone')
  cloneProduct(@Param('id') id: string) {
    return this.adminProducts.clone(id);
  }

  // Product Gallery (images + video entries)
  @Get('products/:id/images')
  listProductImages(@Param('id') id: string) {
    return this.adminProducts.listImages(id);
  }

  @Post('products/:id/images')
  async addProductImage(
    @Param('id') id: string,
    @Body() body: { fileKey?: string; videoUrl?: string; alt?: string; isPrimary?: boolean },
  ) {
    const count = await this.prisma.productImage.count({ where: { productId: id } });
    return this.prisma.productImage.create({
      data: {
        productId: id,
        fileKey: body.fileKey ?? '',
        videoUrl: body.videoUrl,
        alt: body.alt,
        isPrimary: body.isPrimary ?? false,
        sortOrder: count,
      },
    });
  }

  @Patch('products/:id/images/:imageId')
  async updateProductImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body() body: { alt?: string; isPrimary?: boolean; sortOrder?: number },
  ) {
    if (body.isPrimary) {
      await this.prisma.productImage.updateMany({ where: { productId: id }, data: { isPrimary: false } });
    }
    return this.prisma.productImage.update({ where: { id: imageId }, data: body });
  }

  @Delete('products/:id/images/:imageId')
  async deleteProductImage(@Param('imageId') imageId: string) {
    return this.prisma.productImage.delete({ where: { id: imageId } });
  }

  @Put('products/:id/images/reorder')
  async reorderProductImages(
    @Body() body: { items: { id: string; sortOrder: number }[] },
  ) {
    await Promise.all(
      body.items.map((item) =>
        this.prisma.productImage.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } }),
      ),
    );
    return { success: true };
  }

  // Course Modules
  @Get('products/:id/modules')
  listProductModules(@Param('id') id: string) {
    return this.adminProducts.listModules(id);
  }

  @Post('products/:id/modules')
  createProductModule(
    @Param('id') id: string,
    @Body() body: { title: string; sortOrder?: number },
  ) {
    return this.adminProducts.createModule(id, body);
  }

  @Patch('products/:id/modules/:moduleId')
  updateProductModule(
    @Param('moduleId') moduleId: string,
    @Body() body: Partial<{ title: string; sortOrder: number }>,
  ) {
    return this.adminProducts.updateModule(moduleId, body);
  }

  @Delete('products/:id/modules/:moduleId')
  deleteProductModule(@Param('moduleId') moduleId: string) {
    return this.adminProducts.deleteModule(moduleId);
  }

  @Put('products/:id/modules/reorder')
  reorderProductModules(@Body() body: { items: { id: string; sortOrder: number }[] }) {
    return this.adminProducts.reorderModules(body.items);
  }

  // Course Lessons
  @Get('products/:id/lessons')
  listProductLessons(@Param('id') id: string) {
    return this.adminProducts.listLessons(id);
  }

  @Post('products/:id/lessons')
  createProductLesson(
    @Param('id') id: string,
    @Body() body: { title: string; description?: string; videoUrl?: string; videoKey?: string; durationSec?: number; isFreePreview?: boolean; sortOrder?: number; moduleId?: string },
  ) {
    return this.adminProducts.createLesson(id, body);
  }

  @Patch('products/:id/lessons/:lessonId')
  updateProductLesson(
    @Param('lessonId') lessonId: string,
    @Body() body: Partial<{ title: string; description: string; videoUrl: string; videoKey: string; durationSec: number; isFreePreview: boolean; sortOrder: number; moduleId: string | null }>,
  ) {
    return this.adminProducts.updateLesson(lessonId, body);
  }

  @Delete('products/:id/lessons/:lessonId')
  deleteProductLesson(@Param('lessonId') lessonId: string) {
    return this.adminProducts.deleteLesson(lessonId);
  }

  @Put('products/:id/lessons/reorder')
  reorderProductLessons(@Body() body: { items: { id: string; sortOrder: number }[] }) {
    return this.adminProducts.reorderLessons(body.items);
  }

  // Product Files
  @Get('products/:id/files')
  listProductFiles(@Param('id') id: string) {
    return this.adminProducts.listFiles(id);
  }

  @Post('products/:id/files')
  async addProductFile(
    @Param('id') id: string,
    @Body() body: { fileKey: string; fileName: string; mimeType?: string; sizeBytes?: number },
  ) {
    const count = await this.prisma.productFile.count({ where: { productId: id } });
    return this.prisma.productFile.create({
      data: {
        productId: id,
        fileKey: body.fileKey,
        fileName: body.fileName,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        sortOrder: count,
      },
    });
  }

  @Delete('products/:id/files/:fileId')
  async deleteProductFile(@Param('fileId') fileId: string) {
    return this.prisma.productFile.delete({ where: { id: fileId } });
  }

  // Categories
  @Get('categories')
  listCategories() {
    return this.categories.findAll();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.categories.remove(id);
  }

  // Orders
  @Get('orders')
  async listOrders(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const p = Math.max(1, page ? parseInt(page, 10) : 1);
    const ps = Math.min(100, pageSize ? parseInt(pageSize, 10) : 20);
    const skip = (p - 1) * ps;

    const statusFilter = status && status !== 'ALL'
      ? { status: status as 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED' }
      : {};

    const searchFilter = search?.trim()
      ? {
          OR: [
            { id: { contains: search.trim(), mode: 'insensitive' as const } },
            { user: { email: { contains: search.trim(), mode: 'insensitive' as const } } },
            { user: { name: { contains: search.trim(), mode: 'insensitive' as const } } },
          ],
        }
      : {};

    const where = { ...statusFilter, ...searchFilter };

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: ps,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, name: true } },
          items: { include: { product: { select: { title: true, slug: true } } } },
          payments: true,
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total, page: p, pageSize: ps };
  }

  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    return this.orders.findById(id);
  }

  @Patch('orders/:id/status')
  updateOrderStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
  ) {
    return this.prisma.order.update({
      where: { id },
      data: { status },
    });
  }

  @Patch('orders/:id')
  updateOrder(
    @Param('id') id: string,
    @Body() body: { status?: OrderStatus; couponCode?: string | null },
  ) {
    const data: Record<string, unknown> = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.couponCode !== undefined) data.couponCode = body.couponCode ?? null;
    return this.prisma.order.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, email: true, name: true } },
        items: { include: { product: { select: { title: true, slug: true } } } },
        payments: true,
      },
    });
  }

  @Delete('orders/:id')
  async deleteOrder(@Param('id') id: string) {
    await this.prisma.$transaction([
      this.prisma.payment.deleteMany({ where: { orderId: id } }),
      this.prisma.orderItem.deleteMany({ where: { orderId: id } }),
      this.prisma.order.delete({ where: { id } }),
    ]);
    return { success: true };
  }

  @Patch('payments/:id')
  updatePayment(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.prisma.payment.update({
      where: { id },
      data: { status: status as 'PENDING' | 'SUCCESS' | 'FAILED' },
    });
  }

  @Delete('payments/:id')
  async deletePayment(@Param('id') id: string) {
    await this.prisma.payment.delete({ where: { id } });
    return { success: true };
  }

  // Users
  @Get('users')
  listUsers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.users.findAllAdmin({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      search,
    });
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.users.findOneAdmin(id);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() body: { name?: string; role?: string; image?: string },
  ) {
    return this.users.updateByAdmin(id, body);
  }

  // Settings
  @Get('settings')
  async getSettings() {
    const [theme, site] = await Promise.all([
      this.prisma.themeSetting.findUnique({ where: { id: 'default' } }),
      this.prisma.siteSetting.findUnique({ where: { id: 'default' } }),
    ]);

    return { theme, site };
  }

  @Put('settings/theme')
  updateTheme(@Body() dto: UpdateThemeDto) {
    return this.prisma.themeSetting.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...dto },
      update: dto,
    });
  }

  @Put('settings/site')
  updateSite(@Body() dto: UpdateSiteDto) {
    return this.prisma.siteSetting.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...dto },
      update: dto,
    });
  }

  // Product Type Config
  @Get('product-types')
  listProductTypes() {
    return this.prisma.productTypeConfig.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Post('product-types')
  createProductType(
    @Body() dto: { value: string; label: string; description?: string; icon?: string; sortOrder?: number; active?: boolean },
  ) {
    return this.prisma.productTypeConfig.create({ data: dto });
  }

  @Patch('product-types/:id')
  updateProductType(
    @Param('id') id: string,
    @Body() dto: { label?: string; description?: string; icon?: string; sortOrder?: number; active?: boolean },
  ) {
    return this.prisma.productTypeConfig.update({ where: { id }, data: dto });
  }

  @Delete('product-types/:id')
  deleteProductType(@Param('id') id: string) {
    return this.prisma.productTypeConfig.delete({ where: { id } });
  }
}
