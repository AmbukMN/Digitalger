import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Хичээл үзэлтийн явц хадгалах DTO. */
export class LessonProgressDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  watchedSeconds!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSec?: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
