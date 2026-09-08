import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsService } from './payments.service';
import { forEachSite } from '../../common/site/site-cron';

/** 5 минут тутам PENDING төлбөрүүдийг QPay-аас шалгана (webhook fallback) */
@Injectable()
export class PaymentsReconcileService {
  constructor(private readonly payments: PaymentsService) {}

  /**
   * ⚠️⚠️ САЙТ БҮРД ТУСАД НЬ — QPay merchant ӨӨР.
   *
   * БОДИТ АЛДАА (аудитаар илэрсэн): `forEachSite` БАЙГААГҮЙ тул
   * контекстгүй ажиллаж, `getQPayToken()` нь ҮРГЭЛЖ `besttv`-ийн
   * merchant токен авдаг байв. QPay-ийн `/v2/payment/check` нь
   * merchant-д харьяалагддаг тул BestTV-ийн токеноор BestFilm-ийн
   * нэхэмжлэлийг асуухад `count=0` буцна → `verifyPaymentWithQpay`
   * false → `completePayment` ХЭЗЭЭ Ч дуудагдахгүй.
   *
   * ⚠️⚠️ ЭНЭ НЬ WEBHOOK-ИЙН НӨӨЦ ЗАМ. Webhook нь өөрөө BestFilm дээр
   * 401 өгдөг байсан (garын үсгийн нууц буруу сайтаас) тул ХОЁУЛАА
   * эвдэрсэн — BestFilm-ийн хэрэглэгч мөнгө төлсөн атлаа эрхээ
   * ЯМАР Ч ЗАМААР авахгүй байв. Цорын ганц үлдэх зам нь браузераа
   * нээлттэй барьж polling хийх.
   *
   * ⚠️ Мөн `isQPayConfigured()` нь `currentSite()`-ээс уншдаг тул
   * контекстгүй үед BestFilm тохируулагдсан эсэхийг ОГТ шалгадаггүй
   * байв — `forEachSite` доторх дуудлага үүнийг ч зөв болгоно.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcile(): Promise<void> {
    await forEachSite('payments-reconcile', async () => {
      await this.payments.reconcilePending(2);
    });
  }
}
