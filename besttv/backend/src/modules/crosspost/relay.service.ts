import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaGraphService } from './meta-graph.service';
import { SocialAccountsService, type SocialAccount } from './social-accounts.service';

/** Нэг зорилтот акаунт руу нийтэлсэн үр дүн */
export interface RelayOutcome {
  postId: string;
  toId: string;
  toName: string;
  ok: boolean;
  externalId?: string;
  error?: string;
  /** IG-д товлолт боломжгүй тул алгассан гэх мэт */
  skipped?: boolean;
}

/**
 * ⚠️⚠️ PAGE → PAGE / PAGE → IG ДАМЖУУЛАЛТ.
 *
 * `crosspost.service.ts` нь ЗӨВХӨН «үндсэн FB page → үндсэн IG» гэсэн
 * НЭГ чиглэлийг мэддэг. Энэ нь ДУРЫН эх → ДУРЫН зорилтот.
 *
 * ⚠️ Meta-д «repost/share» API БАЙХГҮЙ. Постыг ШИНЭЭР үүсгэнэ:
 *    эх постын текст + зургийн URL-ийг хуулж дамжуулна.
 *
 * ⚠️ Зургийн URL нь Meta-гийн CDN (`scontent.*`) — хугацаатай гарын
 *    үсэгтэй. Гэвч Graph API нь `url` параметрээр өөрийнхөө CDN-ээс
 *    ШУУД татдаг тул R2 руу дахин хуулах ШААРДЛАГАГҮЙ (crosspost.service
 *    нь хуулдаг — тэр нь IG Reels видеонд хэрэгтэй).
 */
@Injectable()
export class RelayService {
  private readonly logger = new Logger(RelayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly meta: MetaGraphService,
    private readonly accounts: SocialAccountsService,
  ) {}

  /** Эх page-ийн постуудыг татна (аль хэдийн дамжуулсныг тэмдэглэнэ) */
  async listPosts(pageId: string, limit = 25, after?: string) {
    const acc = await this.accounts.byId(pageId);
    if (!acc) throw new BadRequestException('Хуудас олдсонгүй эсвэл токен алга');
    if (acc.kind !== 'FACEBOOK') {
      throw new BadRequestException('Зөвхөн Facebook хуудсаас пост уншина');
    }

    const { posts, next } = await this.meta.fetchPostsFor(acc.id, acc.token, limit, after);

    /* ⚠️ Аль хэдийн дамжуулсан постуудыг тэмдэглэнэ — админ дахин
       сонгоод ДАВХАР нийтлэхээс сэргийлнэ (UI дээр «✓ дамжуулсан») */
    const ids = posts.map((p) => p.id);
    const done = ids.length
      ? await this.prisma.socialRelay.findMany({
          where: { sourcePostId: { in: ids } },
          select: { sourcePostId: true, targetId: true, status: true },
        })
      : [];

    const byPost = new Map<string, { targetId: string; status: string }[]>();
    for (const d of done) {
      const arr = byPost.get(d.sourcePostId) ?? [];
      arr.push({ targetId: d.targetId, status: d.status });
      byPost.set(d.sourcePostId, arr);
    }

    return {
      posts: posts.map((p) => ({ ...p, relays: byPost.get(p.id) ?? [] })),
      next,
    };
  }

