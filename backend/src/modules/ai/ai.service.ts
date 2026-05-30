import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { expandQuery } from '../../common/transliterate';
import { Prisma } from '@prisma/client';

// ─── Буцаах өгөгдлийн бүтэц ───────────────────────────────────────────────────

export interface ProductResult {
  id: string;
  title: string;
  description: string;
  price: number; // үндсэн үнэ
  salePrice: number | null; // хямдарсан үнэ (compareAtPrice байвал price нь хямдарсан үнэ); байхгүй бол null
  imageUrl: string | null; // үндсэн зургийн бүрэн линк (n8n-д шууд ачаалах боломжтой)
  productType: string; // type label, жишээ: "Төсөл", "Видео" (enum value биш)
  url: string; // бүтээгдэхүүний дэлгэрэнгүй хуудасны бүрэн линк
  matchReason: string; // AI agent-д зориулсан дэлгэрэнгүй тайлбар
}

export interface FaqResult {
  question: string;
  answer: string;
  matchReason: string;
}

export interface SearchResponse {
  products: ProductResult[];
  faqs: FaqResult[];
  message?: string; // юу ч олдоогүй үед тайлбар мессеж
}

// Хуучин нэрийг хадгалах (backward-compat, өмнө export хийсэн)
export type SearchResult = ProductResult;

const SITE_URL = 'https://digitalger.mn';

