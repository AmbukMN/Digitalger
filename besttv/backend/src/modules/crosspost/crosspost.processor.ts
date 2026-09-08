import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { CrosspostService } from './crosspost.service';
import { CROSSPOST_QUEUE, type CrosspostJob } from './crosspost-queue.types';
import { runAcrossSites, withSite } from '../../common/site/site-webhook';
import { PrismaService } from '../../prisma/prisma.service';

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

  constructor(
    private readonly svc: CrosspostService,
    /* ⚠️ Job-ийн сайтыг тодорхойлоход л ашиглана (доор) */
    private readonly prisma: PrismaService,
  ) {}

  @Process({ name: 'publish', concurrency: 1 })
  async handle(job: Job<CrosspostJob>) {
    const { crosspostId } = job.data;
    this.logger.log(`IG нийтлэл эхэллээ: ${crosspostId}`);

    /**
     * ⚠️⚠️ БҮРТГЭЛИЙН САЙТААР АЖИЛЛУУЛНА.
     *
     * BullMQ job нь HTTP хүсэлтээс ГАДУУР ажилладаг тул сайтын
     * контекст БАЙХГҮЙ. `publishOne` нь дотроо `SocialPost`
     * үүсгэдэг — контекстгүй бол `besttv` гэж бичигдэнэ.
     *
     * ҮР ДАГАВАР: BestFilm-ийн IG пост BestTV-ийн жагсаалтад
     * гарч, админ хайгаад олохгүй.
     *
     * ⚠️ `runAcrossSites` — бүртгэлийг ХОЁУЛАНГААС хайна (job нь
     * зөвхөн id мэднэ), дараа нь түүний сайтаар үргэлжилнэ.
     */
    const row = await runAcrossSites(() =>
      this.prisma.socialCrosspost.findUnique({
        where: { id: crosspostId },
        select: { site: true },
      }),
    );
    if (!row) {
      this.logger.warn(`Бүртгэл олдсонгүй — алгаслаа (${crosspostId})`);
      return;
    }

    /* ⚠️ Алдааг ЗАЛГИХГҮЙ — Bull дахин оролдох ёстой. `publishOne`
       нь төлөв/шалтгааныг DB-д аль хэдийн бичсэн байна. */
    await withSite(row.site, () => this.svc.publishOne(crosspostId));
  }
}
