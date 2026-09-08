import type { PrismaClient } from '@prisma/client';
import { currentSite, hasSiteContext, isAllSites } from './site-context';
import { isMultiSiteModel, isScopedModel, siteWhereFragment } from './site-models';

/**
 * ⚠️⚠️ АВТОМАТ САЙТЫН ШҮҮЛТ — Prisma query өргөтгөл.
 *
 * ЗОРИЛГО: 36 модулийн 200+ query бүрд `site` нэмэхийг мартах
 * эрсдэлийг ҮНДСЭЭР нь арилгах. Мартвал өгөгдөл ХОЛИЛДОНО —
 * BestFilm-ийн хэрэглэгч BestTV-ийн төлбөр хардаг болно.
 *
 * ⚠️ ЯАГААД `$allOperations` ВЭ: `findMany` дангаараа хангалтгүй.
 * `count`, `aggregate`, `groupBy`, `updateMany`, `deleteMany` бүгд
 * шүүгдэх ёстой. Prisma 6-д эдгээр бүгд `Operation` төрөлд багтана.
 */

/* Уншилт — `where` нэмнэ */
const READ_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

/* Олноор нь өөрчлөх — `where` нэмнэ. ⚠️ Хамгаалалт ЧУХАЛ: site-гүй
   `updateMany` нь ХОЁР сайтын мөрийг зэрэг өөрчилнө. */
const BULK_WRITE_OPS = new Set(['updateMany', 'updateManyAndReturn', 'deleteMany']);

/* Шинээр үүсгэх — `data`-д site бичнэ */
const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);

/**
 * ⚠️⚠️ findUnique / update / delete / upsert — ОНЦГОЙ.
 *
 * Эдгээрийн `where` нь ЗӨВХӨН unique талбар авдаг. `site` нэмбэл
 * Prisma «Unknown argument `site`» гэж алдаа шиднэ.
 *
 * ШИЙДЭЛ: эдгээрийг `findFirst`/`updateMany`-руу ХӨРВҮҮЛЭХГҮЙ —
 * тэр нь буцах утгын төрлийг эвдэнэ. Оронд нь:
 *   · Схемийн `@@unique([email, site])`-ээр Prisma өөрөө site шаардана
 *     (compile алдаа гарч, кодыг засахад хүргэнэ — ЗӨВ)
 *   · `id`-аар хайх нь аюулгүй: id нь глобал давтагдашгүй cuid,
 *     өөр сайтын id-г мэдэх боломжгүй. Гэхдээ ХАМГААЛАЛТ хэрэгтэй —
 *     `postFilterUnique` нь буцсан мөрийн site-ыг шалгана.
 */
const UNIQUE_READ_OPS = new Set(['findUnique', 'findUniqueOrThrow']);

type QueryArgs = { where?: Record<string, unknown>; data?: unknown } & Record<string, unknown>;

/** `where`-д site нөхцөл нэмнэ (байгаа нөхцөлийг ХАДГАЛНА). */
function injectWhere(args: QueryArgs, fragment: Record<string, unknown>): QueryArgs {
  const where = args.where;
  /**
   * ⚠️ `AND`-аар нэмнэ, шууд spread ХИЙХГҮЙ. Учир нь query-д аль
   * хэдийн `site` эсвэл `OR` байвал spread нь түүнийг ДАРЖ БИЧНЭ.
   * `AND` нь хоёуланг хүчинтэй байлгана.
   */
  return { ...args, where: where ? { AND: [where, fragment] } : fragment };
}

/** `data`-д site бичнэ. Аль хэдийн заасан бол ХҮНДЭТГЭНЭ. */
function injectData(args: QueryArgs, key: string, value: unknown): QueryArgs {
  const data = args.data;
  if (Array.isArray(data)) {
    /* createMany — мөр бүрд */
    return {
      ...args,
      data: data.map((row: Record<string, unknown>) =>
        row && typeof row === 'object' && key in row ? row : { ...row, [key]: value },
      ),
    };
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (key in obj) return args; // ⚠️ зориуд заасан — хөндөхгүй
    return { ...args, data: { ...obj, [key]: value } };
  }
  return args;
}

/**
 * Prisma client-д сайтын автомат шүүлт нэмнэ.
 *
 * ⚠️ ЭНЭ НЬ ГАНЦ УДАА, PrismaService-ийн constructor-т дуудагдана.
 * Хүсэлт бүрд БИШ — тэгвэл холболтын pool задарна.
 */
export function withSiteScope<T extends PrismaClient>(client: T) {
  return client.$extends({
    name: 'site-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          /**
           * ⚠️ Context БАЙХГҮЙ = хүсэлтээс гадуур (cron, worker, seed).
           * Тэнд БҮХ сайтын өгөгдөлд ажиллах ёстой (жишээ: захиалгын
           * хугацаа дуусгах watchdog хоёр сайтыг хамарна).
           */
          if (!hasSiteContext()) return query(args);

          /* Админы «бүх сайт» горим — шүүлт алгасна */
          if (isAllSites()) return query(args);

          const site = currentSite();
          const scoped = isScopedModel(model);
          const multi = isMultiSiteModel(model);
          if (!scoped && !multi) return query(args);

          const a = (args ?? {}) as QueryArgs;
          const fragment = siteWhereFragment(model, site);

          /* ── Уншилт ба олноор өөрчлөх: where-д нэмнэ ── */
          if (fragment && (READ_OPS.has(operation) || BULK_WRITE_OPS.has(operation))) {
            return query(injectWhere(a, fragment));
          }

          /* ── Үүсгэх: data-д бичнэ ── */
          if (CREATE_OPS.has(operation)) {
            if (multi) {
              /**
               * ⚠️ Title — `sites[]`. Шинэ кино нь ЗӨВХӨН одоогийн
               * сайтад нийтлэгдэнэ. Хоёуланд нийтлэх бол админ
               * зориуд `sites`-ыг заана (injectData хүндэтгэнэ).
               */
              return query(injectData(a, 'sites', [site]));
            }
            return query(injectData(a, 'site', site));
          }

          /* ── upsert: where нь unique, create/update дотор site ── */
          if (operation === 'upsert') {
            const u = a as QueryArgs & { create?: unknown };
            const key = multi ? 'sites' : 'site';
            const val = multi ? [site] : site;
            const create = u.create;
            const withCreate =
              create && typeof create === 'object' && !(key in (create as object))
                ? { ...u, create: { ...(create as object), [key]: val } }
                : u;
            return query(withCreate);
          }

          /**
           * ── findUnique / update / delete ──
           *
           * `where` нь unique шаарддаг тул site нэмэхгүй. Оронд нь
           * ҮР ДҮНГ шалгана: өөр сайтын мөр буцвал `null` болгоно.
           *
           * ⚠️ Энэ нь ХАМГААЛАЛТ, гол шүүлт биш. Гол хамгаалалт нь
           * схемийн `@@unique([email, site])` — тэр нь compile
           * түвшинд site шаардана.
           */
          const result = await query(args);

          if (UNIQUE_READ_OPS.has(operation) && result && typeof result === 'object') {
            const row = result as Record<string, unknown>;
            if (scoped && 'site' in row && row.site !== site) return null;
            if (multi && Array.isArray(row.sites) && !row.sites.includes(site)) return null;
          }

          return result;
        },
      },
    },
  });
}

/** Өргөтгөсөн client-ийн төрөл — PrismaService эндээс өвлөнө. */
export type SiteScopedClient = ReturnType<typeof withSiteScope<PrismaClient>>;
