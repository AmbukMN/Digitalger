import { ForbiddenException, Injectable } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { assertOwner, assertCanDelete, isSuperadmin, buildOwnerWhere } from '../../common/ownership';
import { assertPermission } from '../../common/permission';

export class CreateTestimonialDto {
  @IsString()
  name!: string;

  @IsOptional() @IsString()
  avatar?: string;

  @IsOptional() @IsString()
  role?: string;

  @IsString()
  content!: string;

  @IsOptional() @IsNumber() @Min(1) @Max(5)
  rating?: number;

  @IsOptional() @IsBoolean()
  featured?: boolean;

  @IsOptional() @IsBoolean()
  active?: boolean;

  @IsOptional() @IsNumber() @Min(0)
  sortOrder?: number;
}

export class UpdateTestimonialDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  avatar?: string;

  @IsOptional() @IsString()
  role?: string;

  @IsOptional() @IsString()
  content?: string;

  @IsOptional() @IsNumber() @Min(1) @Max(5)
  rating?: number;

  @IsOptional() @IsBoolean()
  featured?: boolean;

  @IsOptional() @IsBoolean()
  active?: boolean;

  @IsOptional() @IsNumber() @Min(0)
  sortOrder?: number;
}

@Injectable()
export class TestimonialsService {
  constructor(private readonly prisma: PrismaService) {}

  // Public: all active testimonials for home page
  findAllActive() {
    return this.prisma.testimonial.findMany({
      where: { active: true },
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }],
    });
  }

  // Public: testimonials for a specific product
  findByProductId(productId: string) {
    return this.prisma.testimonial.findMany({
      where: {
        active: true,
        products: { some: { productId } },
      },
      orderBy: [{ sortOrder: 'asc' }],
    });
  }

  // Admin: all testimonials
  async findAll(me: JwtPayload) {
    await assertPermission(this.prisma, me, 'testimonials', 'view');
    // ⚠️ Owner scope: ADMIN/EDITOR зөвхөн өөрийн (createdByUserId===me.sub)
    // testimonial-г харна; SUPERADMIN бүгдийг (buildOwnerWhere={}).
    return this.prisma.testimonial.findMany({
      where: { ...buildOwnerWhere(me) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  findOne(id: string) {
    return this.prisma.testimonial.findUniqueOrThrow({ where: { id } });
  }

  async create(dto: CreateTestimonialDto, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'testimonials', 'create');
    return this.prisma.testimonial.create({
      data: { ...dto, createdByUserId: me.sub },
    });
  }

  async update(id: string, dto: UpdateTestimonialDto, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'testimonials', 'edit');
    const row = await this.findOne(id);
    // ⚠️ IDOR: зөвхөн өөрийн (эсвэл SUPERADMIN) testimonial-г засна.
    assertOwner(me, row, 'засах');
    return this.prisma.testimonial.update({ where: { id }, data: dto });
  }

  async remove(id: string, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'testimonials', 'delete');
    // ⚠️ IDOR: EDITOR устгаж чадахгүй + зөвхөн өөрийн testimonial-г устгана.
    assertCanDelete(me);
    const row = await this.findOne(id);
    assertOwner(me, row, 'устгах');
    // ⚠️ Phase 3 SHARED-resource delete-protection: ӨӨР admin-ийн product-д
    // ашиглагдаж байвал устгаж БОЛОХГҮЙ (зөвхөн засах). SUPERADMIN-д хамаарахгүй.
    if (!isSuperadmin(me)) {
      const usedByOther = await this.prisma.productTestimonial.findFirst({
        where: { testimonialId: id, product: { createdByUserId: { not: me.sub } } },
        select: { productId: true },
      });
      if (usedByOther) {
        throw new ForbiddenException(
          'Энэ сэтгэгдлийг өөр админы бүтээгдэхүүн ашиглаж байгаа тул устгах боломжгүй (зөвхөн засах)',
        );
      }
    }
    return this.prisma.testimonial.delete({ where: { id } });
  }

  // Get testimonial ids assigned to a product
  async getProductTestimonialIds(productId: string): Promise<string[]> {
    const rows = await this.prisma.productTestimonial.findMany({
      where: { productId },
      select: { testimonialId: true },
    });
    return rows.map((r) => r.testimonialId);
  }

  // Assign testimonials to a product (replaces existing)
  async assignToProduct(productId: string, testimonialIds: string[]) {
    await this.prisma.productTestimonial.deleteMany({ where: { productId } });
    if (testimonialIds.length === 0) return [];
    await this.prisma.productTestimonial.createMany({
      data: testimonialIds.map((testimonialId) => ({ productId, testimonialId })),
    });
    return this.findByProductId(productId);
  }
}
