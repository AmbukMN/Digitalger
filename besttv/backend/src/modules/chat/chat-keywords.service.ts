import { Injectable, Logger } from '@nestjs/common';
import { ChatMatchType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { expandQuery } from '../../common/transliterate';

/**
 * ⚠️⚠️ ЧАТБОТЫН ТҮЛХҮҮР ҮГ — админаас удирдана.
 *
 * БОДИТ ХЭРЭГЦЭЭ: хэрэглэгч чатад «99» гэж бичихэд «Өнчин охин»
 * киног харуулах ёстой. Тэр үг гарчигт БАЙХГҮЙ тул энгийн хайлт
 * (title/slug/description) ОЛОХГҮЙ.
 *
 * ⚠️ Админ хэдэн ч дүрэм нэмнэ — код засах шаардлагагүй.
 *
 * ⚠️⚠️ ГУРВАН СУВАГТ ИЖИЛ АЖИЛЛАНА (вэб, Facebook, Instagram):
 * n8n нь `/titles/search`-ыг дууддаг тул тэр endpoint дотор
 * шалгана — гурван суваг автоматаар хамрагдана.
 */

/** Хайлтын үр дүн — кино эсвэл текст хариу */
export interface KeywordHit {
  /** Харуулах киноны ID-ууд (эрэмбэтэй) */
  titleIds: string[];
  /** Нэмэлт текст хариу (байвал) */
  reply: string | null;
  /** Дүрмийн id — статистикт */
  ruleId: string;
}

@Injectable()
export class ChatKeywordsService {
  private readonly logger = new Logger(ChatKeywordsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Хэрэглэгчийн мессежээс тохирох дүрмийг олно.
   *
   * ⚠️ ЭХНИЙ ТААРСАН нь ялна (`order` → `createdAt`). Олон дүрэм
   * таарвал админы эрэмбэ шийднэ.
   *
   * ⚠️ ГАЛИГ дэмжинэ: «unchin» гэж бичсэн ч «өнчин» дүрэм олдоно
   * (`expandQuery` — санах ойд тэмдэглэсэн дүрэм).
   *
   * @returns таарсан дүрэм, эсвэл `null`
   */
  async match(rawMessage: string): Promise<KeywordHit | null> {
    const msg = normalize(rawMessage);
    if (!msg) return null;

    /**
     * ⚠️⚠️ БҮХ ИДЭВХТЭЙ ДҮРМИЙГ ТАТНА, дараа нь JS-д шалгана.
     *
     * ЯАГААД SQL-д шүүхгүй вэ: `matchType` тус бүрд өөр логик
     * (EXACT/CONTAINS/PREFIX) + галиг хувилбар шаардлагатай.
     * SQL-д хийвэл асар төвөгтэй query болно.
     *
     * ⚠️ Дүрмийн тоо ЦӨӨН байна (админ гараар нэмдэг, 10-100).
     * 1000+ болвол Redis кэш нэмнэ.
     */
    const rules = await this.prisma.chatKeyword.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        keywords: true,
        matchType: true,
        titleIds: true,
        reply: true,
      },
      /* ⚠️ Хамгаалалт — админ санамсаргүй 10,000 дүрэм үүсгэвэл */
      take: 500,
    });
    if (!rules.length) return null;

    /* ⚠️ Мессежийн галиг хувилбарууд — «unchin» → «өнчин» */
    const msgVariants = new Set<string>([msg, ...expandQuery(msg)]);

    for (const rule of rules) {
      if (!rule.keywords.length) continue;

      for (const kw of rule.keywords) {
        const key = normalize(kw);
        if (!key) continue;

        /* ⚠️ Түлхүүрийн галиг хувилбар ч шалгана */
        const keyVariants = new Set<string>([key, ...expandQuery(key)]);

        const hit = [...msgVariants].some((m) =>
          [...keyVariants].some((k) => matches(m, k, rule.matchType)),
        );

        if (hit) {
          /* ⚠️ Статистик — АЛДААГ ЗАЛГИНА, хариу саатуулж болохгүй */
          void this.prisma.chatKeyword
            .update({
              where: { id: rule.id },
              data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
            })
            .catch(() => null);

          this.logger.log(`Түлхүүр таарлаа: «${kw}» → ${rule.titleIds.length} кино`);
          return { titleIds: rule.titleIds, reply: rule.reply, ruleId: rule.id };
        }
      }
    }
    return null;
  }

  /* ─── Админ ─────────────────────────────────────────────────── */

  async list(params: { q?: string; isActive?: boolean; page?: number; limit?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));

    const where: Prisma.ChatKeywordWhereInput = {
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.q?.trim()
        ? {
            OR: [
              /* ⚠️ `has` — массив доторх ЯГ таарц */
              { keywords: { has: normalize(params.q) } },
              { note: { contains: params.q.trim(), mode: 'insensitive' } },
              { reply: { contains: params.q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.chatKeyword.findMany({
        where,
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.chatKeyword.count({ where }),
    ]);

    /**
     * ⚠️ Киноны НЭРИЙГ хамт буцаана — админ ID хараад ойлгохгүй.
     * ⚠️ Нэг query-ээр бүх киног татна (N+1 гаргахгүй).
     */
    const allIds = [...new Set(items.flatMap((i) => i.titleIds))];
    const titles = allIds.length
      ? await this.prisma.title.findMany({
          where: { id: { in: allIds } },
          select: { id: true, title: true, slug: true, posterKey: true },
        })
      : [];
    const byId = new Map(titles.map((t) => [t.id, t]));

    return {
      items: items.map((i) => ({
        ...i,
        /* ⚠️ Устгагдсан киног ХАСНА — админд «алга болсон» ID харагдахгүй */
        titles: i.titleIds.map((id) => byId.get(id)).filter(Boolean),
      })),
      total,
      page,
      limit,
    };
  }

  async create(dto: {
    keywords: string[];
    matchType?: ChatMatchType;
    titleIds?: string[];
    reply?: string;
    note?: string;
    isActive?: boolean;
    order?: number;
  }) {
    return this.prisma.chatKeyword.create({
      data: {
        /* ⚠️ Жижиг үсэг + давхардал хасах — харьцуулалт тогтвортой */
        keywords: cleanKeywords(dto.keywords),
        matchType: dto.matchType ?? ChatMatchType.EXACT,
        titleIds: dto.titleIds ?? [],
        reply: dto.reply?.trim() || null,
        note: dto.note?.trim() || null,
        isActive: dto.isActive ?? true,
        order: dto.order ?? 0,
      },
    });
  }

  async update(
    id: string,
    dto: Partial<{
      keywords: string[];
      matchType: ChatMatchType;
      titleIds: string[];
      reply: string;
      note: string;
      isActive: boolean;
      order: number;
    }>,
  ) {
    return this.prisma.chatKeyword.update({
      where: { id },
      data: {
        ...(dto.keywords ? { keywords: cleanKeywords(dto.keywords) } : {}),
        ...(dto.matchType ? { matchType: dto.matchType } : {}),
        ...(dto.titleIds ? { titleIds: dto.titleIds } : {}),
        ...(dto.reply !== undefined ? { reply: dto.reply.trim() || null } : {}),
        ...(dto.note !== undefined ? { note: dto.note.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.prisma.chatKeyword.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * ⚠️ ТУРШИХ — админ дүрэм зөв ажиллаж байгааг шалгана.
   * Хадгалахаас ӨМНӨ шалгаж болно.
   */
  async test(message: string) {
    const hit = await this.match(message);
    if (!hit) return { matched: false };
    const titles = hit.titleIds.length
      ? await this.prisma.title.findMany({
          where: { id: { in: hit.titleIds } },
          select: { id: true, title: true, slug: true },
        })
      : [];
    return {
      matched: true,
      ruleId: hit.ruleId,
      reply: hit.reply,
      /* ⚠️ Эрэмбийг хадгална — Prisma нь дурын дараалал буцаадаг */
      titles: hit.titleIds.map((id) => titles.find((t) => t.id === id)).filter(Boolean),
    };
  }
}

/* ─── Туслах ──────────────────────────────────────────────────── */

/**
 * Харьцуулалтад бэлдэнэ.
 *
 * ⚠️ Emoji, цэг таслал ХАСНА — Facebook-ийн «ice breaker» товч нь
 * «🎬 Шинэ кино» гэж илгээдэг (санах ойд тэмдэглэсэн бодит алдаа).
 */
function normalize(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanKeywords(list: string[]): string[] {
  return [...new Set(list.map(normalize).filter(Boolean))];
}

function matches(msg: string, key: string, type: ChatMatchType): boolean {
  switch (type) {
    case ChatMatchType.EXACT:
      return msg === key;
    case ChatMatchType.PREFIX:
      return msg.startsWith(key);
    case ChatMatchType.CONTAINS:
      /**
       * ⚠️⚠️ БҮТЭН ҮГЭЭР таарна — `includes` БИШ.
       *
       * «99» гэсэн түлхүүр нь «1999 он» доторх «99»-д таарч,
       * огт хамааралгүй хариу өгөх байв. Үгийн хилээр шалгана.
       */
      return new RegExp(`(^|\\s)${escapeRe(key)}(\\s|$)`).test(msg);
    default:
      return false;
  }
}

/** ⚠️ Админы оруулсан текст regex болох тул escape ЗААВАЛ */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
