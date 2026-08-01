import { Module } from '@nestjs/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
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
import { slugify } from '../../common/slugify';

class GenreDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  /** ⚠️ 18+ — ерөнхий каталог/нүүрэнд харагдахгүй, зөвхөн /adult хуудсанд */
  @IsOptional()
  @IsBoolean()
  isAdult?: boolean;
}

@Injectable()
export class GenresService {
  constructor(private readonly prisma: PrismaService) {}

  /** Admin — бүх жанр (18+ хамт) */
  list() {
    return this.prisma.genre.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { titles: true } } },
    });
  }

  /**
   * Public жанрын жагсаалт — 18+ жанр ч ОРНО (нүүр/шүүлтүүрт харагдана).
   * ⚠️ Контент нь эрхтэй хүнд л тоглоно (subscriptions.canAccessTitle).
   */
  listPublic() {
    return this.prisma.genre.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { titles: true } } },
    });
  }

  async create(dto: GenreDto) {
    const base = slugify(dto.name);
    const exists = await this.prisma.genre.findUnique({ where: { slug: base } });
    const slug = exists ? `${base}-${Date.now() % 1000}` : base;
    return this.prisma.genre.create({ data: { ...dto, slug } });
  }

  async update(id: string, dto: GenreDto) {
    const genre = await this.prisma.genre.findUnique({ where: { id } });
    if (!genre) throw new NotFoundException('Жанр олдсонгүй');
    return this.prisma.genre.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.genre.delete({ where: { id } });
    return { ok: true };
  }
}

@Controller('genres')
export class GenresController {
  constructor(private readonly svc: GenresService) {}

  @Get()
  list() {
    return this.svc.listPublic();
  }
}

@Controller('admin/genres')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class GenresAdminController {
  constructor(private readonly svc: GenresService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Body() dto: GenreDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: GenreDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

@Module({
  controllers: [GenresController, GenresAdminController],
  providers: [GenresService],
})
export class GenresModule {}
