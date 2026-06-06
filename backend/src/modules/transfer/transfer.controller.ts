import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TransferService } from './transfer.service';

/**
 * Browser-switch state transfer (auth-гүй).
 *
 * FB/IG доторх браузараас системийн браузар руу шилжихэд хэрэглэгчийн state
 * (сагс/wishlist/coupon/guest/chat/theme)-ийг түр хадгалж, богино token-оор
 * сэргээнэ. Token богино настай (30мин), TTL дотор олон удаа уншиж болно.
 *
 * Throttle ИДЭВХТЭЙ (SkipThrottle хассан) — spam POST-оос DB дүүрэхээс хамгаална.
 * Зам: POST /transfer (хадгалах), GET /transfer/:token (сэргээх)
 */
@Controller('transfer')
export class TransferController {
  constructor(private readonly transfer: TransferService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } }) // DB дүүргэх спамаас сэргийлэх
  @Post()
  save(@Body() body: { payload: unknown }) {
    return this.transfer.save(body?.payload ?? {});
  }

  @Get(':token')
  consume(@Param('token') token: string) {
    return this.transfer.consume(token);
  }
}
