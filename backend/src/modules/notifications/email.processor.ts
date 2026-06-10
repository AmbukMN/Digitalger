import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EmailService } from './email.service';
import { EmailQueueService } from './email-queue.service';
import { EMAIL_QUEUE, EmailJobPayload } from './email-queue.types';

// Нэг секундэд хэдэн job зэрэг боловсруулахыг env-ээс. ⚠️ Энэ нь queue limiter
// (max 10/сек)-тэй ХАМТ ажиллана: concurrency нь зэрэг гүйцэтгэх job, limiter нь
// нийт хурд. SES 14/сек хэтрэхгүй тул concurrency 5 хангалттай (limiter голлоно).
const EMAIL_CONCURRENCY = parseInt(process.env.EMAIL_WORKER_CONCURRENCY ?? '5', 10);

/**
 * BullMQ email queue CONSUMER. Background-д имэйл job-уудыг боловсруулна.
 *
 * ⚠️ Зөвхөн WORKER container-д бүртгэгдэнэ (worker.module). API container нь
 *    зөвхөн producer (EmailQueueService.enqueue). Хэрэв энэ processor-ийг API-д
 *    мөн бүртгэвэл нэг имэйл job-ийг 2 газар авч ДАВХАР илгээнэ.
 *
 * Rate limit: queue limiter (max 10/сек) SES 14/сек-ийг хэзээ ч давуулахгүй.
 * Retry: send() дотор SES transient retry хийгдсэн. Энд зөвхөн гэнэтийн exception
 *        (Redis/DB унах гэх мэт) гарвал BullMQ attempts (3, exponential) дахин
 *        оролдоно. send() false буцаавал throw ХИЙХГҮЙ (давхар явуулахаас сэргийлнэ).
 */
@Processor(EMAIL_QUEUE)
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly email: EmailService,
    private readonly queueService: EmailQueueService,
  ) {}

  @Process({ concurrency: EMAIL_CONCURRENCY })
  async handleEmail(job: Job<EmailJobPayload>): Promise<{ sent: boolean }> {
    const { to, subject, html, replyTo, campaign } = job.data;

    // sendRaw дотор suppression/EmailLog/SES retry бүгд хийгдэнэ.
    const sent = await this.email.sendRaw(to, subject, html, replyTo, campaign);

    // Кампанит ажлын прогресс (admin "N илгээгдсэн / M үлдсэн").
    if (sent) {
      await this.queueService.markSent(campaign).catch(() => {});
    } else {
      await this.queueService.markFailed(campaign).catch(() => {});
      this.logger.warn(`Имэйл job явсангүй → ${to} | ${subject}${campaign ? ` | ${campaign}` : ''}`);
    }

    // false-д throw хийхгүй — send() permanent/transient-ийг аль хэдийн шийдсэн.
    return { sent };
  }
}
