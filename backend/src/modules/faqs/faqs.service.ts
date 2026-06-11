import { Injectable } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';

export class CreateFaqDto {
  @IsString() question!: string;
  @IsString() answer!: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateFaqDto {
  @IsOptional() @IsString() question?: string;
  @IsOptional() @IsString() answer?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Injectable()
export class FaqsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(params?: { active?: boolean }) {
    return this.prisma.fAQ.findMany({
      where: params?.active !== undefined ? { active: params.active } : {},
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  findOne(id: string) {
    return this.prisma.fAQ.findUniqueOrThrow({ where: { id } });
  }

  create(dto: CreateFaqDto, createdByUserId?: string) {
    return this.prisma.fAQ.create({
      data: { ...dto, ...(createdByUserId && { createdByUserId }) },
    });
  }

  async update(id: string, dto: UpdateFaqDto) {
    await this.findOne(id);
    return this.prisma.fAQ.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.fAQ.delete({ where: { id } });
  }

  // Get FAQs assigned to a product (for public product detail)
  findByProductId(productId: string) {
    return this.prisma.fAQ.findMany({
      where: {
        active: true,
        products: { some: { productId } },
      },
      orderBy: [{ sortOrder: 'asc' }],
    });
  }

  // Assign FAQs to a product (replaces existing assignments)
  async assignToProduct(productId: string, faqIds: string[]) {
    await this.prisma.productFAQ.deleteMany({ where: { productId } });
    if (faqIds.length === 0) return [];
    await this.prisma.productFAQ.createMany({
      data: faqIds.map((faqId, i) => ({ productId, faqId, sortOrder: i })),
    });
    return this.findByProductId(productId);
  }

  // Get FAQ ids currently assigned to a product
  async getProductFaqIds(productId: string): Promise<string[]> {
    const rows = await this.prisma.productFAQ.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
      select: { faqId: true },
    });
    return rows.map((r) => r.faqId);
  }
}
