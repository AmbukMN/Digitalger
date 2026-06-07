import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as XLSX from 'xlsx';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { OrderStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { AdminProductsService } from './admin-products.service';
import { AdminAiService } from './admin-ai.service';
import { CategoriesService } from '../categories/categories.service';
import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { EmailService } from '../notifications/email.service';
import { AppCacheService, CacheKeys } from '../../common/cache/app-cache.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  CreateLessonDto,
  UpdateLessonDto,
  StreamUploadDto,
  CreateLessonResourceDto,
  ReorderLessonResourcesDto,
} from './dto/lesson.dto';
import { CreateCategoryDto } from '../categories/dto/create-category.dto';
import { UpdateCategoryDto } from '../categories/dto/update-category.dto';
import { UpsertQuizDto } from '../courses/dto/quiz.dto';
import { AddAnswerDto } from '../courses/dto/qa.dto';
import { UpdateSiteDto, UpdateThemeDto } from './dto/update-settings.dto';
import { ZIP_QUEUE } from '../downloads/zip.processor';

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
    private readonly storage: StorageService,
    @InjectQueue(ZIP_QUEUE) private readonly zipQueue: Queue,
    private readonly emailService: EmailService,
    private readonly cache: AppCacheService,
  ) {}

  @Get('dashboard')
  async dashboard() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOf3MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const [
      usersCount,
      productsCount,
      ordersCount,
      revenueAgg,
      recentOrders,
      ordersThisMonth,
      newUsersThisMonth,
      monthlyRevenue,
      emailStats,
      resendStats,
      pendingExpiredCount,
      totalDownloadsAgg,
      topDownloadedRaw,
      // ── Тренд: өмнөх сартай харьцуулах тоонууд ──
      ordersPrevMonth,
      usersPrevMonth,
      revenueThisMonthAgg,
      revenuePrevMonthAgg,
      subscribersTotalRaw,
      subscribersThisMonth,
      subscribersBySourceRaw,
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
          user: { select: { id: true, email: true, name: true, image: true } },
          items: {
            include: {
              product: {
                select: {
                  title: true,
                  slug: true,
                  previewUrl: true,
                  price: true,
                  compareAtPrice: true,
                  discountEndsAt: true,
                  downloadCount: true,
                  images: { where: { isPrimary: true }, take: 1, select: { fileKey: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.order.count({
        where: { createdAt: { gte: startOfMonth }, status: 'PAID' },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.prisma.order.groupBy({
        by: ['createdAt'],
        where: {
          status: 'PAID',
          createdAt: { gte: startOf3MonthsAgo },
        },
        _sum: { total: true },
      }),
      this.emailService.getStats(),
      this.emailService.getResendStats(),
      this.prisma.order.count({
        where: { status: 'PENDING', createdAt: { lt: cutoff48h } },
      }),
      // Бодит таталтын статистик (хэрэглэгчид татсан жинхэнэ тоо)
      this.prisma.product.aggregate({ _sum: { realDownloadCount: true } }),
      this.prisma.product.findMany({
        where: { realDownloadCount: { gt: 0 } },
        orderBy: { realDownloadCount: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          type: true,
          price: true,
          realDownloadCount: true,
          category: { select: { name: true } },
          images: { where: { isPrimary: true }, take: 1, select: { fileKey: true } },
        },
      }),
      // ── Тренд тооцоолох query-нүүд (өмнөх сар) ──
      this.prisma.order.count({
        where: {
          status: 'PAID',
          createdAt: { gte: startOfPrevMonth, lt: startOfMonth },
        },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfPrevMonth, lt: startOfMonth } },
      }),
      this.prisma.order.aggregate({
        where: { status: 'PAID', createdAt: { gte: startOfMonth } },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: {
          status: 'PAID',
          createdAt: { gte: startOfPrevMonth, lt: startOfMonth },
        },
        _sum: { total: true },
      }),
      // ── Subscriber статистик (нийт + энэ сар + эх сурвалжаар) ──
      this.prisma.subscriber.count(),
      this.prisma.subscriber.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.subscriber.groupBy({ by: ['source'], _count: { _all: true } }),
    ]);

    // Subscriber тоонуудыг задлах (Promise.all-ийн сүүлийн 3 утга)
    const subscribersTotal = subscribersTotalRaw;
    const subBySource = subscribersBySourceRaw
      .map((r) => ({ source: r.source ?? 'бусад', count: r._count._all }))
      .sort((a, b) => b.count - a.count);

    // Өсөлтийн хувь тооцоолох туслах (өмнөх 0 бол: одоо >0 → +100%, тэнцүү → 0)
    const pct = (current: number, prev: number): number | null => {
      if (prev === 0) return current > 0 ? 100 : null;
      return Math.round(((current - prev) / prev) * 100);
    };

    const revenueThisMonth = Number(revenueThisMonthAgg._sum.total ?? 0);
    const revenuePrevMonth = Number(revenuePrevMonthAgg._sum.total ?? 0);

    const trends = {
      orders: pct(ordersThisMonth, ordersPrevMonth),
      users: pct(newUsersThisMonth, usersPrevMonth),
      revenue: pct(revenueThisMonth, revenuePrevMonth),
    };

    // Сар бүрийн орлогыг тооцоолно
    const monthlyRevenueMap: Record<string, number> = {};
    for (const row of monthlyRevenue) {
      const d = new Date(row.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyRevenueMap[key] = (monthlyRevenueMap[key] ?? 0) + Number(row._sum.total ?? 0);
    }
    const monthlyRevenueSummary = Object.entries(monthlyRevenueMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));

    const mapOrderImages = (orders: typeof recentOrders) =>
      orders.map((o) => ({
        ...o,
        items: o.items.map((item) => ({
          ...item,
          product: {
            ...item.product,
            previewUrl:
              item.product.images?.[0]?.fileKey
                ? this.storage.getAssetUrl(item.product.images[0].fileKey)
                : item.product.previewUrl,
            images: undefined,
          },
        })),
      }));

    // Топ татагдсан бүтээгдэхүүний зураг URL-ийг бэлдэнэ
    const topDownloaded = topDownloadedRaw.map((p) => ({
      id: p.id,
      title: p.title,
      type: p.type,
      categoryName: p.category?.name ?? null,
      price: p.price,
      realDownloadCount: p.realDownloadCount,
      imageUrl: p.images?.[0]?.fileKey ? this.storage.getAssetUrl(p.images[0].fileKey) : null,
    }));

    return {
      stats: {
        users: usersCount,
        products: productsCount,
        orders: ordersCount,
        revenue: revenueAgg._sum.total ?? 0,
        ordersThisMonth,
        newUsersThisMonth,
        pendingExpiredCount,
        totalRealDownloads: totalDownloadsAgg._sum.realDownloadCount ?? 0,
        revenueThisMonth,
        subscribersTotal,
        subscribersThisMonth,
      },
      subscribersBySource: subBySource,
      trends,
      recentOrders: mapOrderImages(recentOrders),
      monthlyRevenue: monthlyRevenueSummary,
      emailStats,
      resendStats,
      topDownloaded,
    };
  }

  @Get('ai/status')
  getAiStatus() {
    return { enabled: this.adminAi.isEnabled() };
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

  @Post('products/bulk-import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async bulkImportProducts(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл сонгоогүй байна');
    const ext = file.originalname.toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls') && !ext.endsWith('.csv')) {
      throw new BadRequestException('Зөвхөн .xlsx, .xls, .csv файл зөвшөөрнө');
    }
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!rows.length) throw new BadRequestException('Файл хоосон байна');

    const results: { row: number; status: 'created' | 'error'; title?: string; error?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const title = String(r['title'] ?? r['нэр'] ?? r['Title'] ?? '').trim();
      const price = parseFloat(String(r['price'] ?? r['үнэ'] ?? r['Price'] ?? '0'));
      const type = String(r['type'] ?? r['төрөл'] ?? r['Type'] ?? 'file').trim() || 'file';
      if (!title) { results.push({ row: i + 2, status: 'error', error: 'title хоосон' }); continue; }
      if (isNaN(price)) { results.push({ row: i + 2, status: 'error', error: 'price буруу' }); continue; }
      try {
        const slug = title
          .toLowerCase()
          .replace(/[^a-z0-9а-яөүё\s-]/gi, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 80) + '-' + Date.now() + '-' + i;
        await this.adminProducts.create({
          title,
          slug,
          description: String(r['description'] ?? r['тайлбар'] ?? r['Description'] ?? ''),
          price,
          compareAtPrice: parseFloat(String(r['compareAtPrice'] ?? r['comparePrice'] ?? '')) || undefined,
          type,
          published: String(r['published'] ?? r['Published'] ?? 'false').toLowerCase() === 'true',
          featured: String(r['featured'] ?? r['Featured'] ?? 'false').toLowerCase() === 'true',
        } as any);
        results.push({ row: i + 2, status: 'created', title });
      } catch (err: any) {
        results.push({ row: i + 2, status: 'error', title, error: err?.message ?? 'Алдаа' });
      }
    }

    const created = results.filter((r) => r.status === 'created').length;
    const failed = results.filter((r) => r.status === 'error').length;
    return { total: rows.length, created, failed, results };
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
    @Body() body: {
      fileKey?: string;
      videoUrl?: string;
      alt?: string;
      isPrimary?: boolean;
      variants?: { size: string; fileKey: string; width: number; height: number; bytes: number }[];
    },
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
        variants: body.variants?.length
          ? {
              createMany: {
                data: body.variants.map((v) => ({
                  size: v.size,
                  fileKey: v.fileKey,
                  width: v.width,
                  height: v.height,
                  bytes: v.bytes,
                  mimeType: 'image/webp',
                })),
              },
            }
          : undefined,
      },
      include: { variants: true },
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
    @Body() body: CreateLessonDto,
  ) {
    return this.adminProducts.createLesson(id, body);
  }

  @Patch('products/:id/lessons/:lessonId')
  updateProductLesson(
    @Param('lessonId') lessonId: string,
    @Body() body: UpdateLessonDto,
  ) {
    return this.adminProducts.updateLesson(lessonId, body);
  }

  // Cloudflare Stream — хичээлийн видео шууд upload (browser→Stream).
  @Post('products/:id/lessons/stream-upload')
  createLessonStreamUpload(@Body() body: StreamUploadDto) {
    return this.adminProducts.createStreamUpload({
      name: body.name,
      maxDurationSeconds: body.maxDurationSeconds,
    });
  }

  // Upload дууссаны дараа боловсруулалтын төлөв шалгах.
  @Get('products/:id/lessons/stream-status/:uid')
  getLessonStreamStatus(@Param('uid') uid: string) {
    return this.adminProducts.getStreamStatus(uid);
  }

  @Delete('products/:id/lessons/:lessonId')
  deleteProductLesson(@Param('lessonId') lessonId: string) {
    return this.adminProducts.deleteLesson(lessonId);
  }

  @Put('products/:id/lessons/reorder')
  reorderProductLessons(@Body() body: { items: { id: string; sortOrder: number }[] }) {
    return this.adminProducts.reorderLessons(body.items);
  }

  // Lesson Resources (хичээлийн хавсралт файл — PDF/материал)
  @Get('products/:id/lessons/:lessonId/resources')
  listLessonResources(@Param('lessonId') lessonId: string) {
    return this.adminProducts.listLessonResources(lessonId);
  }

  @Post('products/:id/lessons/:lessonId/resources')
  addLessonResource(
    @Param('lessonId') lessonId: string,
    @Body() body: CreateLessonResourceDto,
  ) {
    return this.adminProducts.addLessonResource(lessonId, body);
  }

  @Put('products/:id/lessons/:lessonId/resources/reorder')
  reorderLessonResources(@Body() body: ReorderLessonResourcesDto) {
    return this.adminProducts.reorderLessonResources(body.items);
  }

  @Delete('products/:id/lessons/:lessonId/resources/:resourceId')
  deleteLessonResource(@Param('resourceId') resourceId: string) {
    return this.adminProducts.removeLessonResource(resourceId);
  }

  // Product Files
  @Get('products/:id/files')
  listProductFiles(@Param('id') id: string) {
    return this.adminProducts.listFiles(id);
  }

  @Post('files/by-ids')
  getFilesByIds(@Body() body: { ids: string[] }) {
    return this.prisma.productFile.findMany({
      where: { id: { in: body.ids } },
    });
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

  @Patch('products/:id/download-file')
  async setProductDownloadFile(
    @Param('id') id: string,
    @Body('downloadFileKey') downloadFileKey: string | null,
  ) {
    return this.prisma.product.update({
      where: { id },
      data: { downloadFileKey: downloadFileKey ?? null },
      select: { id: true, downloadFileKey: true },
    });
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
          user: { select: { id: true, email: true, name: true, image: true } },
          items: {
            include: {
              product: {
                select: {
                  title: true,
                  slug: true,
                  previewUrl: true,
                  price: true,
                  images: { where: { isPrimary: true }, take: 1, select: { fileKey: true } },
                },
              },
            },
          },
          payments: true,
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    const mappedItems = items.map((o) => ({
      ...o,
      items: o.items.map((item) => ({
        ...item,
        product: {
          ...item.product,
          previewUrl:
            item.product.images?.[0]?.fileKey
              ? this.storage.getAssetUrl(item.product.images[0].fileKey)
              : item.product.previewUrl,
          images: undefined,
        },
      })),
    }));

    return { items: mappedItems, total, page: p, pageSize: ps };
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

  @Get('payments')
  async listPayments(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    const p = Math.max(1, page ? parseInt(page, 10) : 1);
    const ps = Math.min(100, pageSize ? parseInt(pageSize, 10) : 20);
    const skip = (p - 1) * ps;

    const where = status && status !== 'ALL'
      ? { status: status as 'PENDING' | 'SUCCESS' | 'FAILED' }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: ps,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            include: {
              user: { select: { id: true, email: true, name: true, image: true } },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items, total, page: p, pageSize: ps };
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

  // Хэрэглэгчийн ДЭЛГЭРЭНГҮЙ — popup-д бүх дата (захиалга/татсан/үзсэн/
  // дарсан/төхөөрөмж/аккаунт түүх) нэг дуудлагаар.
  @Get('users/:id/detail')
  getUserDetail(@Param('id') id: string) {
    return this.users.getUserDetail(id);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body()
    body: { name?: string; role?: string; image?: string; phone?: string; email?: string },
    @CurrentUser() me: JwtPayload,
  ) {
    // Админ нь нэр/утас/email/role-ийг verify-гүйгээр ШУУД засна.
    return this.users.updateByAdmin(id, body, me.sub);
  }

  // Админ хэрэглэгчийн нууц үгийг ШУУД тохируулна (одоогийн нууц үг шаардахгүй)
  @Patch('users/:id/password')
  setUserPassword(
    @Param('id') id: string,
    @Body() body: { newPassword: string },
    @CurrentUser() me: JwtPayload,
  ) {
    return this.users.setPasswordByAdmin(id, body.newPassword, me.sub);
  }

  @Patch('users/:id/block')
  blockUser(
    @Param('id') id: string,
    @Body() body: { blocked: boolean },
    @CurrentUser() me: JwtPayload,
  ) {
    return this.users.blockUser(id, body.blocked, me.sub);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string, @CurrentUser() me: JwtPayload) {
    return this.users.deleteUser(id, me.sub);
  }

  // ── Хэрэглэгчид бүтээгдэхүүн ҮНЭГҮЙ идэвхжүүлэх (admin grant) ──────────────
  /** Сонгосон бүтээгдэхүүнүүдийг хэрэглэгчид үнэгүй идэвхжүүлнэ (Миний санд орно) */
  @Post('users/:id/grant-products')
  grantProducts(
    @Param('id') id: string,
    @Body() body: { productIds: string[] },
    @CurrentUser() me: JwtPayload,
  ) {
    return this.users.grantProductsToUser(id, body.productIds ?? [], me.sub);
  }

  /** Хэрэглэгчид админаас идэвхжүүлсэн бүтээгдэхүүний жагсаалт */
  @Get('users/:id/granted-products')
  listGrantedProducts(@Param('id') id: string) {
    return this.users.listGrantedProducts(id);
  }

  /** Админаас идэвхжүүлсэн бүтээгдэхүүнийг цуцлах (зөвхөн ADMIN_GRANT) */
  @Delete('users/:id/granted-products/:productId')
  revokeGrantedProduct(@Param('id') id: string, @Param('productId') productId: string) {
    return this.users.revokeGrantedProduct(id, productId);
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
  async updateTheme(@Body() dto: UpdateThemeDto) {
    const res = await this.prisma.themeSetting.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...dto },
      update: dto,
    });
    await this.cache.del(CacheKeys.publicSettings);
    return res;
  }

  @Put('settings/site')
  async updateSite(@Body() dto: UpdateSiteDto) {
    const res = await this.prisma.siteSetting.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...dto },
      update: dto,
    });
    await this.cache.del(CacheKeys.publicSettings);
    return res;
  }

  // Product Type Config
  @Get('product-types')
  listProductTypes() {
    return this.prisma.productTypeConfig.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Post('product-types')
  async createProductType(
    @Body() dto: { value: string; label: string; description?: string; icon?: string; sortOrder?: number; active?: boolean },
  ) {
    const res = await this.prisma.productTypeConfig.create({ data: dto });
    await this.cache.del(CacheKeys.productTypes);
    return res;
  }

  @Patch('product-types/:id')
  async updateProductType(
    @Param('id') id: string,
    @Body() dto: { label?: string; description?: string; icon?: string; sortOrder?: number; active?: boolean },
  ) {
    const res = await this.prisma.productTypeConfig.update({ where: { id }, data: dto });
    await this.cache.del(CacheKeys.productTypes);
    return res;
  }

  @Delete('product-types/:id')
  async deleteProductType(@Param('id') id: string) {
    const res = await this.prisma.productTypeConfig.delete({ where: { id } });
    await this.cache.del(CacheKeys.productTypes);
    return res;
  }

  // ── Quiz (хичээлийн шалгалт) ─────────────────────────────────────────────

  @Get('products/:id/lessons/:lessonId/quiz')
  getLessonQuiz(@Param('lessonId') lessonId: string) {
    return this.adminProducts.getQuiz(lessonId);
  }

  @Post('products/:id/lessons/:lessonId/quiz')
  createLessonQuiz(
    @Param('lessonId') lessonId: string,
    @Body() body: UpsertQuizDto,
  ) {
    return this.adminProducts.createQuiz(lessonId, body);
  }

  // PUT — upsert (admin UI хадгалах товч). Quiz байгаа бол update, эс бол create.
  @Put('products/:id/lessons/:lessonId/quiz')
  async upsertLessonQuiz(
    @Param('lessonId') lessonId: string,
    @Body() body: UpsertQuizDto,
  ) {
    const existing = await this.adminProducts.getQuiz(lessonId);
    return existing
      ? this.adminProducts.updateQuiz(lessonId, body)
      : this.adminProducts.createQuiz(lessonId, body);
  }

  @Patch('products/:id/lessons/:lessonId/quiz')
  updateLessonQuiz(
    @Param('lessonId') lessonId: string,
    @Body() body: UpsertQuizDto,
  ) {
    return this.adminProducts.updateQuiz(lessonId, body);
  }

  @Delete('products/:id/lessons/:lessonId/quiz')
  deleteLessonQuiz(@Param('lessonId') lessonId: string) {
    return this.adminProducts.deleteQuiz(lessonId);
  }

  // ── Lesson Q&A модерац ────────────────────────────────────────────────────

  @Get('lessons/questions')
  listLessonQuestions(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('onlyUnanswered') onlyUnanswered?: string,
  ) {
    return this.adminProducts.listAllQuestions({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      onlyUnanswered: onlyUnanswered === 'true' || onlyUnanswered === '1',
    });
  }

  // Нэг хичээлийн асуултууд (LessonRow модерацид)
  @Get('products/:id/lessons/:lessonId/questions')
  listOneLessonQuestions(@Param('lessonId') lessonId: string) {
    return this.adminProducts.listLessonQuestions(lessonId);
  }

  @Post('lessons/questions/:questionId/answers')
  answerLessonQuestion(
    @Param('questionId') questionId: string,
    @Body() body: AddAnswerDto,
    @CurrentUser() me: JwtPayload,
  ) {
    return this.adminProducts.answerQuestion(questionId, me.sub, body.answer);
  }

  @Patch('lessons/questions/:questionId/pin')
  pinLessonQuestion(
    @Param('questionId') questionId: string,
    @Body('isPinned') isPinned: boolean,
  ) {
    return this.adminProducts.pinQuestion(questionId, isPinned);
  }

  @Delete('lessons/questions/:questionId')
  deleteLessonQuestion(@Param('questionId') questionId: string) {
    return this.adminProducts.deleteQuestion(questionId);
  }

  @Delete('lessons/answers/:answerId')
  deleteLessonAnswer(@Param('answerId') answerId: string) {
    return this.adminProducts.deleteAnswer(answerId);
  }

  // ── Queue Monitoring ─────────────────────────────────────────────────────

  @Get('queue/status')
  async getQueueStatus() {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      this.zipQueue.getWaitingCount(),
      this.zipQueue.getActiveCount(),
      this.zipQueue.getCompletedCount(),
      this.zipQueue.getFailedCount(),
      this.zipQueue.getDelayedCount(),
      this.zipQueue.getPausedCount(),
    ]);

    const isPaused = await this.zipQueue.isPaused();

    const [recentFailed, recentCompleted] = await Promise.all([
      this.zipQueue.getFailed(0, 9),
      this.zipQueue.getCompleted(0, 9),
    ]);

    const [dbPending, dbProcessing, dbDone, dbFailed] = await Promise.all([
      this.prisma.zipJob.count({ where: { status: 'PENDING' } }),
      this.prisma.zipJob.count({ where: { status: 'PROCESSING' } }),
      this.prisma.zipJob.count({ where: { status: 'DONE' } }),
      this.prisma.zipJob.count({ where: { status: 'FAILED' } }),
    ]);

    return {
      queue: {
        name: ZIP_QUEUE,
        isPaused,
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
      },
      db: {
        pending: dbPending,
        processing: dbProcessing,
        done: dbDone,
        failed: dbFailed,
      },
      recentFailed: recentFailed.map((j) => ({
        id: j.id,
        data: j.data,
        failedReason: j.failedReason,
        timestamp: j.timestamp,
        processedOn: j.processedOn,
        finishedOn: j.finishedOn,
      })),
      recentCompleted: recentCompleted.map((j) => ({
        id: j.id,
        data: j.data,
        returnvalue: j.returnvalue,
        timestamp: j.timestamp,
        processedOn: j.processedOn,
        finishedOn: j.finishedOn,
      })),
    };
  }

  @Post('queue/retry-failed')
  async retryFailedJobs() {
    const failed = await this.zipQueue.getFailed(0, 99);
    await Promise.all(failed.map((job) => job.retry()));
    return { retried: failed.length };
  }

  @Delete('queue/clean')
  async cleanQueue() {
    await Promise.all([
      this.zipQueue.clean(0, 'completed'),
      this.zipQueue.clean(0, 'failed'),
    ]);
    return { success: true };
  }
}
