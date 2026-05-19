import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateMenuItemDto {
  @IsString()
  label!: string;

  @IsOptional() @IsString()
  url?: string;

  @IsOptional() @IsString()
  pageSlug?: string;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  active?: boolean;

  @IsOptional() @IsString()
  target?: string;

  @IsOptional() @IsBoolean()
  openInNew?: boolean;
}

export class UpdateMenuItemDto {
  @IsOptional() @IsString()
  label?: string;

  @IsOptional() @IsString()
  url?: string;

  @IsOptional() @IsString()
  pageSlug?: string;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  active?: boolean;

  @IsOptional() @IsString()
  target?: string;

  @IsOptional() @IsBoolean()
  openInNew?: boolean;
}
