import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class FaqDto {
  @IsString()
  question: string;

  @IsString()
  answer: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public — зөвхөн идэвхтэй, ангиллаар бүлэглэхэд бэлэн дараалалтай */
  list() {
    return this.prisma.faq.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });
  }

  /**
   * Server талын хуудаслалт + хайлт + ангиллын шүүлт.
   *
   * ⚠️ Өмнө нь бүх FAQ-г client-д татаж шүүдэг байсан — асуулт олноор
   * нэмэгдэхэд жагсаалт таслагдаж, хуудаслалтгүй болдог. Одоо хайлт/
   * шүүлт/хуудаслалт бүгд серверт (coupons-той ижил pattern).
   *
   * ⚠️ `order` талбараар эрэмбэлэх нь ХЭВЭЭР — category→order дарааллаар
   * харуулж байгаад хуудаслана.
   */
  async adminList(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
  } = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const search = (params.search ?? '').trim();
    const category = (params.category ?? '').trim();

    const where: Prisma.FaqWhereInput = {};

    if (category) {
      where.category = category;
    }

    if (search) {
      /* ⚠️ Асуулт, хариулт, ангиллаар хайна */
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.faq.findMany({
        where,
        orderBy: [{ category: 'asc' }, { order: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.faq.count({ where }),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  /** Шүүлтийн ангиллын жагсаалтыг ДАТАНААС үүсгэнэ (dropdown-д) — хуудаслалт
   *  идэвхжсэн тул client талд бүх ангиллыг цуглуулах боломжгүй болсон. */
  async categories() {
    const rows = await this.prisma.faq.findMany({
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category).filter(Boolean);
  }

  async create(dto: FaqDto) {
    return this.prisma.faq.create({
      data: {
        question: dto.question,
        answer: dto.answer,
        category: dto.category ?? 'Ерөнхий',
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: FaqDto) {
    const faq = await this.prisma.faq.findUnique({ where: { id } });
    if (!faq) throw new NotFoundException('Асуулт олдсонгүй');
    return this.prisma.faq.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    // ⚠️ `.catch(() => null)` БАЙХГҮЙ — алдаа нуувал хэрэглэгч "устгагдлаа"
    // гэсэн мэдэгдэл авах мөртлөө мөр хэвээр үлдэж эргэлздэг
    const exists = await this.prisma.faq.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Асуулт олдсонгүй');
    await this.prisma.faq.delete({ where: { id } });
    return { ok: true };
  }
}

@Controller('faqs')
export class FaqController {
  constructor(private readonly svc: FaqService) {}

  @Get()
  list() {
    return this.svc.list();
  }
}

@Controller('admin/faqs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class FaqAdminController {
  constructor(private readonly svc: FaqService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return this.svc.adminList({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      category,
    });
  }

  @Get('categories')
  categories() {
    return this.svc.categories();
  }

  @Post()
  create(@Body() dto: FaqDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: FaqDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

@Module({
  controllers: [FaqController, FaqAdminController],
  providers: [FaqService],
})
export class FaqModule {}
