import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TitleType } from '@prisma/client';

export class CastMemberDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  character?: string;

  @IsOptional()
  @IsString()
  photoKey?: string;
}

export class CreateTitleDto {
  @IsEnum(TitleType)
  type: TitleType;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  titleEn?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  posterKey?: string;

  @IsOptional()
  @IsString()
  backdropKey?: string;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  // ── Ширхэгээр түрээслэх ──
  /**
   * Тухайн киноны түрээсийн үнэ (₮). null = сайтын нийтлэг үнэ.
   * ⚠️ ValidateIf — админ талбарыг хоослоход null ирдэг, @IsNumber түүнийг
   * буруу гэж үзэх тул null үед шалгалтыг алгасна.
   */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumber()
  @Min(0)
  rentPrice?: number | null;

  /** Түрээсийн хугацаа (цаг). null = нийтлэг тохиргоо */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumber()
  @Min(1)
  rentHours?: number | null;

  /** false = энэ киног ширхэгээр түрээслүүлэхгүй */
  @IsOptional()
  @IsBoolean()
  rentEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  rating?: number;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actors?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CastMemberDto)
  cast?: CastMemberDto[];

  @IsOptional()
  @IsString()
  director?: string;

  @IsOptional()
  @IsString()
  ageRating?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryKeys?: string[];

  @IsOptional()
  @IsString()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genreIds?: string[];

  @IsOptional()
  @IsBoolean()
  isBanner?: boolean;

  @IsOptional()
  @IsBoolean()
  comingSoon?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTitleDto extends CreateTitleDto {
  @IsOptional()
  @IsEnum(TitleType)
  declare type: TitleType;

  @IsOptional()
  @IsString()
  declare title: string;

  @IsOptional()
  @IsInt()
  bannerOrder?: number;

  @IsOptional()
  @IsInt()
  comingSoonOrder?: number;

  @IsOptional()
  @IsInt()
  newReleasesOrder?: number;

  @IsOptional()
  @IsBoolean()
  hideFromNew?: boolean;
}

export class CreateSeasonDto {
  @IsInt()
  @Min(1)
  number: number;

  @IsOptional()
  @IsString()
  name?: string;
}

export class CreateEpisodeDto {
  @IsInt()
  @Min(1)
  number: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isFreePreview?: boolean;
}

export class UpdateEpisodeDto extends CreateEpisodeDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  declare number: number;

  @IsOptional()
  @IsString()
  posterKey?: string;
}
