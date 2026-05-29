import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface SearchResult {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  type: string;
  matchReason: string;
}

// ─── Хайлтын стратеги ────────────────────────────────────────────────────────
//
// 1. Хайлтын үгийг цэвэрлэж, PostgreSQL tsquery форматад хөрвүүлнэ.
//    Монгол текст нь Unicode тул unaccent хэрэггүй, 'russian' config
//    нь Кирилл үсгийг stem хийдэг — ашиглана.
//
// 2. Хайлт 6 эх сурвалжид явна:
//    A. Product.title / description / whatsIncluded / howToUse
//       → to_tsvector('russian', ...) @@ tsquery
//    B. Lesson.title / description  → Course → Product
//    C. BundleItem.name / description / label → ProductBundle → Product
//    D. ProductFile.fileName  → Product
//    E. FAQ.question / answer → ProductFAQ → Product
//
// 3. Бүх эх сурвалжаас олдсон productId-уудыг нэгтгэж (UNION),
//    давхардлыг нэгтгэн (GROUP BY), нийт таарах тоогоор эрэмбэлнэ.
//    Хамгийн их эх сурвалжид таарсан product дээр гарна.
//
// 4. Fallback: tsquery-д тохирохгүй бол pg_trgm similarity (%) ашиглана.
//    Энэ нь үсгийн алдаа, хагас үгэнд ч ажилладаг.
//
// 5. Эцэст нь published=true бүтээгдэхүүнийг авч, matchReason тайлбарлана.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AiService {
  constructor(private prisma: PrismaService) {}

  async search(query: string): Promise<{ products: SearchResult[] }> {
    const cleaned = query.trim();
    if (!cleaned) return { products: [] };

    // tsquery: "Бяруу бордох" → "Бяруу & бордох" — бүх үг заавал байх
    const tsQuery = cleaned
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.replace(/['"\\:&|!()]/g, ''))
      .filter(Boolean)
      .join(' & ');

    // pg_trgm хайлтад ашиглах LIKE pattern
    const likePattern = `%${cleaned}%`;
    const trigramPattern = cleaned;

    // ─── Raw SQL: бүх эх сурвалжид хайж, productId + source цуглуулна ───
    // CTE ашиглаж хамгийн уншигдахуйц байдлаар бичнэ.
    // Prisma $queryRaw нь type-safe тул Prisma.sql template ашиглана.

    type MatchRow = { product_id: string; source: string; match_count: bigint };

    const rows = await this.prisma.$queryRaw<MatchRow[]>(Prisma.sql`
      WITH

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
            CASE WHEN p.title ILIKE ${likePattern} THEN 1 ELSE 0 END
            +
            CASE WHEN similarity(
                   p.title || ' ' || COALESCE(p.description,'') || ' ' ||
                   COALESCE(p."whatsIncluded",'') || ' ' || COALESCE(p."howToUse",''),
                   ${trigramPattern}
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
            OR p.title ILIKE ${likePattern}
            OR p.description ILIKE ${likePattern}
            OR COALESCE(p."whatsIncluded",'') ILIKE ${likePattern}
            OR COALESCE(p."howToUse",'') ILIKE ${likePattern}
            OR similarity(p.title, ${trigramPattern}) > 0.2
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
            OR l.title ILIKE ${likePattern}
            OR COALESCE(l.description,'') ILIKE ${likePattern}
            OR similarity(l.title || ' ' || COALESCE(l.description,''), ${trigramPattern}) > 0.2
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
            OR bi.name ILIKE ${likePattern}
            OR COALESCE(bi.description,'') ILIKE ${likePattern}
            OR COALESCE(bi.label,'') ILIKE ${likePattern}
            OR similarity(bi.name || ' ' || COALESCE(bi.description,''), ${trigramPattern}) > 0.2
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
            pf."fileName" ILIKE ${likePattern}
            OR similarity(pf."fileName", ${trigramPattern}) > 0.25
          )
        GROUP BY pf."productId"
      ),

      -- E. FAQ.question / answer → ProductFAQ → Product
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
            OR f.question ILIKE ${likePattern}
            OR f.answer ILIKE ${likePattern}
            OR similarity(f.question || ' ' || f.answer, ${trigramPattern}) > 0.15
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

    if (!rows.length) return { products: [] };

    const productIds = rows.map((r) => r.product_id);

    // Prisma-аар product мэдээллийг татна
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, published: true },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        price: true,
        type: true,
      },
    });

    // Оноогийн дарааллыг хадгалж, matchReason нэмнэ
    const rowMap = new Map(rows.map((r) => [r.product_id, r]));

    const SOURCE_LABELS: Record<string, string> = {
      product: 'Бүтээгдэхүүний тайлбар/гарчигт тохирсон',
      lesson: 'Хичээлийн агуулгад тохирсон',
      bundle: 'Bundle агуулгад тохирсон',
      file: 'Файлын нэрэнд тохирсон',
      faq: 'Түгээмэл асуулт/хариултад тохирсон',
    };

    const sorted = productIds
      .map((id) => {
        const product = products.find((p) => p.id === id);
        if (!product) return null;
        const row = rowMap.get(id)!;
        const sources = row.source.split(',').map((s) => SOURCE_LABELS[s] ?? s);
        return {
          id: product.id,
          title: product.title,
          slug: product.slug,
          description: product.description,
          price: Number(product.price),
          type: product.type,
          matchReason: sources.join('; '),
        };
      })
      .filter(Boolean) as SearchResult[];

    return { products: sorted };
  }
}
