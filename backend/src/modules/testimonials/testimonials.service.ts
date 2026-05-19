import { Injectable } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';

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
  findAll() {
    return this.prisma.testimonial.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  findOne(id: string) {
    return this.prisma.testimonial.findUniqueOrThrow({ where: { id } });
  }

  create(dto: CreateTestimonialDto) {
    return this.prisma.testimonial.create({ data: dto });
  }

  async update(id: string, dto: UpdateTestimonialDto) {
    await this.findOne(id);
    return this.prisma.testimonial.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
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
