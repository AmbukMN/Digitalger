import { Injectable } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';

export class CreateBundleDto {
  @IsString()
  title!: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsNumber() @Min(0)
  sortOrder?: number;
}

export class UpdateBundleDto {
  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsNumber() @Min(0)
  sortOrder?: number;

  @IsOptional() @IsString()
  downloadFileKey?: string | null;
}

export class CreateBundleItemDto {
  @IsString()
  name!: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  label?: string;

  @IsOptional() @IsString()
  fileId?: string;

  @IsOptional()
  fileIds?: string[];

  @IsOptional() @IsNumber() @Min(0)
  sortOrder?: number;
}

export class UpdateBundleItemDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  label?: string;

  @IsOptional() @IsString()
  fileId?: string;

  @IsOptional()
  fileIds?: string[];

  @IsOptional() @IsNumber() @Min(0)
  sortOrder?: number;
}

@Injectable()
export class BundlesService {
  constructor(private readonly prisma: PrismaService) {}

  findByProduct(productId: string) {
    return this.prisma.productBundle.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async createBundle(productId: string, dto: CreateBundleDto) {
    return this.prisma.productBundle.create({
      data: { productId, ...dto },
      include: { items: true },
    });
  }

  async updateBundle(bundleId: string, dto: UpdateBundleDto) {
    const bundle = await this.prisma.productBundle.findUniqueOrThrow({ where: { id: bundleId } });
    return this.prisma.productBundle.update({
      where: { id: bundle.id },
      data: dto,
      include: { items: true },
    });
  }

  async removeBundle(bundleId: string) {
    await this.prisma.productBundle.findUniqueOrThrow({ where: { id: bundleId } });
    return this.prisma.productBundle.delete({ where: { id: bundleId } });
  }

  async createItem(bundleId: string, dto: CreateBundleItemDto) {
    await this.prisma.productBundle.findUniqueOrThrow({ where: { id: bundleId } });
    return this.prisma.bundleItem.create({ data: { bundleId, ...dto } });
  }

  async updateItem(itemId: string, dto: UpdateBundleItemDto) {
    await this.prisma.bundleItem.findUniqueOrThrow({ where: { id: itemId } });
    return this.prisma.bundleItem.update({ where: { id: itemId }, data: dto });
  }

  async removeItem(itemId: string) {
    await this.prisma.bundleItem.findUniqueOrThrow({ where: { id: itemId } });
    return this.prisma.bundleItem.delete({ where: { id: itemId } });
  }
}
