import { ForbiddenException, Injectable } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { assertOwner, assertCanDelete, isSuperadmin } from '../../common/ownership';
import { assertPermission } from '../../common/permission';

export class CreateFaqDto {
  @IsString() question!: string;
  @IsString() answer!: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() showInHelp?: boolean;
}

export class UpdateFaqDto {
  @IsOptional() @IsString() question?: string;
  @IsOptional() @IsString() answer?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() showInHelp?: boolean;
}

@Injectable()
export class FaqsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(me: JwtPayload, params?: { active?: boolean }) {
    await assertPermission(this.prisma, me, 'faqs', 'view');
    // ⚠️ SHARED resource: бүх admin БҮГД FAQ-г ХАРНА (owner scope ХАСав, active filter ХЭВЭЭР).
    // Гэхдээ update/remove ownership ХЭВЭЭР (assertOwner) — зөвхөн өөрийнхөө засна/устгана.
    return this.prisma.fAQ.findMany({
      where: {
        ...(params?.active !== undefined ? { active: params.active } : {}),
      },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  findOne(id: string) {
    return this.prisma.fAQ.findUniqueOrThrow({ where: { id } });
  }

  async create(dto: CreateFaqDto, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'faqs', 'create');
    return this.prisma.fAQ.create({
      data: { ...dto, createdByUserId: me.sub },
    });
  }

  async update(id: string, dto: UpdateFaqDto, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'faqs', 'edit');
    const row = await this.findOne(id);
    // ⚠️ IDOR: зөвхөн өөрийн (эсвэл SUPERADMIN) FAQ-г засна.
    assertOwner(me, row, 'засах');
    return this.prisma.fAQ.update({ where: { id }, data: dto });
  }

  async remove(id: string, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'faqs', 'delete');
    // ⚠️ IDOR: EDITOR устгаж чадахгүй + зөвхөн өөрийн FAQ-г устгана.
    assertCanDelete(me);
    const row = await this.findOne(id);
    assertOwner(me, row, 'устгах');
    // ⚠️ Phase 3: ӨӨР admin-ийн product-д ашиглагдаж байвал устгахгүй.
    if (!isSuperadmin(me)) {
      const usedByOther = await this.prisma.productFAQ.findFirst({
        where: { faqId: id, product: { createdByUserId: { not: me.sub } } },
        select: { productId: true },
      });
      if (usedByOther) {
        throw new ForbiddenException(
          'Энэ FAQ-г өөр админы бүтээгдэхүүн ашиглаж байгаа тул устгах боломжгүй (зөвхөн засах)',
        );
      }
    }
    return this.prisma.fAQ.delete({ where: { id } });
  }

  // Help Assistant panel-ийн FAQ tab — showInHelp=true + active (нийтийн, auth-гүй)
  findForHelp() {
    return this.prisma.fAQ.findMany({
      where: { active: true, showInHelp: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true, question: true, answer: true, category: true },
    });
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
