import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Хичээл (Lesson) үүсгэх DTO.
 * Видео эх сурвалж 3 хувилбар (mutually exclusive — service дотор зохицуулна):
 *   videoStreamId → Cloudflare Stream (signed playback)
 *   videoKey      → R2 (presigned)
 *   videoUrl      → гадаад линк
 */
export class CreateLessonDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Хичээлийн доорх дэлгэрэнгүй агуулга (rich text notes — TipTap HTML).
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  videoKey?: string;

  @IsOptional()
  @IsString()
  videoStreamId?: string;

  @IsOptional()
  @IsString()
  streamStatus?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSec?: number;

  @IsOptional()
  @IsBoolean()
  isFreePreview?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  moduleId?: string;
}

/** Хичээл (Lesson) засах DTO — бүх талбар optional. */
export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Хичээлийн доорх дэлгэрэнгүй агуулга (rich text notes — TipTap HTML).
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  videoKey?: string;

  @IsOptional()
  @IsString()
  videoStreamId?: string;

  @IsOptional()
  @IsString()
  streamStatus?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSec?: number;

  @IsOptional()
  @IsBoolean()
  isFreePreview?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  moduleId?: string | null;
}

/** Хичээлд хавсралт (нөөц файл) нэмэх DTO. Файлыг урьдчилж R2-д presign-аар upload хийсэн байна. */
export class CreateLessonResourceDto {
  @IsString()
  @MinLength(1)
  fileKey!: string;

  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/** Хавсралтын эрэмбэ өөрчлөх нэг мөр. */
export class ReorderLessonResourceItemDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

/** Хавсралтуудын эрэмбэ өөрчлөх DTO. */
export class ReorderLessonResourcesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderLessonResourceItemDto)
  items!: ReorderLessonResourceItemDto[];
}

/** Stream шууд upload URL хүсэх DTO. */
export class StreamUploadDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDurationSeconds?: number;
}
