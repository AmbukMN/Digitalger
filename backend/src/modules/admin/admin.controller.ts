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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as XLSX from 'xlsx';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { OrderStatus, PaymentStatus, Prisma, Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { assertOwner, assertCanDelete, isSuperadmin } from '../../common/ownership';
import { getMyPermissions } from '../../common/permission';
import { AdminProductsService } from './admin-products.service';
import { AdminAiService } from './admin-ai.service';
import { ReviewsService } from '../reviews/reviews.service';
import { CoursesService } from '../courses/courses.service';
import { CategoriesService } from '../categories/categories.service';
import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { EmailService } from '../notifications/email.service';
import { ReputationService } from '../notifications/reputation.service';
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
    private readonly reputation: ReputationService,
    private readonly cache: AppCacheService,
    private readonly reviews: ReviewsService,
    private readonly courses: CoursesService,
  ) {}

  // ─── Sidebar "шинэ" badge ─────────────────────────────────────────────────────
  // Admin хэсэг бүрт (orders/users/subscribers/reviews/payments) сүүлд харснаас хойш
  // үүссэн ШИНЭ бичлэгийн тоог буцаана. lessons-questions нь өөрийн adminUnread-аас.
  private readonly SIDEBAR_SECTIONS = [
    'orders',
    'users',
    'subscribers',
    'reviews',
    'payments',
  ] as const;

  @Get('sidebar-badges')
  async sidebarBadges(@CurrentUser() me: JwtPayload) {
    const adminId = me.sub;
    // Admin сүүлд харсан огноонууд (section→lastSeenAt). Байхгүй бол анх удаа =
    // бүх одоо байгааг "шинэ" гэж тооцохгүйн тулд default нь ОДОО (анх орох үед 0).
    const seens = await this.prisma.adminSeen.findMany({
      where: { adminId, section: { in: [...this.SIDEBAR_SECTIONS] } },
      select: { section: true, lastSeenAt: true },
    });
    const seenMap = new Map(seens.map((s) => [s.section, s.lastSeenAt]));
    // Анх удаа (seen бичлэггүй) бол ОДООГ суурь болгоно — хуучин бүх дата badge болж
    // спам гаргахгүй (зөвхөн ЭНЭ цэгээс хойшхи шинэ бичлэг тоологдоно).
    const fallback = new Date();
    const since = (section: string) => seenMap.get(section) ?? fallback;

    const [orders, users, subscribers, reviews, payments] = await Promise.all([
      this.prisma.order.count({ where: { createdAt: { gt: since('orders') } } }),
      // Зочин (isGuest) бус жинхэнэ шинэ бүртгэл
      this.prisma.user.count({
        where: { createdAt: { gt: since('users') }, isGuest: false },
      }),
      this.prisma.subscriber.count({ where: { createdAt: { gt: since('subscribers') } } }),
      this.prisma.review.count({ where: { createdAt: { gt: since('reviews') } } }),
      this.prisma.payment.count({ where: { createdAt: { gt: since('payments') } } }),
    ]);

    return { orders, users, subscribers, reviews, payments };
  }

  @Post('sidebar-seen/:section')
  async sidebarSeen(
    @CurrentUser() me: JwtPayload,
    @Param('section') section: string,
  ) {
    if (!(this.SIDEBAR_SECTIONS as readonly string[]).includes(section)) {
      return { success: false };
    }
    const lastSeenAt = new Date();
    await this.prisma.adminSeen.upsert({
      where: { adminId_section: { adminId: me.sub, section } },
      create: { adminId: me.sub, section, lastSeenAt },
      update: { lastSeenAt },
    });
    return { success: true, lastSeenAt };
  }

  @Get('dashboard')
  async dashboard(@CurrentUser() me: JwtPayload) {
    // ── Multi-tenant scope (Phase 5) ──
    //  SUPERADMIN → бүх дата; ADMIN/EDITOR → зөвхөн өөрийн product + холбоотой order.
    const sa = isSuperadmin(me);
    const myId = me.sub;

    // Product scope: шууд createdByUserId-аар.
    const productOwnerWhere: Prisma.ProductWhereInput = sa
      ? {}
      : { createdByUserId: myId };

    // Order scope: order шууд эзэнгүй тул ДАМ — order доторх item-ийн product эзэн.
    //   sa → {} ; бусад → энэ admin-ийн product-ыг агуулсан order.
    const orderOwnerWhere: Prisma.OrderWhereInput = sa
      ? {}
      : { items: { some: { product: { createdByUserId: myId } } } };

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
      reputationStats,
    ] = await Promise.all([
      // user.count нь SITE-LEVEL (бүх хэрэглэгч) — non-superadmin-д хамааралгүй → 0
      sa ? this.prisma.user.count() : Promise.resolve(0),
      this.prisma.product.count({ where: productOwnerWhere }),
      this.prisma.order.count({ where: orderOwnerWhere }),
      this.prisma.order.aggregate({
        where: { status: 'PAID', ...orderOwnerWhere },
        _sum: { total: true },
      }),
      this.prisma.order.findMany({
        take: 10,
        where: orderOwnerWhere,
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
        where: { createdAt: { gte: startOfMonth }, status: 'PAID', ...orderOwnerWhere },
      }),
      // newUsersThisMonth нь SITE-LEVEL → non-superadmin-д 0
      sa
        ? this.prisma.user.count({
            where: { createdAt: { gte: startOfMonth } },
          })
        : Promise.resolve(0),
      this.prisma.order.groupBy({
        by: ['createdAt'],
        where: {
          status: 'PAID',
          createdAt: { gte: startOf3MonthsAgo },
          ...orderOwnerWhere,
        },
        _sum: { total: true },
      }),
      // emailStats / resendStats нь SITE-LEVEL (имэйл маркетинг) → non-superadmin-д хоосон
      sa ? this.emailService.getStats() : Promise.resolve(null),
      sa ? this.emailService.getResendStats() : Promise.resolve(null),
      this.prisma.order.count({
        where: { status: 'PENDING', createdAt: { lt: cutoff48h }, ...orderOwnerWhere },
      }),
      // Бодит таталтын статистик (хэрэглэгчид татсан жинхэнэ тоо) — өөрийн product
      this.prisma.product.aggregate({
        where: productOwnerWhere,
        _sum: { realDownloadCount: true },
      }),
      this.prisma.product.findMany({
        where: { realDownloadCount: { gt: 0 }, ...productOwnerWhere },
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
          ...orderOwnerWhere,
        },
      }),
      // usersPrevMonth нь SITE-LEVEL → non-superadmin-д 0
      sa
        ? this.prisma.user.count({
            where: { createdAt: { gte: startOfPrevMonth, lt: startOfMonth } },
          })
        : Promise.resolve(0),
      this.prisma.order.aggregate({
        where: { status: 'PAID', createdAt: { gte: startOfMonth }, ...orderOwnerWhere },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: {
          status: 'PAID',
          createdAt: { gte: startOfPrevMonth, lt: startOfMonth },
          ...orderOwnerWhere,
        },
        _sum: { total: true },
      }),
      // ── Subscriber статистик нь SITE-LEVEL (бүх захиалагч) → non-superadmin-д 0/хоосон ──
      sa ? this.prisma.subscriber.count() : Promise.resolve(0),
      sa
        ? this.prisma.subscriber.count({ where: { createdAt: { gte: startOfMonth } } })
        : Promise.resolve(0),
      sa
        ? this.prisma.subscriber.groupBy({ by: ['source'], _count: { _all: true } })
        : Promise.resolve([] as { source: string | null; _count: { _all: number } }[]),
      // SES reputation (bounce/complaint rate) нь SITE-LEVEL → non-superadmin-д хоосон
      sa ? this.reputation.getReputationStats() : Promise.resolve(null),
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
      isSuperadmin: sa,
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
      reputationStats,
      topDownloaded,
    };
  }

  // ─── SES reputation (bounce/complaint rate) — dashboard карт + polling ─────────
  @Get('email/reputation')
  getReputationStats() {
    return this.reputation.getReputationStats();
  }

  @Get('ai/status')
  getAiStatus() {
    return { enabled: this.adminAi.isEnabled() };
  }

  // ─── Нэвтэрсэн admin өөрийн permission (frontend sidebar/UI эрхээр харуулах) ──
  // Бүх admin role (SUPERADMIN/ADMIN) хандана. SUPERADMIN бол бүх resource бүрэн эрх.
  @Get('me/permissions')
  myPermissions(@CurrentUser() me: JwtPayload) {
    return getMyPermissions(this.prisma, me);
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
    @CurrentUser() me: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.adminProducts.findAll(
      {
        page: page ? parseInt(page, 10) : undefined,
        pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
        search,
      },
      me,
    );
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string, @CurrentUser() me: JwtPayload) {
    return this.adminProducts.findOne(id, me);
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto, @CurrentUser() me: JwtPayload) {
    return this.adminProducts.create(dto, me.sub);
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
  updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() me: JwtPayload,
  ) {
    return this.adminProducts.update(id, dto, me);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string, @CurrentUser() me: JwtPayload) {
    return this.adminProducts.remove(id, me);
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
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() me: JwtPayload,
  ) {
    return this.categories.update(id, dto, me);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string, @CurrentUser() me: JwtPayload) {
    return this.categories.remove(id, me);
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
  async updateOrderStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
  ) {
    // Order статус солихдоо холбоотой Payment-ийг ч синк хийнэ (нэг захиалга
    // 2 өөр статустай болохоос сэргийлнэ). Атомик транзакц.
    const [order] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id },
        data: {
          status,
          // Админ гараар цуцалбал эх сурвалжийг тэмдэглэнэ (admin UI ялгана).
          ...(status === OrderStatus.CANCELLED
            ? { cancelledBy: 'ADMIN', cancelledAt: new Date() }
            : {}),
        },
      }),
      ...this.syncPaymentsForOrderStatus(id, status),
    ]);
    return order;
  }

  /** Order статусаас хамаарч Payment-ийг синк хийх transaction op-уудыг буцаана:
   *   - CANCELLED/FAILED → PENDING Payment-ууд FAILED (цуцлагдсан = амжилтгүй)
   *   - PAID            → бүх Payment SUCCESS (admin gift/manual идэвхжүүлэлт)
   * Бусад статус (PENDING/REFUNDED) → Payment-д хүрэхгүй. */
  private syncPaymentsForOrderStatus(orderId: string, status: OrderStatus) {
    if (status === OrderStatus.CANCELLED || status === OrderStatus.FAILED) {
      return [
        this.prisma.payment.updateMany({
          where: { orderId, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.FAILED },
        }),
      ];
    }
    if (status === OrderStatus.PAID) {
      return [
        this.prisma.payment.updateMany({
          where: { orderId, status: { not: PaymentStatus.SUCCESS } },
          data: { status: PaymentStatus.SUCCESS },
        }),
      ];
    }
    return [];
  }

  @Patch('orders/:id')
  async updateOrder(
    @Param('id') id: string,
    @Body() body: { status?: OrderStatus; couponCode?: string | null },
  ) {
    const data: Record<string, unknown> = {};
    if (body.status !== undefined) {
      data.status = body.status;
      // Админ гараар CANCELLED болгож байвал цуцлалтын эх сурвалжийг тэмдэглэнэ.
      if (body.status === OrderStatus.CANCELLED) {
        data.cancelledBy = 'ADMIN';
        data.cancelledAt = new Date();
      }
    }
    if (body.couponCode !== undefined) data.couponCode = body.couponCode ?? null;
    // Order статус солих үед Payment-ийг ч синк хийнэ (нэг захиалга 2 өөр
    // статустай болохоос сэргийлнэ). Атомик транзакц.
    const [order] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id },
        data,
        include: {
          user: { select: { id: true, email: true, name: true } },
          items: { include: { product: { select: { title: true, slug: true } } } },
          payments: true,
        },
      }),
      ...(body.status !== undefined
        ? this.syncPaymentsForOrderStatus(id, body.status)
        : []),
    ]);
    return order;
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
    @CurrentUser() me: JwtPayload,
  ) {
    const res = await this.prisma.productTypeConfig.create({
      data: { ...dto, ...(me.sub && { createdByUserId: me.sub }) },
    });
    await this.cache.del(CacheKeys.productTypes);
    return res;
  }

  @Patch('product-types/:id')
  async updateProductType(
    @Param('id') id: string,
    @Body() dto: { label?: string; description?: string; icon?: string; sortOrder?: number; active?: boolean },
    @CurrentUser() me: JwtPayload,
  ) {
    // ⚠️ IDOR: зөвхөн өөрийн (эсвэл SUPERADMIN) product-type-г засна.
    const row = await this.prisma.productTypeConfig.findUniqueOrThrow({
      where: { id },
      select: { createdByUserId: true },
    });
    assertOwner(me, row, 'засах');
    const res = await this.prisma.productTypeConfig.update({ where: { id }, data: dto });
    await this.cache.del(CacheKeys.productTypes);
    return res;
  }

  @Delete('product-types/:id')
  async deleteProductType(@Param('id') id: string, @CurrentUser() me: JwtPayload) {
    // ⚠️ IDOR: EDITOR устгаж чадахгүй + зөвхөн өөрийн product-type-г устгана.
    assertCanDelete(me);
    const row = await this.prisma.productTypeConfig.findUniqueOrThrow({
      where: { id },
      select: { createdByUserId: true, value: true },
    });
    assertOwner(me, row, 'устгах');
    // ⚠️ Phase 3: ӨӨР admin-ийн product энэ төрлийг (Product.type === value) ашиглаж
    // байвал устгахгүй. SUPERADMIN-д хамаарахгүй.
    if (me.role !== 'SUPERADMIN') {
      const usedByOther = await this.prisma.product.findFirst({
        where: { type: row.value, createdByUserId: { not: me.sub } },
        select: { id: true },
      });
      if (usedByOther) {
        throw new BadRequestException(
          'Энэ төрлийг өөр админы бүтээгдэхүүн ашиглаж байгаа тул устгах боломжгүй (зөвхөн засах)',
        );
      }
    }
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

  // ── Сертификат preview (admin) ────────────────────────────────────────────
  // Demo дата-аар сертификатын дизайныг HTML-ээр харах (admin шинэ tab нээнэ).
  // Параметргүй бол default demo. RolesGuard класс түвшинд (ADMIN).
  @Get('certificate/preview')
  async certificatePreview(
    @Res() res: Response,
    @Query('userName') userName?: string,
    @Query('courseTitle') courseTitle?: string,
  ) {
    const html = await this.courses.getCertificatePreviewHtml({ userName, courseTitle });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
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

  // Нэг асуултын дэлгэрэнгүй (conversation) — хавсралт presigned URL-аар.
  @Get('lessons/questions/:questionId')
  getLessonQuestionDetail(@Param('questionId') questionId: string) {
    return this.adminProducts.getQuestionDetail(questionId);
  }

  @Post('lessons/questions/:questionId/answers')
  answerLessonQuestion(
    @Param('questionId') questionId: string,
    @Body() body: AddAnswerDto,
    @CurrentUser() me: JwtPayload,
  ) {
    return this.adminProducts.answerQuestion(questionId, me.sub, body.answer, {
      attachmentKey: body.attachmentKey,
      attachmentName: body.attachmentName,
      attachmentMimeType: body.attachmentMimeType,
      attachmentSize: body.attachmentSize,
    });
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

  // ── Татаалт (DownloadLog) — бүх татаалтын лог ────────────────────────────
  // GET /admin/downloads — pagination + filter (productId/source/огноо/хайлт).
  // Хэн (нэвтэрсэн нэр/email эсвэл зочин IP), юу, хаанаас, ямар замаар татсан.
  @Get('downloads')
  async listDownloads(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('productId') productId?: string,
    @Query('source') source?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('q') q?: string,
  ) {
    const p = Math.max(1, page ? parseInt(page, 10) : 1);
    const ps = Math.min(100, Math.max(1, pageSize ? parseInt(pageSize, 10) : 20));
    const skip = (p - 1) * ps;

    const term = (q ?? '').trim();
    const src =
      source && ['free', 'paid', 'bundle'].includes(source) ? source : undefined;

    // Огнооны хязгаар (буруу огноог үл хэрэгснэ). dateTo-г өдрийн төгсгөл болгоно.
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!isNaN(d.getTime())) createdAt.gte = d;
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        createdAt.lte = d;
      }
    }

    const where: Prisma.DownloadLogWhereInput = {
      ...(productId ? { productId } : {}),
      ...(src ? { source: src } : {}),
      ...(createdAt.gte || createdAt.lte ? { createdAt } : {}),
      ...(term
        ? {
            OR: [
              { ip: { contains: term, mode: 'insensitive' } },
              { user: { name: { contains: term, mode: 'insensitive' } } },
              { user: { email: { contains: term, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.downloadLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: ps,
        include: {
          product: { select: { title: true, slug: true } },
          user: { select: { name: true, email: true } },
        },
      }),
      this.prisma.downloadLog.count({ where }),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      source: row.source,
      fileName: row.fileName,
      ip: row.ip,
      userAgent: row.userAgent,
      product: row.product
        ? { title: row.product.title, slug: row.product.slug }
        : null,
      // Зочин бол user=null (IP-ээр ялгана), нэвтэрсэн бол нэр/email.
      user: row.user ? { name: row.user.name, email: row.user.email } : null,
    }));

    return { items, total, page: p, pageSize: ps };
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

  // ─── Reviews (сэтгэгдэл) удирдлага ────────────────────────────────────────────

  // GET /admin/reviews — бүх review pagination (product нэр, user нэр/имэйл).
  @Get('reviews')
  async listReviews(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('productId') productId?: string,
    @Query('rating') rating?: string,
  ) {
    const p = Math.max(1, page ? parseInt(page, 10) : 1);
    const ps = Math.min(100, Math.max(1, pageSize ? parseInt(pageSize, 10) : 20));
    const skip = (p - 1) * ps;

    const term = (search ?? '').trim();
    const ratingNum = rating ? parseInt(rating, 10) : undefined;

    const where: Prisma.ReviewWhereInput = {
      ...(productId ? { productId } : {}),
      ...(ratingNum && ratingNum >= 1 && ratingNum <= 5 ? { rating: ratingNum } : {}),
      ...(term
        ? {
            OR: [
              { comment: { contains: term, mode: 'insensitive' } },
              { authorName: { contains: term, mode: 'insensitive' } },
              { user: { name: { contains: term, mode: 'insensitive' } } },
              { user: { email: { contains: term, mode: 'insensitive' } } },
              { product: { title: { contains: term, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: ps,
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          product: { select: { id: true, title: true, slug: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return { items, total, page: p, pageSize: ps };
  }

  // PATCH /admin/reviews/:id — comment/rating/authorName засах → recalc.
  @Patch('reviews/:id')
  async updateReview(
    @Param('id') id: string,
    @Body() body: { rating?: number; comment?: string; authorName?: string },
  ) {
    const existing = await this.prisma.review.findUnique({
      where: { id },
      select: { productId: true },
    });
    if (!existing) throw new BadRequestException('Сэтгэгдэл олдсонгүй');

    const data: Prisma.ReviewUpdateInput = {};
    if (body.rating !== undefined) {
      const r = Number(body.rating);
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        throw new BadRequestException('Үнэлгээ 1-ээс 5 хооронд байх ёстой');
      }
      data.rating = r;
    }
    if (body.comment !== undefined) {
      const c = (body.comment ?? '').trim();
      if (c.length > 2000) throw new BadRequestException('Сэтгэгдэл хэт урт байна');
      data.comment = c || null;
    }
    if (body.authorName !== undefined) {
      const n = (body.authorName ?? '').trim();
      if (n.length > 100) throw new BadRequestException('Нэр хэт урт байна');
      data.authorName = n || null;
    }

    const review = await this.prisma.review.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        product: { select: { id: true, title: true, slug: true } },
      },
    });

    await this.reviews.recalcProductRating(existing.productId);
    return review;
  }

  // DELETE /admin/reviews/:id → recalc.
  @Delete('reviews/:id')
  async deleteReview(@Param('id') id: string) {
    const existing = await this.prisma.review.findUnique({
      where: { id },
      select: { productId: true },
    });
    if (!existing) throw new BadRequestException('Сэтгэгдэл олдсонгүй');

    await this.prisma.review.delete({ where: { id } });
    await this.reviews.recalcProductRating(existing.productId);
    return { success: true };
  }

  // POST /admin/reviews/bulk-delete — олон устгах + нөлөөлсөн product бүрийг recalc.
  @Post('reviews/bulk-delete')
  async bulkDeleteReviews(@Body() body: { ids?: string[] }) {
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x) => typeof x === 'string') : [];
    if (!ids.length) throw new BadRequestException('Устгах сэтгэгдэл сонгоогүй байна');

    // нөлөөлсөн product-уудыг урьдчилж олж авна (устгасны дараа recalc хийхэд)
    const affected = await this.prisma.review.findMany({
      where: { id: { in: ids } },
      select: { productId: true },
    });
    const productIds = [...new Set(affected.map((r) => r.productId))];

    const result = await this.prisma.review.deleteMany({ where: { id: { in: ids } } });

    // нөлөөлсөн product бүрийн rating/ratingCount-ийг дахин тооцно
    await Promise.all(productIds.map((pid) => this.reviews.recalcProductRating(pid)));

    return { success: true, deleted: result.count, productsRecalculated: productIds.length };
  }
}
