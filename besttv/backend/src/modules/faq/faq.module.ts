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

  adminList() {
    return this.prisma.faq.findMany({ orderBy: [{ category: 'asc' }, { order: 'asc' }] });
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
  list() {
    return this.svc.adminList();
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
