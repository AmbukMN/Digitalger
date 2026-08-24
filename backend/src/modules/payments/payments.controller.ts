import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { CheckPaymentDto } from './dto/check-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  // Боломжтой төлбөрийн аргууд (frontend checkout sheet карт мөр харуулах эсэх)
  @Get('methods')
  methods() {
    return this.paymentsService.availableMethods();
  }

  @Post('qpay/initiate')
  @UseGuards(JwtAuthGuard)
  initiate(
    @CurrentUser('sub') userId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    // method байвал Bonum (карт/WeChat), эс бол одоогийн QPay зам.
    return this.paymentsService.initiate(dto.orderId, userId, dto.method);
  }

  @Post('qpay/check')
  @UseGuards(JwtAuthGuard)
  check(
    @CurrentUser('sub') userId: string,
    @Body() dto: CheckPaymentDto,
  ) {
    return this.paymentsService.checkPayment(dto.orderId, userId);
  }

  // Bonum PENDING төлбөр шалгах (redirect-ээс буцаж ирсэн хэрэглэгчийн polling)
  @Post('bonum/check')
  @UseGuards(JwtAuthGuard)
  async bonumCheck(
    @CurrentUser('sub') userId: string,
    @Body() dto: CheckPaymentDto,
  ) {
    const paid = await this.paymentsService.checkBonumPayment(dto.orderId, userId);
    return { paid, orderId: dto.orderId };
  }

  @Post('webhook')
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  webhook(
    @Body() body: Record<string, unknown>,
    @Req() req: Request & { rawBody?: string },
    @Headers('x-qpay-signature') signature?: string,
    @Headers('x-signature') altSignature?: string,
  ) {
    const rawBody =
      req.rawBody ??
      (typeof body === 'string' ? body : JSON.stringify(body));

    return this.paymentsService.handleWebhook(
      body,
      rawBody,
      signature ?? altSignature,
    );
  }

  // ── Bonum webhook (карт/WeChat) — x-checksum-v2 HMAC. QPay-ээс тусдаа. ──
  @Post('bonum/callback')
  @HttpCode(200)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  bonumCallback(
    @Body() body: Record<string, unknown>,
    @Req() req: Request & { rawBody?: string },
    @Headers('x-checksum-v2') checksum?: string,
  ) {
    const rawBody =
      req.rawBody ?? (typeof body === 'string' ? body : JSON.stringify(body));
    return this.paymentsService.handleBonumWebhook(body, rawBody, checksum);
  }

  // ── Bonum hosted checkout-ийн "Буцах" товч → сайт руу буцаана ──
  // (эрх нь webhook-оор нээгдэнэ; энэ зөвхөн хэрэглэгчийг буцаах зам)
  @Get('bonum/callback')
  @Redirect()
  bonumReturn() {
    const siteUrl =
      this.config.get<string>('siteUrl') ?? 'https://digitalger.mn';
    return { url: `${siteUrl}/checkout?bonum=return`, statusCode: 302 };
  }
}
