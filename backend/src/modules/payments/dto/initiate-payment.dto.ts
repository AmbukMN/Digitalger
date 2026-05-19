import { IsString } from 'class-validator';

export class InitiatePaymentDto {
  @IsString()
  orderId!: string;
}
