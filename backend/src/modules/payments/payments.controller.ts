import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { CheckPaymentDto } from './dto/check-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('qpay/initiate')
  @UseGuards(JwtAuthGuard)
  initiate(
    @CurrentUser('sub') userId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentsService.initiate(dto.orderId, userId);
  }

  @Post('qpay/check')
  @UseGuards(JwtAuthGuard)
  check(
    @CurrentUser('sub') userId: string,
    @Body() dto: CheckPaymentDto,
  ) {
    return this.paymentsService.checkPayment(dto.orderId, userId);
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
}
