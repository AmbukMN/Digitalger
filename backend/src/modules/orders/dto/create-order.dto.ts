import { ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  productIds!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  couponCodes?: string[];
}
