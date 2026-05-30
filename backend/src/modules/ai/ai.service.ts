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
  searchTerms?: string[];
  message?: string;
}

export type SearchResult = ProductResult;

const SITE_URL = 'https://digitalger.mn';

// ─── Монгол үгийн нөхцөл хасагч (хялбар stemmer) ──────────────────────────────
// Монгол хэлэнд нэг үгийн олон хувилбар: ферм/фермийн/фермд/фермээс.
// Хэрэглэгч "фермийн" гэж бичихэд DB-д "ферм", "фермер" байж болно.
// Тиймээс хайлтын өмнө түгээмэл нөхцлийг хасч ҮНДСИЙГ нь гаргана.
// Дараа нь prefix tsquery (үндэс:*) хэрэглэснээр бүх нөхцөлтэй хувилбар таарна:
//   "ферм" → "ферм:*" → ферм, фермийн, фермер, фермд бүгд таарна.
const MN_SUFFIXES = [
  // 4-5 үсэгт (урт нөхцөл эхэнд — урт нь түрүүлж таарна)
  'уудаас', 'үүдээс', 'ийнхээ', 'ынхаа',
  'аасаа', 'ээсээ', 'оосоо', 'өөсөө',
  'нуудад', 'нүүдэд', 'чуудад', 'чүүдэд',
  'ийгээ', 'ыгаа', 'дээ', 'таа', 'тоо', 'дой',
  // 3 үсэгт
  'ийн', 'ыйн', 'ний', 'нии', 'ний', 'аас', 'ээс', 'оос', 'өөс',
  'тай', 'тэй', 'той', 'руу', 'рүү', 'луу', 'лүү',
  'аар', 'ээр', 'оор', 'өөр', 'иар',
  'нууд', 'нүүд', 'чууд', 'чүүд', 'ууд', 'үүд',
  // 2 үсэгт
  'ын', 'ин', 'ий', 'ыг', 'иг', 'ад', 'эд', 'од', 'өд',
  'аа', 'ээ', 'оо', 'өө', 'ьш',
  // 1 үсэгт
  'д', 'г', 'т', 'ч',
];

function mnStem(word: string): string {
  let w = word;
  // Хамгийн урт тохирох нөхцлийг нэг л удаа хасна (давхар хасахгүй —
  // үндэс хэт богино болохоос сэргийлнэ).
  for (const suf of MN_SUFFIXES) {
    if (w.length - suf.length >= 3 && w.endsWith(suf)) {
      return w.slice(0, w.length - suf.length);
    }
  }
  return w;
}

// ─── Stop words / туслах үгс ──────────────────────────────────────────────────
// Эдгээр үг хайлтад утгагүй (асуулт, төлөөний, туслах үйл үг). Хайлтаас БҮРЭН
// хасна — relevance-д огт нөлөөлөхгүй. ("байна уу", "сайн уу", "вэ" гэх мэт)
const STOP_WORDS = new Set([
  'байна', 'уу', 'юу', 'вэ', 'бэ', 'сайн', 'уу?', 'байна?',
  'би', 'та', 'таны', 'миний', 'бид', 'бидний', 'танд', 'надад',
  'хайж', 'хайх', 'хайя', 'асууя', 'асуух', 'үзэх', 'үзье', 'авах', 'авъя',
  'болох', 'болно', 'байгаа', 'байх', 'гэж', 'гэсэн', 'гэдэг',
  'болон', 'бас', 'мөн', 'эсвэл', 'ямар', 'хэдэн', 'хэр', 'аль',
  'энэ', 'тэр', 'ийм', 'тийм', 'дээр', 'доор', 'дотор', 'тухай',
  'нь', 'ний', 'ийн', 'ын', 'ийг', 'ыг', 'тай', 'тэй', 'той',
  'сонирхож', 'сонирхъё', 'хэрэгтэй', 'хүсч', 'хүсье',
  // Мэндчилгээ / ерөнхий харилцаа
  'hi', 'hello', 'мэнд', 'мэндээ', 'мэндчилгээ', 'өдрийн', 'өглөөний',
  'оройн', 'баяртай', 'баярлалаа', 'сонин', 'хүн', 'юм',
  // Холбоо барих / тусламж (FAQ хариулдаг — хайлт хийхгүй)
  'холбоо', 'барих', 'холбогдох', 'тусламж', 'админ', 'хүнтэй',
  // Татах / худалдан авах процесс (FAQ хариулдаг)
  'татаж', 'татах', 'авсан', 'файлаа', 'яаж', 'хэрхэн', 'хаанаас',
  'төлбөр', 'төлбөрөө', 'төлөх', 'худалдаж', 'захиалга', 'захиалах',
  // ─── ЛАТИН хувилбарууд (хэрэглэгч латинаар их бичдэг) ──────────────────────
  // Асуулт / туслах
  'baina', 'bna', 'bn', 'yu', 'yum', 've', 'be', 'sain', 'uu',
  'bolohuu', 'boloh', 'bolno', 'bolomjtoi', 'hiih', 'hiij', 'hiine',
  'yaj', 'yaaj', 'herhen', 'herhen', 'haanaas', 'hed', 'hediy', 'aль',
  'bi', 'ta', 'tani', 'tanii', 'minii', 'nadad', 'tand',
  'haij', 'haih', 'asuuh', 'asuuya', 'uzeh', 'avah', 'avya',
  // Мэндчилгээ
  'hi', 'hello', 'mend', 'mendee', 'sonin', 'hun', 'odriin', 'ogloonii',
  // Холбоо барих
  'holboo', 'barih', 'holbogdoh', 'tuslamj', 'tuslamzh', 'admin', 'huntei',
  // Татах / төлбөр процесс
  'tataj', 'tatah', 'avsan', 'failaa', 'fail', 'tolbor', 'tulbur',
  'tulburuu', 'tolboroo', 'toloh', 'tolokh', 'hudaldaj', 'zahialga',
  'zahialah', 'qpay', 'kart', 'data',
]);