// ─── Хайлтын стратеги ────────────────────────────────────────────────────────
//
// 0. ГАЛИГ (transliteration): хэрэглэгч латинаар "byaruu" гэж бичвэл түүнийг
//    Кирилл бүх хувилбарт ("бяруу", "бярүү", "бяру"...) хөрвүүлж хайна
//    (expandQuery). Кирилл бичвэл латин хувилбарыг нь нэмж хайна. Ингэснээр
//    "byaruu" гэж бичихэд "бяруу" гэсэн Монгол бүтээгдэхүүн олдоно.
//    Бүх хувилбарыг SQL дотор `terms` CTE-д төвлөрүүлж, tsquery / ILIKE /
//    similarity гурвууланд хэрэглэнэ.
//
// 1. Хайлтын үгийг цэвэрлэж, PostgreSQL tsquery форматад хөрвүүлнэ.
//    'russian' config нь Кирилл үсгийг stem хийдэг — ашиглана.
//
// 2. PRODUCT хайлт 5 эх сурвалжид явна:
//    A. Product.title / description / whatsIncluded / howToUse
//    B. Lesson.title / description  → Course → Product
//    C. BundleItem.name / description / label → ProductBundle → Product
//    D. ProductFile.fileName  → Product
//    E. ProductFAQ-аар холбогдсон FAQ.question / answer → Product
//
// 3. FAQ хайлт нь TUS DAA — backend-ийн БҮХ идэвхтэй FAQ-аас хайна.
//
// 4. Бүх product эх сурвалжаас олдсон productId-уудыг нэгтгэж, нийт таарах
//    тоогоор эрэмбэлнэ.
//
// 5. Хариу буцаахдаа ямар ч тэмдэгтийн хязгаар тавихгүй. products болон faqs
//    хоёр зэрэг олдож болно. Хоёулаа хоосон бол "Хайлтад юм олсонгүй".
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AiService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async search(query: string): Promise<SearchResponse> {
    const cleaned = query.trim();
    if (!cleaned) {
      return { products: [], faqs: [], message: 'Хайлтад юм олсонгүй' };
    }

    // ── Галиг хувилбарууд: латин ↔ Кирилл ──
    // expandQuery: "byaruu" → ["byaruu", "бяруу", "бярүү", ...]
    //              "бяруу"  → ["бяруу", "byaruu"]
    // Хоосон/давхардлыг цэвэрлэнэ.
    const variants = Array.from(
      new Set([cleaned.toLowerCase(), ...expandQuery(cleaned)]),
    ).filter(Boolean);

    // Бүх хувилбараас нэгдсэн tsquery бүтээнэ:
    //   variant бүрийг үгээр салгаж '&'-ээр (бүх үг заавал байх),
    //   variant-уудыг '|'-ээр (аль нэг хувилбар таарвал болно).
    //   жишээ: "(бяруу) | (бярүү) | (byaruu)"
    const tsParts = variants
      .map((v) =>
        v
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => w.replace(/['"\\:&|!()]/g, ''))
          .filter(Boolean)
          .join(' & '),
      )
      .filter(Boolean)
      .map((p) => `(${p})`);

    // tsquery хоосон болох эрсдэлээс хамгаална.
    const tsQuery = tsParts.length ? tsParts.join(' | ') : 'x__no_match__x';

    const [productRows, faqs] = await Promise.all([
      this.searchProducts(tsQuery, variants),
      this.searchFaqs(tsQuery, variants),
    ]);

    if (productRows.length === 0 && faqs.length === 0) {
      return { products: [], faqs: [], message: 'Хайлтад юм олсонгүй' };
    }

    return { products: productRows, faqs };
  }

  // ─── Бүтээгдэхүүний хайлт ────────────────────────────────────────────────────
  // tsQuery: нэгдсэн tsquery (galig variant-ууд '|'-ээр холбогдсон)
  // variants: бүх галиг хувилбар (ILIKE болон similarity-д ашиглана)
  private async searchProducts(
    tsQuery: string,
    variants: string[],
  ): Promise<ProductResult[]> {
    type MatchRow = { product_id: string; source: string; match_count: bigint };

    const rows = await this.prisma.$queryRaw<MatchRow[]>(Prisma.sql`
      WITH
      -- Галиг бүх хувилбар: t = хувилбар, pat = ILIKE pattern
      terms AS (
        SELECT DISTINCT t, '%' || t || '%' AS pat
        FROM unnest(${variants}::text[]) AS t
        WHERE t <> ''
      ),

      -- A. Product өөрийн талбарууд дотор хайх
      product_match AS (
        SELECT
          p.id AS product_id,
          'product' AS source,
          (
            CASE WHEN to_tsvector('russian', COALESCE(p.title, ''))
                      @@ to_tsquery('russian', ${tsQuery}) THEN 2 ELSE 0 END
            +
            CASE WHEN to_tsvector('russian', COALESCE(p.title, '') || ' ' ||
                                             COALESCE(p.description, '') || ' ' ||
                                             COALESCE(p."whatsIncluded", '') || ' ' ||
                                             COALESCE(p."howToUse", ''))
                      @@ to_tsquery('russian', ${tsQuery}) THEN 1 ELSE 0 END
            +
            CASE WHEN EXISTS (SELECT 1 FROM terms WHERE p.title ILIKE terms.pat) THEN 1 ELSE 0 END
            +
            CASE WHEN (
                   SELECT max(similarity(
                     p.title || ' ' || COALESCE(p.description,'') || ' ' ||
                     COALESCE(p."whatsIncluded",'') || ' ' || COALESCE(p."howToUse",''),
                     terms.t))
                   FROM terms
                 ) > 0.1 THEN 1 ELSE 0 END
          )::bigint AS match_count
        FROM "Product" p
        WHERE p.published = true
          AND (
            to_tsvector('russian', COALESCE(p.title,'') || ' ' ||
                                   COALESCE(p.description,'') || ' ' ||
                                   COALESCE(p."whatsIncluded",'') || ' ' ||
                                   COALESCE(p."howToUse",''))
              @@ to_tsquery('russian', ${tsQuery})
            OR EXISTS (SELECT 1 FROM terms WHERE
                 p.title ILIKE terms.pat
                 OR p.description ILIKE terms.pat
                 OR COALESCE(p."whatsIncluded",'') ILIKE terms.pat
                 OR COALESCE(p."howToUse",'') ILIKE terms.pat)
            OR (SELECT max(similarity(p.title, terms.t)) FROM terms) > 0.2
          )
      ),

      -- B. Lesson дотор хайж → Course → Product
      lesson_match AS (
        SELECT
          c."productId" AS product_id,
          'lesson' AS source,
          COUNT(*)::bigint AS match_count
        FROM "Lesson" l
        JOIN "Course" c ON c.id = l."courseId"
        JOIN "Product" p ON p.id = c."productId"
        WHERE p.published = true
          AND (
            to_tsvector('russian', COALESCE(l.title,'') || ' ' || COALESCE(l.description,''))
              @@ to_tsquery('russian', ${tsQuery})
            OR EXISTS (SELECT 1 FROM terms WHERE
                 l.title ILIKE terms.pat OR COALESCE(l.description,'') ILIKE terms.pat)
            OR (SELECT max(similarity(l.title || ' ' || COALESCE(l.description,''), terms.t)) FROM terms) > 0.2
          )
        GROUP BY c."productId"
      ),

      -- C. BundleItem дотор хайж → ProductBundle → Product
      bundle_match AS (
        SELECT
          pb."productId" AS product_id,
          'bundle' AS source,
          COUNT(*)::bigint AS match_count
        FROM "BundleItem" bi
        JOIN "ProductBundle" pb ON pb.id = bi."bundleId"
        JOIN "Product" p ON p.id = pb."productId"
        WHERE p.published = true
          AND (
            to_tsvector('russian', COALESCE(bi.name,'') || ' ' ||
                                   COALESCE(bi.description,'') || ' ' ||
                                   COALESCE(bi.label,''))
              @@ to_tsquery('russian', ${tsQuery})
            OR EXISTS (SELECT 1 FROM terms WHERE
                 bi.name ILIKE terms.pat
                 OR COALESCE(bi.description,'') ILIKE terms.pat
                 OR COALESCE(bi.label,'') ILIKE terms.pat)
            OR (SELECT max(similarity(bi.name || ' ' || COALESCE(bi.description,''), terms.t)) FROM terms) > 0.2
          )
        GROUP BY pb."productId"
      ),

      -- D. ProductFile.fileName дотор хайх
      file_match AS (
        SELECT
          pf."productId" AS product_id,
          'file' AS source,
          COUNT(*)::bigint AS match_count
        FROM "ProductFile" pf
        JOIN "Product" p ON p.id = pf."productId"
        WHERE p.published = true
          AND (
            EXISTS (SELECT 1 FROM terms WHERE pf."fileName" ILIKE terms.pat)
            OR (SELECT max(similarity(pf."fileName", terms.t)) FROM terms) > 0.25
          )
        GROUP BY pf."productId"
      ),

      -- E. Тухайн бүтээгдэхүүнд оноосон FAQ → ProductFAQ → Product
      faq_match AS (
        SELECT
          pfaq."productId" AS product_id,
          'faq' AS source,
          COUNT(*)::bigint AS match_count
        FROM "FAQ" f
        JOIN "ProductFAQ" pfaq ON pfaq."faqId" = f.id
        JOIN "Product" p ON p.id = pfaq."productId"
        WHERE p.published = true
          AND f.active = true
          AND (
            to_tsvector('russian', f.question || ' ' || f.answer)
              @@ to_tsquery('russian', ${tsQuery})
            OR EXISTS (SELECT 1 FROM terms WHERE
                 f.question ILIKE terms.pat OR f.answer ILIKE terms.pat)
            OR (SELECT max(similarity(f.question || ' ' || f.answer, terms.t)) FROM terms) > 0.15
          )
        GROUP BY pfaq."productId"
      ),

      -- Бүх эх сурвалжийг нэгтгэнэ
      all_matches AS (
        SELECT product_id, source, match_count FROM product_match  WHERE match_count > 0
        UNION ALL
        SELECT product_id, source, match_count FROM lesson_match
        UNION ALL
        SELECT product_id, source, match_count FROM bundle_match
        UNION ALL
        SELECT product_id, source, match_count FROM file_match
        UNION ALL
        SELECT product_id, source, match_count FROM faq_match
      )

      -- Давхардлыг нэгтгэж, нийт оноогоор эрэмбэлнэ
      SELECT
        product_id,
        string_agg(DISTINCT source, ',') AS source,
        SUM(match_count)::bigint AS match_count
      FROM all_matches
      GROUP BY product_id
      ORDER BY match_count DESC
      LIMIT 10
    `);

    if (!rows.length) return [];

    const productIds = rows.map((r) => r.product_id);

    const [products, typeConfigs] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds }, published: true },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          price: true,
          compareAtPrice: true,
          type: true,
          images: {
            // Үндсэн зураг: isPrimary эхэнд, дараа нь sortOrder.
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            select: { fileKey: true, videoUrl: true },
          },
        },
      }),
      this.prisma.productTypeConfig.findMany({
        select: { value: true, label: true },
      }),
    ]);

    const typeLabelMap = new Map(typeConfigs.map((t) => [t.value, t.label]));
    const rowMap = new Map(rows.map((r) => [r.product_id, r]));

    const SOURCE_LABELS: Record<string, string> = {
      product:
        'Бүтээгдэхүүний нэр болон тайлбарт хайлтын үгтэй шууд тохирсон',
      lesson:
        'Энэ бүтээгдэхүүний дотор багтсан хичээлийн агуулга хайлтын үгтэй тохирсон',
      bundle:
        'Энэ багц бүтээгдэхүүний доторх агуулгад хайлтын үгтэй тохирсон',
      file: 'Энэ бүтээгдэхүүнд хавсаргасан файлын нэр хайлтын үгтэй тохирсон',
      faq: 'Энэ бүтээгдэхүүнд оноосон түгээмэл асуулт хариулт хайлтын үгтэй тохирсон',
    };

    const result: ProductResult[] = [];

    for (const id of productIds) {
      const product = products.find((p) => p.id === id);
      if (!product) continue;

      const row = rowMap.get(id)!;
      const reasonParts = row.source
        .split(',')
        .map((s) => SOURCE_LABELS[s] ?? s);

      // Үндсэн зураг: видео биш, fileKey-тэй эхний зураг
      const primaryImage = product.images.find(
        (img) => !img.videoUrl && img.fileKey,
      );
      const imageUrl = primaryImage
        ? this.storage.getAssetUrl(primaryImage.fileKey)
        : null;

      // Үнэ: compareAtPrice байвал price нь хямдарсан үнэ, compareAtPrice нь
      // үндсэн (хямдрахаас өмнөх) үнэ болно.
      const currentPrice = Number(product.price);
      const compareAt =
        product.compareAtPrice != null ? Number(product.compareAtPrice) : null;
      const hasDiscount = compareAt != null && compareAt > currentPrice;

      const basePrice = hasDiscount ? compareAt! : currentPrice;
      const salePrice = hasDiscount ? currentPrice : null;

      const productType = typeLabelMap.get(product.type) ?? product.type;

      result.push({
        id: product.id,
        title: product.title,
        description: product.description,
        price: basePrice,
        salePrice,
        imageUrl,
        productType,
        url: `${SITE_URL}/products/${product.slug}`,
        matchReason: reasonParts.join('. ') + '.',
      });
    }

    return result;
  }

  // ─── FAQ хайлт (backend-ийн БҮХ идэвхтэй FAQ-аас) ────────────────────────────
  private async searchFaqs(
    tsQuery: string,
    variants: string[],
  ): Promise<FaqResult[]> {
    type FaqRow = { question: string; answer: string; score: number };

    const rows = await this.prisma.$queryRaw<FaqRow[]>(Prisma.sql`
      WITH terms AS (
        SELECT DISTINCT t, '%' || t || '%' AS pat
        FROM unnest(${variants}::text[]) AS t
        WHERE t <> ''
      )
      SELECT
        f.question,
        f.answer,
        (
          CASE WHEN to_tsvector('russian', f.question || ' ' || f.answer)
                    @@ to_tsquery('russian', ${tsQuery}) THEN 2 ELSE 0 END
          +
          CASE WHEN EXISTS (SELECT 1 FROM terms WHERE f.question ILIKE terms.pat) THEN 1 ELSE 0 END
          +
          CASE WHEN EXISTS (SELECT 1 FROM terms WHERE f.answer ILIKE terms.pat) THEN 1 ELSE 0 END
          +
          (SELECT COALESCE(max(similarity(f.question || ' ' || f.answer, terms.t)), 0) FROM terms)
        )::float AS score
      FROM "FAQ" f
      WHERE f.active = true
        AND (
          to_tsvector('russian', f.question || ' ' || f.answer)
            @@ to_tsquery('russian', ${tsQuery})
          OR EXISTS (SELECT 1 FROM terms WHERE
               f.question ILIKE terms.pat OR f.answer ILIKE terms.pat)
          OR (SELECT max(similarity(f.question || ' ' || f.answer, terms.t)) FROM terms) > 0.15
        )
      ORDER BY score DESC
      LIMIT 5
    `);

    return rows.map((r) => ({
      question: r.question,
      answer: r.answer,
      matchReason:
        'Энэ нь сайтын түгээмэл асуулт хариултын (FAQ) хэсгээс хайлтын үгтэй тохирсон ерөнхий мэдээлэл юм',
    }));
  }
}
