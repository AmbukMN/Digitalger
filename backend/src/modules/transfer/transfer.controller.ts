import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { TransferService } from './transfer.service';

/**
 * Browser-switch state transfer (auth-гүй).
 *
 * FB/IG доторх браузараас системийн браузар руу шилжихэд хэрэглэгчийн state
 * (сагс/wishlist/coupon/guest)-ийг түр хадгалж, богино token-оор сэргээнэ.
 * Token өөрөө нэг удаагийн, богино настай (30мин) тул эрх шалгахгүй.
 *
 * Зам: POST /transfer (хадгалах), GET /transfer/:token (сэргээх)
 */
@Controller('transfer')
export class TransferController {
  constructor(private readonly transfer: TransferService) {}

  @Post()
  @SkipThrottle()
  save(@Body() body: { payload: unknown }) {
    return this.transfer.save(body?.payload ?? {});
  }

  @Get(':token')
  @SkipThrottle()
  consume(@Param('token') token: string) {
    return this.transfer.consume(token);
  }
}
