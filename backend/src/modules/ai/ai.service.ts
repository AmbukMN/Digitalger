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
  price: number;
  salePrice: number | null;
  imageUrl: string | null;
  productType: string;
  url: string;
  matchReason: string;
  // AI-д зориулсан: ямар үгээр энэ бүтээгдэхүүн олдсон (хэрэглэгчид тайлбарлахад)
  matchedKeywords: string[];
}

export interface FaqResult {
  question: string;
  answer: string;
  matchReason: string;
}

export interface SearchResponse {
  products: ProductResult[];
  faqs: FaqResult[];
  // AI-д зориулсан: хайлтын гол үгс (хэрэглэгчид яагаад санал болгож буйг тайлбарлах)
  searchTerms?: string[];
  message?: string;
}

export type SearchResult = ProductResult;

const SITE_URL = 'https://digitalger.mn';

// Монгол хэлний түгээмэл туслах үгс (relevance-д жин багатай).
// "төсөл", "бэлэн" гэх мэт үг бараг бүх бүтээгдэхүүний нэрэнд байдаг тул
// зөвхөн эдгээрээр таарсныг "сул тохирол" гэж үзнэ.
const COMMON_WORDS = new Set([
  'бэлэн',
  'төсөл',
  'төслүүд',
  'загвар',
  'загварууд',
  'багц',
  'файл',
  'ном',
  'болон',
  'бусад',
  'гэх',
  'мэт',
  'зэрэг',
  'дээр',
  'таны',
  'миний',
  'би',
  'та',
  'хайж',
  'байна',
  'вэ',
  'юу',
  'үзэх',
  'авах',
]);

