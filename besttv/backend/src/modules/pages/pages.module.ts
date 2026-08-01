import {
  BadRequestException,
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
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { slugify } from '../../common/slugify';

class PageDto {
  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsString()
  ogImageKey?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;
}

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private async decorate<T extends { ogImageKey: string | null }>(page: T) {
    return {
      ...page,
      ogImageUrl: page.ogImageKey ? await this.storage.publicAssetUrl(page.ogImageKey, 7200) : null,
    };
  }

  /** Public — footer-т харагдах идэвхтэй хуудсуудын жагсаалт */
  listPublic() {
    return this.prisma.page.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { slug: true, title: true },
    });
  }

  async getBySlug(slug: string) {
    const page = await this.prisma.page.findUnique({ where: { slug } });
    if (!page || !page.isActive) throw new NotFoundException('Хуудас олдсонгүй');
    return this.decorate(page);
  }

  adminList() {
    return this.prisma.page.findMany({ orderBy: { order: 'asc' } });
  }

  async adminGet(id: string) {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Хуудас олдсонгүй');
    return this.decorate(page);
  }

  async create(dto: PageDto) {
    if (!dto.title.trim()) throw new BadRequestException('Гарчиг шаардлагатай');
    const base = dto.slug?.trim() || slugify(dto.title);
    const exists = await this.prisma.page.findUnique({ where: { slug: base } });
    if (exists) throw new BadRequestException('Энэ хаяг (slug) аль хэдийн бүртгэлтэй байна');

    return this.prisma.page.create({
      data: {
        slug: base,
        title: dto.title,
        content: dto.content ?? '',
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        ogImageKey: dto.ogImageKey,
        isActive: dto.isActive ?? true,
        order: dto.order ?? 0,
      },
    });
  }

  async update(id: string, dto: Partial<PageDto>) {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Хуудас олдсонгүй');

    if (dto.slug && dto.slug !== page.slug) {
      const taken = await this.prisma.page.findUnique({ where: { slug: dto.slug } });
      if (taken) throw new BadRequestException('Энэ хаяг (slug) аль хэдийн бүртгэлтэй байна');
    }

    return this.prisma.page.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    // ⚠️ `.catch(() => null)` БАЙХГҮЙ — алдаа нуувал хэрэглэгч "устгагдлаа"
    // гэсэн мэдэгдэл авах мөртлөө мөр хэвээр үлдэж эргэлздэг
    const exists = await this.prisma.page.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Хуудас олдсонгүй');
    await this.prisma.page.delete({ where: { id } });
    return { ok: true };
  }
}

@Controller('pages')
export class PagesController {
  constructor(private readonly svc: PagesService) {}

  @Get()
  list() {
    return this.svc.listPublic();
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.svc.getBySlug(slug);
  }
}

@Controller('admin/pages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PagesAdminController {
  constructor(private readonly svc: PagesService) {}

  @Get()
  list() {
    return this.svc.adminList();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.adminGet(id);
  }

  @Post()
  create(@Body() dto: PageDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<PageDto>) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

@Module({
  controllers: [PagesController, PagesAdminController],
  providers: [PagesService],
})
export class PagesModule {}