  /**
   * Сонгосон постуудыг зорилтот акаунтууд руу нийтэлнэ.
   *
   * ⚠️ Нэг зорилтот унасан нь БУСДЫГ зогсоох ёсгүй — тус бүрийг
   *    try/catch-аар боож, үр дүнг цуглуулна.
   */
  async relay(params: {
    fromId: string;
    postIds: string[];
    toIds: string[];
    captions?: Record<string, string>;
    scheduledAt?: string;
  }): Promise<RelayOutcome[]> {
    const { fromId, postIds, toIds } = params;
    if (!postIds.length) throw new BadRequestException('Пост сонгоогүй байна');
    if (!toIds.length) throw new BadRequestException('Зорилтот хуудас сонгоогүй байна');

    const from = await this.accounts.byId(fromId);
    if (!from) throw new BadRequestException('Эх хуудас олдсонгүй');

    const targets: SocialAccount[] = [];
    for (const id of toIds) {
      const t = await this.accounts.byId(id);
      if (!t) throw new BadRequestException(`Зорилтот акаунт олдсонгүй: ${id}`);
      /* ⚠️ Өөр рүүгээ дамжуулах нь утгагүй — DB unique-д мөргөхөөс
         өмнө ТОДОРХОЙ алдаа өгнө */
      if (t.id === fromId) {
        throw new BadRequestException('Эх хуудас руугаа дамжуулах боломжгүй');
      }
      targets.push(t);
    }

    /* ⚠️ FB нь 10 мин – 30 хоногийн хооронд л товлодог (Meta дүрэм) */
    let scheduledUnix: number | null = null;
    if (params.scheduledAt) {
      const at = new Date(params.scheduledAt).getTime();
      if (Number.isNaN(at)) throw new BadRequestException('Товлох огноо буруу');
      const diffMin = (at - Date.now()) / 60_000;
      if (diffMin < 10) {
        throw new BadRequestException('Товлох цаг одооноос 10 минутаас хойш байх ёстой');
      }
      if (diffMin > 30 * 24 * 60) {
        throw new BadRequestException('Товлох цаг 30 хоногоос хэтрэхгүй');
      }
      scheduledUnix = Math.floor(at / 1000);
    }

    const out: RelayOutcome[] = [];

    for (const postId of postIds) {
      /* ⚠️ Эх постыг ЭХ page-ийн токеноор татна — өөр токеноор
         `(#100) Object does not exist` буцаана */
      let src: Awaited<ReturnType<typeof this.meta.fetchPost>> | null = null;
      try {
        src = await this.meta.fetchPost(postId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        for (const t of targets) {
          out.push({ postId, toId: t.id, toName: t.name, ok: false, error: msg });
        }
        continue;
      }

      const text = (params.captions?.[postId] ?? src.message ?? '').trim();
      /* ⚠️ `previewUrl` нь FB-ийн статик preview — хамгийн найдвартай.
         Байхгүй бол эхний attachment-ийн URL (album-ын эхний зураг). */
      const image = src.previewUrl || src.attachments?.[0]?.url || undefined;

      for (const t of targets) {
        const row = await this.record(postId, fromId, t, text);
        try {
          let externalId: string;

          if (t.kind === 'FACEBOOK') {
            externalId = await this.meta.createPostOn({
              pageId: t.id,
              token: t.token,
              message: text,
              imageUrl: image,
              scheduledUnix,
            });
          } else {
            /**
             * ⚠️⚠️ INSTAGRAM — ЗУРАГГҮЙ пост БОЛОМЖГҮЙ.
             * Meta нь IG-д зөвхөн медиатай постыг зөвшөөрдөг тул
             * текст пост ЧИМЭЭГҮЙ алгасахын оронд ТОДОРХОЙ хэлнэ.
             */
            if (!image) {
              await this.finish(row.id, false, undefined, 'Instagram-д зураг ЗААВАЛ шаардлагатай');
              out.push({
                postId, toId: t.id, toName: t.name, ok: false, skipped: true,
                error: 'Instagram-д зураг ЗААВАЛ шаардлагатай (текст пост дэмжигдэхгүй)',
              });
              continue;
            }
            /* ⚠️ IG-д ТОВЛОХ боломж БАЙХГҮЙ (Meta) — админд хэлнэ */
            if (scheduledUnix) {
              await this.finish(row.id, false, undefined,
                'Instagram товлолт дэмжигдэхгүй — шууд нийтлэх эсвэл товлогч ашиглана уу');
              out.push({
                postId, toId: t.id, toName: t.name, ok: false, skipped: true,
                error: 'Instagram-д товлох боломжгүй (Meta-гийн хязгаар)',
              });
              continue;
            }

            const container = await this.meta.createContainerOn({
              igUserId: t.id,
              token: t.token,
              imageUrl: image,
              caption: text,
            });
            /* ⚠️ Контейнер боловсрох хүртэл хүлээнэ — шууд publish
               хийвэл `MEDIA_NOT_READY` буцаана */
            /* ⚠️ Зорилтот IG-ийн ӨӨРИЙН токеноор шалгана — үндсэн
               токеноор өөр акаунтын контейнерт `(#100)` буцаана */
            await this.meta.waitForContainer(container, 300_000, t.token);
            externalId = await this.meta.publishContainerOn({
              igUserId: t.id,
              token: t.token,
              containerId: container,
            });
          }

          await this.finish(row.id, true, externalId);
          out.push({ postId, toId: t.id, toName: t.name, ok: true, externalId });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await this.finish(row.id, false, undefined, msg);
          out.push({ postId, toId: t.id, toName: t.name, ok: false, error: msg });
          this.logger.warn(`Дамжуулалт унав: ${postId} → ${t.name}: ${msg.slice(0, 160)}`);
        }
      }
    }

    return out;
  }

  /**
   * Дамжуулалтын бүртгэл — ДАВХАРДЛААС хамгаална.
   *
   * ⚠️ `@@unique([sourcePostId, targetId])` тул нэг постыг нэг
   *    зорилтот руу ХОЁР УДАА нийтлэхийг DB түвшинд барина. Дахин
   *    оролдвол мөрийг ШИНЭЧИЛНЭ (шинээр үүсгэхгүй).
   */
  private async record(sourcePostId: string, sourceId: string, t: SocialAccount, caption: string) {
    return this.prisma.socialRelay.upsert({
      where: { sourcePostId_targetId: { sourcePostId, targetId: t.id } },
      create: {
        sourcePostId,
        sourceId,
        targetId: t.id,
        targetName: t.name,
        targetKind: t.kind,
        caption,
        status: 'PROCESSING',
      },
      update: {
        caption,
        status: 'PROCESSING',
        error: null,
        attempts: { increment: 1 },
      },
    });
  }

  private async finish(id: string, ok: boolean, externalId?: string, error?: string) {
    await this.prisma.socialRelay
      .update({
        where: { id },
        data: {
          status: ok ? 'PUBLISHED' : 'FAILED',
          externalId: externalId ?? null,
          error: error?.slice(0, 500) ?? null,
          publishedAt: ok ? new Date() : null,
        },
      })
      .catch(() => null);
  }

  /** Түүх — админд харуулах */
  async history(limit = 50) {
    return this.prisma.socialRelay.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, limit),
    });
  }
}
