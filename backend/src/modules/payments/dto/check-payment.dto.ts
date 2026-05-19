import { IsString } from 'class-validator';

export class CheckPaymentDto {
  @IsString()
  orderId: string;
}
