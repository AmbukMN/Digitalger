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
import { PurchasePlanDto, RentTitleDto, TopupDto } from './dto/payments.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  initiate(@CurrentUser() user: JwtPayload, @Body() dto: PurchasePlanDto) {
    /* ⚠️ `method` байхгүй = QPay (хуучин зам, огт өөрчлөгдөөгүй) */
    return this.payments.initiate(dto.planId, user.sub, dto.couponCode, dto.method);
  }

  /**
   * ШИРХЭГЭЭР ТҮРЭЭСЛЭХ — QPay нэхэмжлэл.
   *
   * ⚠️ Өмнө нь түрээслэх цорын ганц зам нь ХЭТЭВЧ байсан тул хэтэвчгүй
   * хэрэглэгч эхлээд цэнэглээд дараа нь түрээслэх 2 алхамт урсгалд
   * ордог байв. Одоо шууд төлж болно.
   * ⚠️ `:id/check`-ЭЭС ӨМНӨ бичигдэнэ — эс бөгөөс "rental" гэдгийг `:id`
   * гэж уншиж, буруу route таарна.
   */
  @Post('rental/initiate')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  initiateRental(@CurrentUser() user: JwtPayload, @Body() dto: RentTitleDto) {
    return this.payments.initiateRental(dto.titleId, user.sub, dto.method);
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

  /**
   * Ямар төлбөрийн арга боломжтойг frontend-д хэлнэ.
   *
   * ⚠️ Нээлттэй (нэвтрээгүй ч багцын хуудас харна) — ямар ч нууц утга
   * буцаахгүй, зөвхөн боломж эсэх.
   * ⚠️ Тохируулаагүй аргыг UI-д ОГТ харуулахгүй (хэрэглэгч дараад
   * алдаа авахаас сэргийлнэ).
   */
  @Get('methods')
  methods() {
    return this.payments.availableMethods();
  }

  /** Хэтэвч цэнэглэх — QPay invoice үүсгэнэ */
  @Post('wallet/topup')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  topup(@CurrentUser() user: JwtPayload, @Body() dto: TopupDto) {
    /* ⚠️ `Number()` ХЭРЭГГҮЙ — DTO нь бүхэл тоо байхыг
       аль хэдийн баталгаажуулсан (NaN/бутархай хүрэхгүй) */
    return this.payments.topupWallet(user.sub, dto.amount, dto.method);
  }

  /** Хэтэвчийн үлдэгдлээр багц худалдан авах (QPay дамжихгүй) */
  @Post('wallet/purchase')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  purchaseWithWallet(@CurrentUser() user: JwtPayload, @Body() dto: PurchasePlanDto) {
    return this.payments.purchaseWithWallet(user.sub, dto.planId, dto.couponCode);
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

  /**
   * BONUM callback (карт · Apple Pay · Google Pay · WeChat).
   *
   * ⚠️ QPay-ийн урсгалаас БҮРЭН ТУСДАА — тэр endpoint огт хөндөгдөөгүй.
   * ⚠️ Гарын үсэг: `x-checksum-v2` = HMAC-SHA256(rawBody, CHECKSUM_KEY).
   *    Fail-closed — checksum таарахгүй бол 401 (QPay-тэй ижил зарчим).
   */
  @Post('bonum/callback')
  @HttpCode(200)
  bonumWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: Record<string, unknown>,
    @Headers('x-checksum-v2') checksum?: string,
  ) {
    const rawBody = req.rawBody?.toString('utf-8') ?? JSON.stringify(body);
    return this.payments.handleBonumWebhook(body, rawBody, checksum);
  }
}
