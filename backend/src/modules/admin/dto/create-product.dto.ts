import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
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

  @IsString()
  @MinLength(1)
  type!: string;

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

  // ── Хандалтын хугацаа (access expiry) ──
  // LIFETIME (default) — насан туршийн. DAYS — accessDays хоногийн дараа дуусна.
  @IsOptional()
  @IsIn(['LIFETIME', 'DAYS'])
  accessType?: 'LIFETIME' | 'DAYS';

  // accessType=DAYS үед хоногийн тоо (1-ээс дээш). LIFETIME үед үл хэрэгсэнэ.
  @IsOptional()
  @ValidateIf((o) => o.accessType === 'DAYS')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accessDays?: number;
}
