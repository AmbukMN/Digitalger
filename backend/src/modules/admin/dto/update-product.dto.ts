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

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  compareAtPrice?: number | null;

  @IsOptional()
  @IsString()
  type?: string;

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

  // adminOnly=true бол зөвхөн admin role нэвтэрсэн хэрэглэгчид харагдана,
  // public хэрэглэгчдээс бүрэн нуугдана (туршилтын бүтээгдэхүүн).
  @IsOptional()
  @IsBoolean()
  adminOnly?: boolean;

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
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  downloadCount?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  proofImageUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  proofQuote?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  proofText?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  proofAuthorName?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  proofAuthorRole?: string | null;

  // ── Хандалтын хугацаа (access expiry) ──
  // LIFETIME — насан туршийн. DAYS — accessDays хоногийн дараа дуусна.
  @IsOptional()
  @IsIn(['LIFETIME', 'DAYS'])
  accessType?: 'LIFETIME' | 'DAYS';

  // accessType=DAYS үед хоногийн тоо (1-ээс дээш). null/тэг үед хязгааргүй.
  @IsOptional()
  @ValidateIf((o, v) => v !== null && o.accessType === 'DAYS')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accessDays?: number | null;
}
