import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  initiate(
    @CurrentUser() user: JwtPayload,
    @Body('planId') planId: string,
    @Body('couponCode') couponCode?: string,
  ) {
    return this.payments.initiate(planId, user.sub, couponCode);
  }

  @Get(':id/check')
  @UseGuards(JwtAuthGuard)
  check(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.payments.check(id, user.sub);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: JwtPayload) {
    return this.payments.myPayments(user.sub);
  }

  /** Хэтэвч цэнэглэх — QPay invoice үүсгэнэ */
  @Post('wallet/topup')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  topup(@CurrentUser() user: JwtPayload, @Body('amount') amount: number) {
    return this.payments.topupWallet(user.sub, Number(amount));
  }

  /** Хэтэвчийн үлдэгдлээр багц худалдан авах (QPay дамжихгүй) */
  @Post('wallet/purchase')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  purchaseWithWallet(
    @CurrentUser() user: JwtPayload,
    @Body('planId') planId: string,
    @Body('couponCode') couponCode?: string,
  ) {
    return this.payments.purchaseWithWallet(user.sub, planId, couponCode);
  }

  /** QPay callback — нээлттэй endpoint, дотор нь QPay API-аар баталгаажуулна */
  @Post('qpay/callback')
  @HttpCode(200)
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: Record<string, unknown>,
    @Headers('x-signature') signature?: string,
  ) {
    const rawBody = req.rawBody?.toString('utf-8') ?? JSON.stringify(body);
    return this.payments.handleWebhook(body, rawBody, signature);
  }
}
