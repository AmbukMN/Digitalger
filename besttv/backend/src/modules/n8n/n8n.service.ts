import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * BestTV → n8n → Telegram МЭДЭГДЛИЙН ГҮҮР.
 *
 * ⚠️⚠️ АЛДАА ГАРВАЛ ҮНДСЭН АЖИЛ ЗОГСОХГҮЙ. Мэдэгдэл нь НЭМЭЛТ
 * функц — n8n унасан, сүлжээ тасарсан ч төлбөр баталгаажих,
 * захиалга үүсэх ёстой. Бүх метод `void`-оор дуудагдаж, дотроо
 * алдааг залгина.
 *
 * ⚠️ `digitalger-n8n` нь ӨӨР docker сүлжээнд (digitalger-n8n-network)
 * ажилладаг тул compose-д `n8n_net` external network нэмсэн.
 * Гадаад IP-аар (62.238.47.2:5678) залгах нь БОЛОХГҮЙ — тэр порт
 * интернэтэд нээлттэй тул хэн ч хуурамч webhook дуудна.
 */

export interface PaymentPaidEvent {
  paymentId: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  amount: number;
  /** Багц авсан бол нэр, түрээс бол киноны нэр, цэнэглэлт бол null */
  planName: string | null;
  titleName: string | null;
  isWalletTopup: boolean;
  /** 'QPAY' | 'WALLET' | 'BANK' — аль сувгаар төлсөн */
  method: string;
  couponCode: string | null;
  paidAt: string;
}

/** Дансаар шилжүүлсэн гэж мэдэгдсэн — АДМИН ГАРААР баталгаажуулна */
export interface BankTransferEvent {
  paymentId: string;
  reference: string;
  userName: string | null;
  userEmail: string;
  amount: number;
  planName: string | null;
  titleName: string | null;
  claimedAt: string;
}

export interface DailyReportEvent {
  date: string;
  /** ₮ — багц + түрээс + цэнэглэлт нийлбэр */
  totalRevenue: number;
  planRevenue: number;
  rentalRevenue: number;
  topupRevenue: number;
  planCount: number;
  rentalCount: number;
  /** Өмнөх өдрийн орлого — өсөлт/бууралт харуулахад */
  prevRevenue: number;
  newUserCount: number;
  viewCount: number;
  activeUserCount: number;
  topPlan: { name: string; count: number } | null;
  topTitle: { name: string; views: number } | null;
  /** Баталгаажуулах хүлээж буй дансны төлбөр */
  pendingBankCount: number;
}

/** HLS хөрвүүлэлт унасан */
export interface VideoFailedEvent {
  titleName: string;
  episodeLabel: string | null;
  reason: string;
  attempts: number;
  failedAt: string;
}

/** Системийн анхааруулга — диск, backup, DB */
export interface AlertEvent {
  level: 'warning' | 'critical';
  title: string;
  message: string;
  source?: string;
}

@Injectable()
export class N8nService {
  private readonly logger = new Logger(N8nService.name);
  private readonly base: string | null;
  private readonly secret: string | null;

  constructor(private readonly config: ConfigService) {
    this.base = this.config.get<string>('n8n.webhookUrl') ?? null;
    this.secret = this.config.get<string>('n8n.webhookSecret') ?? null;

    if (this.base) {
      this.logger.log(`n8n мэдэгдэл идэвхтэй → ${this.base}`);
    } else {
      this.logger.warn('N8N_WEBHOOK_URL тохируулаагүй — Telegram мэдэгдэл ИДЭВХГҮЙ');
    }
  }

  emitPaymentPaid(e: PaymentPaidEvent): void {
    void this.post('/webhook/besttv-payment-paid', { event: 'payment.paid', ...e });
  }

  emitBankTransfer(e: BankTransferEvent): void {
    void this.post('/webhook/besttv-bank-transfer', { event: 'bank.transfer', ...e });
  }

  emitDailyReport(e: DailyReportEvent): void {
    void this.post('/webhook/besttv-daily-report', { event: 'daily.report', ...e });
  }

  emitVideoFailed(e: VideoFailedEvent): void {
    void this.post('/webhook/besttv-video-failed', { event: 'video.failed', ...e });
  }

  emitAlert(e: AlertEvent): void {
    void this.post('/webhook/besttv-alert', { event: 'system.alert', ...e });
  }

  /**
   * ⚠️⚠️ ХЭЗЭЭ Ч ШИДЭХГҮЙ. Дуудагч тал `await` хийсэн ч хийгээгүй ч
   * үндсэн урсгал үргэлжлэх ёстой (төлбөр, захиалга).
   *
   * ⚠️ Timeout ЗААВАЛ — n8n гацвал HTTP хариу хүлээгдэж, хэрэглэгч
   * «төлбөр боловсруулж байна» дээр гацна. 5 секунд хангалттай.
   */
  private async post(path: string, body: unknown): Promise<void> {
    if (!this.base) return;

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);

    try {
      const res = await fetch(`${this.base}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          /* ⚠️ Хуваалцсан нууц — n8n webhook нь нээлттэй URL тул
             баталгаажуулалтгүй бол хэн ч хуурамч мэдэгдэл илгээнэ */
          ...(this.secret ? { 'x-webhook-secret': this.secret } : {}),
        },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });

      if (!res.ok) {
        this.logger.warn(`n8n ${path} → ${res.status}`);
      }
    } catch (e) {
      /* ⚠️ `warn` (error БИШ) — мэдэгдэл алдагдах нь системийн
         алдаа биш. Log шүүхэд бодит алдаанаас ялгарах ёстой. */
      this.logger.warn(`n8n ${path} амжилтгүй: ${String(e).slice(0, 120)}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
