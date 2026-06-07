import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PaymentPaidEvent {
  orderId: string;
  paymentId: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  amount: number;
  products: { id: string; title: string; price: number }[];
  paidAt: string;
}

export interface PaymentFailedEvent {
  orderId: string;
  paymentId: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  amount: number;
  reason: string;
  failedAt: string;
}

export interface ProductPublishedEvent {
  productId: string;
  title: string;
  slug: string;
  price: number;
  categoryName: string | null;
  publishedAt: string;
}

export interface DailyReportEvent {
  date: string;
  totalRevenue: number;
  orderCount: number;
  newUserCount: number;
  topProducts: { title: string; count: number; revenue: number }[];
}

// Системийн анхааруулга — /webhook/alert n8n workflow руу → Telegram (admin)
export interface AlertEvent {
  level: 'warning' | 'critical';
  title: string;
  message: string;
  source?: string;
}

@Injectable()
export class N8nService {
  private readonly logger = new Logger(N8nService.name);
  private readonly webhookBase: string | null;
  private readonly secret: string | null;

  constructor(private readonly config: ConfigService) {
    this.webhookBase = this.config.get<string>('n8n.webhookUrl') ?? null;
    this.secret = this.config.get<string>('n8n.webhookSecret') ?? null;

    if (this.webhookBase) {
      this.logger.log(`n8n webhook configured → ${this.webhookBase}`);
    } else {
      this.logger.warn('N8N_WEBHOOK_URL тохируулаагүй — n8n notification идэвхгүй');
    }
  }

  async emitPaymentPaid(event: PaymentPaidEvent): Promise<void> {
    await this.post('/webhook/payment-paid', { event: 'payment.paid', ...event });
  }

  async emitPaymentFailed(event: PaymentFailedEvent): Promise<void> {
    await this.post('/webhook/payment-failed', { event: 'payment.failed', ...event });
  }

  async emitProductPublished(event: ProductPublishedEvent): Promise<void> {
    await this.post('/webhook/product-published', { event: 'product.published', ...event });
  }

  async emitDailyReport(event: DailyReportEvent): Promise<void> {
    await this.post('/webhook/daily-report', { event: 'daily.report', ...event });
  }

  // Системийн анхааруулга — backup алдаа, health degraded гэх мэт.
  // ⚠️ /webhook/alert n8n workflow хэрэглэгч тал дээр идэвхжүүлэх шаардлагатай
  // (n8n/workflows/monitoring/system-alert.json → import + active болгох).
  async emitAlert(event: AlertEvent): Promise<void> {
    await this.post('/webhook/alert', {
      event: 'system.alert',
      ...event,
      emittedAt: new Date().toISOString(),
    });
  }

  // ─── internal ───────────────────────────────────────────────────────────────

  private async post(path: string, body: unknown, attempt = 1): Promise<void> {
    if (!this.webhookBase) return;

    const url = `${this.webhookBase.replace(/\/$/, '')}${path}`;
    const maxAttempts = 3;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.secret) headers['x-webhook-secret'] = this.secret;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`n8n webhook ${path} → HTTP ${res.status}: ${text}`);
        if (attempt < maxAttempts) {
          await this.delay(attempt * 1000);
          return this.post(path, body, attempt + 1);
        }
        return;
      }

      this.logger.log(`n8n webhook ${path} → амжилттай (attempt ${attempt})`);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        this.logger.warn(`n8n webhook ${path} → timeout (attempt ${attempt})`);
      } else {
        this.logger.warn(`n8n webhook ${path} → ${err?.message ?? err} (attempt ${attempt})`);
      }

      if (attempt < maxAttempts) {
        await this.delay(attempt * 1000);
        return this.post(path, body, attempt + 1);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