// ─── Хайлтын шинэ стратеги (keyword-AND relevance) ───────────────────────────
//
// АСУУДАЛ (хуучин): олон үгтэй хайлт ("бяруу бордох төсөл") бүх үгээ '|' (OR)-оор
// нэгтгэдэг байсан тул "төсөл" гэдэг түгээмэл үгэнд таарсан БҮХ бүтээгдэхүүн
// буцдаг байв (9+ ширхэг). Жинхэнэ хамаатай нь "бяруу"-тэй 2 л байсан.
//
// ШИЙДЭЛ: хайлтыг ГОЛ ҮГ тус бүрээр задалж, product бүрд "хэдэн өөр гол үг
// таарсныг" тоолж relevance оноо өгнө:
//   - Гол үг (бяруу, бордох) таарвал → 10 оноо/үг (хүчтэй)
//   - Түгээмэл үг (төсөл, бэлэн) таарвал → 1 оноо/үг (сул)
//   - title-д таарвал description-аас 2 дахин их жинтэй
// Эцэст нь:
//   1. Ядаж 1 ГОЛ үг таарсан бүтээгдэхүүн байвал → зөвхөн тэдгээрийг буцаана
//      (түгээмэл үгээр л таарсан "шум"-ыг хасна).
//   2. Гол үг огт таараагүй (зөвхөн түгээмэл үг) бол → top хэдийг буцаана.
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

    // 1) Хайлтыг гол үгсэд задлах (түгээмэл болон гол үгээр ангилна)
    const rawWords = cleaned
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/['"\\:&|!()?.,;]/g, ''))
      .filter((w) => w.length >= 2);

    // Гол үгс (түгээмэл биш). Хэрэв бүгд түгээмэл бол бүгдийг гол гэж үзнэ.
    let keyWords = rawWords.filter((w) => !COMMON_WORDS.has(w));
    if (keyWords.length === 0) keyWords = [...rawWords];

    // 2) Гол үг бүрийн галиг хувилбаруудыг бэлдэнэ
    //    [{ word: 'бяруу', variants: ['бяруу','byaruu',...], isCommon: false }, ...]
    const allWords = rawWords.length ? rawWords : [cleaned.toLowerCase()];
    const wordGroups = allWords.map((w) => ({
      word: w,
      isCommon: COMMON_WORDS.has(w) && keyWords.length > 0 && !keyWords.includes(w),
      variants: Array.from(new Set([w, ...expandQuery(w)])).filter(Boolean),
    }));

    const [productResult, faqs] = await Promise.all([
      this.searchProducts(wordGroups, cleaned),
      this.searchFaqs(cleaned),
    ]);

    if (productResult.length === 0 && faqs.length === 0) {
      return {
        products: [],
        faqs: [],
        searchTerms: keyWords,
        message: 'Хайлтад юм олсонгүй',
      };
    }

    return { products: productResult, faqs, searchTerms: keyWords };
  }

  // ─── Бүтээгдэхүүний хайлт (keyword-AND relevance) ─────────────────────────────
  private async searchProducts(
    wordGroups: { word: string; isCommon: boolean; variants: string[] }[],
    rawQuery: string,
  ): Promise<ProductResult[]> {
    type MatchRow = {
      product_id: string;
      score: number;
      key_hits: number; // хэдэн ГОЛ үг таарсан
      matched: string[]; // таарсан гол үгс
    };

    // Гол үг бүрийн оноо/таарсан тоог тооцох SQL фрагментуудыг үүсгэнэ.
    // Гол үг бүрд: title-д таарвал бүрэн оноо, description-д таарвал хагас.
    const KEY_WEIGHT_TITLE = 10;
    const KEY_WEIGHT_DESC = 5;
    const COMMON_WEIGHT_TITLE = 1;

    // Бүх product-ийн нэгтгэсэн ХАЙХ ТЕКСТ.
    // Product-ийн өөрийн талбараас гадна тухайн product-той холбоотой
    // BundleItem (багц доторх зүйл), Lesson (хичээл), ProductFile (файлын нэр),
    // ProductFAQ-аар оноосон FAQ-уудыг subquery-ээр нэгтгэнэ.
    // Жишээ: "бяруу" нь зөвхөн BundleItem.name-д байдаг — энэ нэгтгэлгүй бол олдохгүй.
    const fullText = Prisma.sql`(
      COALESCE(p.title,'') || ' ' || COALESCE(p.description,'') || ' ' ||
      COALESCE(p."whatsIncluded",'') || ' ' || COALESCE(p."howToUse",'') || ' ' ||
      COALESCE((
        SELECT string_agg(
          COALESCE(bi.name,'') || ' ' || COALESCE(bi.description,'') || ' ' || COALESCE(bi.label,''), ' ')
        FROM "BundleItem" bi
        JOIN "ProductBundle" pb ON pb.id = bi."bundleId"
        WHERE pb."productId" = p.id
      ), '') || ' ' ||
      COALESCE((
        SELECT string_agg(COALESCE(l.title,'') || ' ' || COALESCE(l.description,''), ' ')
        FROM "Lesson" l
        JOIN "Course" c ON c.id = l."courseId"
        WHERE c."productId" = p.id
      ), '') || ' ' ||
      COALESCE((
        SELECT string_agg(COALESCE(pf."fileName",''), ' ')
        FROM "ProductFile" pf WHERE pf."productId" = p.id
      ), '') || ' ' ||
      COALESCE((
        SELECT string_agg(f.question || ' ' || f.answer, ' ')
        FROM "ProductFAQ" pfaq
        JOIN "FAQ" f ON f.id = pfaq."faqId"
        WHERE pfaq."productId" = p.id AND f.active = true
      ), '')
    )`;

    // Үг бүрийн оноо болон таарсан эсэхийг тооцох SQL хэсгүүд
    const scoreParts: Prisma.Sql[] = [];
    const keyHitParts: Prisma.Sql[] = [];
    const matchedParts: Prisma.Sql[] = [];

    for (const g of wordGroups) {
      const pats = g.variants.map((v) => `%${v}%`);
      const patsArr = Prisma.sql`${pats}::text[]`;

      if (g.isCommon) {
        // Түгээмэл үг — зөвхөн title-д таарвал бага оноо
        scoreParts.push(
          Prisma.sql`CASE WHEN p.title ILIKE ANY(${patsArr}) THEN ${COMMON_WEIGHT_TITLE} ELSE 0 END`,
        );
      } else {
        // Гол үг — title-д таарвал их, description/бусдад таарвал дунд оноо
        scoreParts.push(
          Prisma.sql`CASE
            WHEN p.title ILIKE ANY(${patsArr}) THEN ${KEY_WEIGHT_TITLE}
            WHEN ${fullText} ILIKE ANY(${patsArr}) THEN ${KEY_WEIGHT_DESC}
            ELSE 0 END`,
        );
        // Гол үг таарсан эсэх (title эсвэл бүх текстэд)
        keyHitParts.push(
          Prisma.sql`CASE WHEN ${fullText} ILIKE ANY(${patsArr}) THEN 1 ELSE 0 END`,
        );
        matchedParts.push(
          Prisma.sql`CASE WHEN ${fullText} ILIKE ANY(${patsArr}) THEN ${g.word} ELSE NULL END`,
        );
      }
    }

    // Хэрэв гол үг байхгүй бол (бүгд түгээмэл) — key_hits-г 0 болгоно
    const keyHitsSql = keyHitParts.length
      ? Prisma.join(keyHitParts, ' + ')
      : Prisma.sql`0`;
    const scoreSql = scoreParts.length
      ? Prisma.join(scoreParts, ' + ')
      : Prisma.sql`0`;
    const matchedSql = matchedParts.length
      ? Prisma.sql`ARRAY_REMOVE(ARRAY[${Prisma.join(matchedParts)}], NULL)`
      : Prisma.sql`ARRAY[]::text[]`;

    // Бүх variant (similarity fallback-д ашиглах)
    const allVariants = Array.from(
      new Set(wordGroups.flatMap((g) => g.variants)),
    );

    const rows = await this.prisma.$queryRaw<MatchRow[]>(Prisma.sql`
      WITH scored AS (
        SELECT
          p.id AS product_id,
          (${scoreSql})::int AS score,
          (${keyHitsSql})::int AS key_hits,
          ${matchedSql} AS matched,
          -- similarity fallback (үсгийн алдаа, хагас үг)
          (SELECT COALESCE(max(similarity(p.title, t)), 0)
           FROM unnest(${allVariants}::text[]) AS t) AS sim
        FROM "Product" p
        WHERE p.published = true
      )
      SELECT product_id, score, key_hits, matched
      FROM scored
      WHERE score > 0 OR sim > 0.3
      ORDER BY key_hits DESC, score DESC, sim DESC
      LIMIT 20
    `);

    if (!rows.length) return [];

    // ── Relevance шүүлт ──
    // Ядаж 1 ГОЛ үг таарсан бүтээгдэхүүн байвал → зөвхөн тэдгээрийг авна
    // (түгээмэл үгээр л таарсан "шум"-ыг хасна).
    // ЧУХАЛ: key_hits-ийг Number()-ээр хөрвүүлнэ. Зарим тохиолдолд Postgres
    // bigint буцааж Math.max(...) TypeError өгдөг ("max is not a function"/
    // BigInt convert) — тиймээс reduce-аар найдвартай тооцно.
    const maxKeyHits = rows.reduce(
      (m, r) => Math.max(m, Number(r.key_hits) || 0),
      0,
    );
    let relevant: MatchRow[];
    if (maxKeyHits > 0) {
      // Хамгийн олон гол үг таарсан түвшний бүтээгдэхүүнүүд (доод тал нь 1 гол үг)
      relevant = rows.filter((r) => Number(r.key_hits) >= 1);
    } else {
      // Гол үг огт таараагүй — top хэдийг (түгээмэл/similarity) буцаана
      relevant = rows.slice(0, 5);
    }

    // Top 10
    relevant = relevant.slice(0, 10);

    const productIds = relevant.map((r) => r.product_id);

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
    const rowMap = new Map(relevant.map((r) => [r.product_id, r]));

    const result: ProductResult[] = [];

    for (const id of productIds) {
      const product = products.find((p) => p.id === id);
      if (!product) continue;

      const row = rowMap.get(id)!;
      const matched = (row.matched || []).filter(Boolean);

      const primaryImage = product.images.find(
        (img) => !img.videoUrl && img.fileKey,
      );
      const imageUrl = primaryImage
        ? this.storage.getAssetUrl(primaryImage.fileKey)
        : null;

      const currentPrice = Number(product.price);
      const compareAt =
        product.compareAtPrice != null ? Number(product.compareAtPrice) : null;
      const hasDiscount = compareAt != null && compareAt > currentPrice;
      const basePrice = hasDiscount ? compareAt! : currentPrice;
      const salePrice = hasDiscount ? currentPrice : null;

      const productType = typeLabelMap.get(product.type) ?? product.type;

      // matchReason: AI-д зориулж, ямар үгээр олдсоныг тодорхой бичнэ
      const matchReason = matched.length
        ? `Хайлтын "${matched.join(', ')}" гэсэн үг(ийг) энэ бүтээгдэхүүний нэр эсвэл тайлбараас олсон.`
        : 'Хайлтын үгтэй ойролцоо тохирол олдсон.';

      result.push({
        id: product.id,
        title: product.title,
        description: product.description,
        price: basePrice,
        salePrice,
        imageUrl,
        productType,
        url: `${SITE_URL}/products/${product.slug}`,
        matchReason,
        matchedKeywords: matched,
      });
    }

    return result;
  }

  // ─── FAQ хайлт (backend-ийн БҮХ идэвхтэй FAQ-аас) ────────────────────────────
  private async searchFaqs(rawQuery: string): Promise<FaqResult[]> {
    // FAQ-д галиг + үг-AND хэрэггүй (ерөнхий асуулт), энгийн ILIKE + similarity
    const variants = Array.from(
      new Set([rawQuery.toLowerCase(), ...expandQuery(rawQuery)]),
    ).filter(Boolean);
    const pats = variants.map((v) => `%${v}%`);

    type FaqRow = { question: string; answer: string; score: number };

    const rows = await this.prisma.$queryRaw<FaqRow[]>(Prisma.sql`
      SELECT
        f.question,
        f.answer,
        (
          CASE WHEN f.question ILIKE ANY(${pats}::text[]) THEN 2 ELSE 0 END
          + CASE WHEN f.answer ILIKE ANY(${pats}::text[]) THEN 1 ELSE 0 END
          + (SELECT COALESCE(max(similarity(f.question || ' ' || f.answer, t)), 0)
             FROM unnest(${variants}::text[]) AS t)
        )::float AS score
      FROM "FAQ" f
      WHERE f.active = true
        AND (
          f.question ILIKE ANY(${pats}::text[])
          OR f.answer ILIKE ANY(${pats}::text[])
          OR (SELECT max(similarity(f.question || ' ' || f.answer, t)) > 0.2
              FROM unnest(${variants}::text[]) AS t)
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
