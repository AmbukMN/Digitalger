import { IsIn, IsOptional, IsString } from 'class-validator';
import { BONUM_METHODS, type BonumMethod } from '../payments.service';

export class InitiatePaymentDto {
  @IsString()
  orderId!: string;

  // Bonum-аар төлөх арга (карт/WeChat). Байхгүй/qpay бол одоогийн QPay зам.
  @IsOptional()
  @IsIn(BONUM_METHODS)
  method?: BonumMethod;
}