// ─── Түгээмэл (жин багатай) үгс ───────────────────────────────────────────────
// Хайлтад утга бий ч бараг бүх бүтээгдэхүүнд байдаг тул сул жинтэй.
// Зөвхөн эдгээрээр таарсныг "гол тохирол" гэж тооцохгүй.
const COMMON_WORDS = new Set([
  'бэлэн', 'төсөл', 'төслүүд', 'төслийн', 'загвар', 'загварууд',
  'багц', 'файл', 'материал', 'гарын', 'авлага', 'иж', 'бүрдэл',
  'үйлдвэр', 'үйлдвэрийн', 'аж', 'ахуй', 'ахуйн', 'бизнес', 'бизнесийн',
]);

// ─── Хайлтын стратеги (tsvector word-boundary + keyword-AND) ──────────────────
//
// АСУУДАЛ (хуучин): substring ILIKE ('%сүү%') нь үг ДУНДААС таардаг тул
// "сүү" → "Сүүлт од" (ном) олдог байв. Мөн "байна уу" доторх "уу" гол үг
// болж бараг бүх бүтээгдэхүүн буцдаг байв.
//
// ШИЙДЭЛ:
// 1) Stop word ("уу", "байна", "сайн"...) бүрэн хасна.
// 2) Үг бүрийг tsvector('simple') @@ tsquery prefix (үг:*) -ээр тааруулна —
//    энэ нь ҮГ ХЯЗГААР баримталдаг (сүү → "сүү", "сүүний" таарна, "Сүүлт"
//    ТААРАХГҮЙ). 'simple' config нь stem хийхгүй, яг үсгээр.
// 3) Product бүрд хэдэн ГОЛ үг таарсныг (key_hits) тоолж relevance өгнө.
//    БҮХ гол үг таарсан product эхэнд; цөөн таарсныг хасна.
// 4) tsvector нь Product талбар + BundleItem/Lesson/File/FAQ-г нэгтгэнэ.
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

    // 1) Үгсэд задлах, цэвэрлэх, stop word хасах
    const rawWords = cleaned
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/['"\\:&|!()?.,;]/g, '').trim())
      .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));

    // ЧУХАЛ: бүх үг stop word бол (мэндчилгээ "сайн уу", "юу байна" г.м.) →
    // хайлт ХИЙХГҮЙ, хоосон буцаана. Ингэснээр chatbot-д ердийн харилцааны
    // мессежид карт гарахгүй, AI зүгээр л ярьж хариулна.
    // (Өмнө энд fallback байсан нь "сайн уу"-г хайж бүх product буцаадаг байв.)
    const words = rawWords;
    if (words.length === 0) {
      return { products: [], faqs: [], searchTerms: [], message: 'Хайлтад юм олсонгүй' };
    }

    // 2) Гол үг (түгээмэл биш). Бүгд түгээмэл бол бүгдийг гол гэж үзнэ.
    let keyWords = words.filter((w) => !COMMON_WORDS.has(w));
    if (keyWords.length === 0) keyWords = [...words];

    // 3) Үг бүрийн хайх хувилбарууд:
    //    - өөрөө (ферм)
    //    - Монгол нөхцөл хассан үндэс (фермийн → ферм) — DB-д "ферм","фермер"
    //      гэх олон нөхцөлтэй хувилбартай таарахын тулд
    //    - галиг (Латин↔Кирилл) — өөрийн болон үндсийн аль алинд
    const wordGroups = words.map((w) => {
      const stem = mnStem(w);
      const base = new Set<string>([w]);
      if (stem !== w && stem.length >= 3) base.add(stem);
      // Галиг хувилбаруудыг өөр + үндэст хоёуланд нэмнэ
      const variants = new Set<string>();
      for (const b of base) {
        variants.add(b);
        for (const v of expandQuery(b)) variants.add(v);
      }
      return {
        word: w,
        isCommon: COMMON_WORDS.has(w) && !keyWords.includes(w),
        variants: Array.from(variants).filter(Boolean),
      };
    });

    const [productResult, faqs] = await Promise.all([
      this.searchProducts(wordGroups),
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

  // ─── Бүтээгдэхүүний хайлт ─────────────────────────────────────────────────────
  private async searchProducts(
    wordGroups: { word: string; isCommon: boolean; variants: string[] }[],
  ): Promise<ProductResult[]> {
    type MatchRow = {
      product_id: string;
      score: number;
      key_hits: number;
      matched: string[];
    };

    const KEY_W_TITLE = 10;
    const KEY_W_BODY = 5;
    const COMMON_W = 1;

    // Product бүрийн нэгдсэн ХАЙХ ТЕКСТ: өөрийн талбар + BundleItem + Lesson +
    // ProductFile + оноосон FAQ. Энэ текстийг tsvector болгож үг хязгаараар хайна.
    const bodyText = Prisma.sql`(
      COALESCE(p.title,'') || ' ' || COALESCE(p.description,'') || ' ' ||
      COALESCE(p."whatsIncluded",'') || ' ' || COALESCE(p."howToUse",'') || ' ' ||
      COALESCE((SELECT string_agg(
          COALESCE(bi.name,'') || ' ' || COALESCE(bi.description,'') || ' ' || COALESCE(bi.label,''), ' ')
        FROM "BundleItem" bi JOIN "ProductBundle" pb ON pb.id = bi."bundleId"
        WHERE pb."productId" = p.id), '') || ' ' ||
      COALESCE((SELECT string_agg(COALESCE(l.title,'') || ' ' || COALESCE(l.description,''), ' ')
        FROM "Lesson" l JOIN "Course" c ON c.id = l."courseId"
        WHERE c."productId" = p.id), '') || ' ' ||
      COALESCE((SELECT string_agg(COALESCE(pf."fileName",''), ' ')
        FROM "ProductFile" pf WHERE pf."productId" = p.id), '') || ' ' ||
      COALESCE((SELECT string_agg(f.question || ' ' || f.answer, ' ')
        FROM "ProductFAQ" pfaq JOIN "FAQ" f ON f.id = pfaq."faqId"
        WHERE pfaq."productId" = p.id AND f.active = true), '')
    )`;

    // tsvector-уудыг урьдчилан тооцно (simple config — stem хийхгүй, үг хязгаар).
    const titleTsv = Prisma.sql`to_tsvector('simple', COALESCE(p.title,''))`;
    const bodyTsv = Prisma.sql`to_tsvector('simple', ${bodyText})`;

    // Үг бүрийн оноо/таарсан тоо/нэрийг тооцох SQL фрагмент.
    const scoreParts: Prisma.Sql[] = [];
    const keyHitParts: Prisma.Sql[] = [];
    const matchedParts: Prisma.Sql[] = [];

    for (const g of wordGroups) {
      // Галиг хувилбар бүрийг prefix tsquery болгоно: "сүү:* | suu:* ..."
      // Үсгийн алдаа/нэмэлт нөхцлийг prefix (:*) баримтална (сүү → сүүний).
      const tsq = g.variants
        .map((v) => v.replace(/[':&|!()*]/g, '').trim())
        .filter(Boolean)
        .map((v) => `${v}:*`)
        .join(' | ');
      const tsqSql = tsq || 'zzz_no_match_zzz';

      if (g.isCommon) {
        // Түгээмэл үг — body-д таарвал бага оноо
        scoreParts.push(
          Prisma.sql`CASE WHEN ${bodyTsv} @@ to_tsquery('simple', ${tsqSql}) THEN ${COMMON_W} ELSE 0 END`,
        );
      } else {
        // Гол үг — title-д их, body-д дунд оноо
        scoreParts.push(
          Prisma.sql`CASE
            WHEN ${titleTsv} @@ to_tsquery('simple', ${tsqSql}) THEN ${KEY_W_TITLE}
            WHEN ${bodyTsv}  @@ to_tsquery('simple', ${tsqSql}) THEN ${KEY_W_BODY}
            ELSE 0 END`,
        );
        keyHitParts.push(
          Prisma.sql`CASE WHEN ${bodyTsv} @@ to_tsquery('simple', ${tsqSql}) THEN 1 ELSE 0 END`,
        );
        matchedParts.push(
          Prisma.sql`CASE WHEN ${bodyTsv} @@ to_tsquery('simple', ${tsqSql}) THEN ${g.word} ELSE NULL END`,
        );
      }
    }

    const keyHitsSql = keyHitParts.length
      ? Prisma.join(keyHitParts, ' + ')
      : Prisma.sql`0`;
    const scoreSql = scoreParts.length ? Prisma.join(scoreParts, ' + ') : Prisma.sql`0`;
    const matchedSql = matchedParts.length
      ? Prisma.sql`ARRAY_REMOVE(ARRAY[${Prisma.join(matchedParts)}], NULL)`
      : Prisma.sql`ARRAY[]::text[]`;

    const rows = await this.prisma.$queryRaw<MatchRow[]>(Prisma.sql`
      WITH scored AS (
        SELECT
          p.id AS product_id,
          (${scoreSql})::int AS score,
          (${keyHitsSql})::int AS key_hits,
          ${matchedSql} AS matched
        FROM "Product" p
        WHERE p.published = true
      )
      SELECT product_id, score, key_hits, matched
      FROM scored
      WHERE key_hits > 0
      ORDER BY key_hits DESC, score DESC
      LIMIT 20
    `);

    if (!rows.length) return [];

    // ── Relevance шүүлт ──
    // ХАМГИЙН олон гол үг таарсан түвшнийг (maxKeyHits) тогтооно.
    // Зөвхөн maxKeyHits таарсан product-уудыг авна — өөрөөр хэлбэл хэрэглэгчийн
    // оруулсан гол үгсийн ХАМГИЙН ИХ хувийг хангасныг л үзүүлнэ.
    // Жишээ: "сүүний ферм" → 2 үг таарсан (Мал аж ахуй) байвал зөвхөн 1 үг
    // таарсан (Номын сан-д "сүүний"-only) хасагдана.
    const maxKeyHits = rows.reduce(
      (m, r) => Math.max(m, Number(r.key_hits) || 0),
      0,
    );
    const relevant = rows
      .filter((r) => Number(r.key_hits) >= maxKeyHits)
      .slice(0, 10);

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

      const matchReason = matched.length
        ? `Хайлтын "${matched.join(', ')}" үг(ийг) энэ бүтээгдэхүүний нэр, тайлбар эсвэл доторх жагсаалтаас олсон.`
        : 'Хайлтын үгтэй тохирол олдсон.';

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

  // ─── FAQ хайлт (БҮХ идэвхтэй FAQ-аас, үг хязгаараар) ──────────────────────────
  private async searchFaqs(rawQuery: string): Promise<FaqResult[]> {
    // Stop word хассан гол үгсээ tsquery болгоно
    const words = rawQuery
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/['"\\:&|!()?.,;]/g, '').trim())
      .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
    if (words.length === 0) return [];

    // Үг бүрийн үндэс + галиг + prefix tsquery (бүх үг заавал биш, аль нэг таарвал)
    const variants = words.flatMap((w) => {
      const stem = mnStem(w);
      const base = stem !== w && stem.length >= 3 ? [w, stem] : [w];
      return base.flatMap((b) => [b, ...expandQuery(b)]);
    });
    const tsq = variants
      .map((v) => v.replace(/[':&|!()*]/g, '').trim())
      .filter(Boolean)
      .map((v) => `${v}:*`)
      .join(' | ');
    if (!tsq) return [];

    type FaqRow = { question: string; answer: string; score: number };

    const rows = await this.prisma.$queryRaw<FaqRow[]>(Prisma.sql`
      SELECT
        f.question,
        f.answer,
        ts_rank(to_tsvector('simple', f.question || ' ' || f.answer),
                to_tsquery('simple', ${tsq})) AS score
      FROM "FAQ" f
      WHERE f.active = true
        AND to_tsvector('simple', f.question || ' ' || f.answer)
            @@ to_tsquery('simple', ${tsq})
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
