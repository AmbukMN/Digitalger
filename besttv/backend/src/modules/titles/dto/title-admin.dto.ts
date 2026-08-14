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
import { TitleType, TitleLanguage } from '@prisma/client';

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

  /**
   * URL slug. Хоосон бол гарчигаас АВТОМАТ үүснэ.
   * ⚠️ Давхардвал backend `-2`, `-3` нэмнэ. Засах үед хуучин линк эвдрэх
   *    тул зөвхөн админ ЗОРИУДААР өөрчилсөн үед л солигдоно.
   */
  @IsOptional()
  @IsString()
  slug?: string;

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

  /** Гарал үүслийн улс — «Солонгос», «Хятад» г.м. Хайлтад чухал. */
  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  ageRating?: string;

  /**
   * ⚠️ Киноны ХЭЛНИЙ хувилбар — админ сонгоно, картан дээр шошго болно.
   * MN = монгол хэлтэй (🇲🇳 "Хэл") | SUB = хадмал орчуулгатай ("Хадмал")
   */
  @IsOptional()
  @IsEnum(TitleLanguage)
  language?: TitleLanguage;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryKeys?: string[];

  /**
   * ⚠️ Англи ЭХ тайлбар — TMDB-ээс ирнэ, AI орчуулгын ЭХ ҮҮСВЭР.
   * `description` нь МОНГОЛ (орчуулсан), энэ нь англи хэвээр.
   */
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  /**
   * ⚠️ YouTube трейлерийн key — манай R2 HLS трейлер (`trailerKey`)-ЭЭС
   * ТУСДАА. HLS байхгүй үед л энийг тоглуулна.
   */
  @IsOptional()
  @IsString()
  trailerYoutubeKey?: string;

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

  /**
   * ⚠️ Эрэмбийн талбарууд — ЗААВАЛ CreateTitleDto-д байх ёстой.
   * Өмнө нь зөвхөн UpdateTitleDto-д байсан тул админ форм ижил биеийг
   * илгээхэд ШИНЭ контент үүсгэх нь `forbidNonWhitelisted` дүрмээр
   * "property bannerOrder should not exist" гээд 400 буцдаг байв.
   */
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

export class UpdateTitleDto extends CreateTitleDto {
  @IsOptional()
  @IsEnum(TitleType)
  declare type: TitleType;

  @IsOptional()
  @IsString()
  declare title: string;
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

// ─── Bulk үйлдлүүд ────────────────────────────────────────────────────────────
// ⚠️ ids-д дээд хязгаар (200) — санамсаргүй бүх каталогийг устгахаас
//    сэргийлнэ, мөн нэг хүсэлт хэт удаан ажиллахгүй.

export class BulkIdsDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}

export class BulkDeleteDto extends BulkIdsDto {
  /**
   * Идэвхтэй ТҮРЭЭС байхад ч устгах эсэх.
   * ⚠️ Rental нь Cascade тул устгавал төлбөр төлсөн хэрэглэгчийн эрх
   *    чимээгүй устна. Тиймээс админ ЗОРИУДААР баталгаажуулна.
   */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class BulkActiveDto extends BulkIdsDto {
  @IsBoolean()
  isActive!: boolean;
}

export class BulkPremiumDto extends BulkIdsDto {
  @IsBoolean()
  isPremium!: boolean;
}
