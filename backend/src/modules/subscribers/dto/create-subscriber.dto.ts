import { IsEmail, IsOptional, IsString, IsArray, IsInt, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriberSex } from '@prisma/client';

export class CreateSubscriberDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(150)
  age?: number;

  @IsOptional()
  @IsEnum(SubscriberSex)
  sex?: SubscriberSex;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];
}
