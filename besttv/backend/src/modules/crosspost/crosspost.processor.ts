import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { CrosspostService } from './crosspost.service';
import { CROSSPOST_QUEUE, type CrosspostJob } from './crosspost-queue.types';

/**
 * Instagram нийтлэлийн worker.
 *
 * ⚠️⚠️ ЗӨВХӨН `worker.module.ts`-д бүртгэгдэнэ. API-д ч бүртгэвэл нэг
 * ажил ХОЁР УДАА боловсруулагдаж, IG дээр давхардсан пост гарна.
 *
 * ⚠️ `concurrency: 1` — Instagram нь зэрэг олон нийтлэлийг таашаадаггүй
 * (rate limit + контейнер боловсруулалт хоорондоо саад болдог). Дараалал
 * нь ганц ганцаар явбал найдвартай.
 */
@Processor(CROSSPOST_QUEUE)
export class CrosspostProcessor {
  private readonly logger = new Logger(CrosspostProcessor.name);

  constructor(private readonly svc: CrosspostService) {}

  @Process({ name: 'publish', concurrency: 1 })
  async handle(job: Job<CrosspostJob>) {
    const { crosspostId } = job.data;
    this.logger.log(`IG нийтлэл эхэллээ: ${crosspostId}`);
    /* ⚠️ Алдааг ЗАЛГИХГҮЙ — Bull дахин оролдох ёстой. `publishOne`
       нь төлөв/шалтгааныг DB-д аль хэдийн бичсэн байна. */
    await this.svc.publishOne(crosspostId);
  }
}
