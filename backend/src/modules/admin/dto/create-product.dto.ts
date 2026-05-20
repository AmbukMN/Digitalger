import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ProductType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  slug!: string;

  @IsString()
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @IsEnum(ProductType)
  type!: ProductType;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsString()
  previewUrl?: string;

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;

  @IsOptional()
  @IsString()
  howToUse?: string;

  @IsOptional()
  @IsString()
  whatsIncluded?: string;

  @IsOptional()
  @IsString()
  discountEndsAt?: string;

  @IsOptional()
  @IsArray()
  @Type(() => Object)
  howToUseSteps?: object[];

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ratingCount?: number;

  @IsOptional()
  @IsString()
  proofImageUrl?: string;

  @IsOptional()
  @IsString()
  proofQuote?: string;

  @IsOptional()
  @IsString()
  proofText?: string;

  @IsOptional()
  @IsString()
  proofAuthorName?: string;

  @IsOptional()
  @IsString()
  proofAuthorRole?: string;
}
