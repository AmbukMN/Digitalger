import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { withSiteScope } from '../common/site/site-extension';

/**
 * ⚠️⚠️ САЙТААР ТУСГААРЛАСАН PRISMA CLIENT.
 *
 * `withSiteScope` нь query бүрд одоогийн сайтын шүүлтийг АВТОМАТААР
 * нэмнэ. Ингэснээр 36 модулийн 200+ query-д `site` гараар бичих
 * шаардлагагүй — мартах эрсдэл үндсээр нь арилна.
 *
 * ⚠️⚠️⚠️ ЯАГААД PROXY ВЭ — БОДИТ АЛДААНААС СУРСАН:
 *
 * Эхлээд `Object.keys(ext)`-ийг `this` рүү хуулах аргыг туршсан.
 * Энгийн query (`user.findMany`) ажилласан ч **`$transaction` ДОТОР
 * ӨРГӨТГӨЛ ОГТ АЖИЛЛААГҮЙ**:
 *
 * ```
 * await svc.$transaction(async (tx) => { await tx.user.count(); });
 * // → өргөтгөлийн лог ГАРААГҮЙ, site шүүлт хийгдээгүй
 * ```
 *
 * Учир нь `$transaction` нь дотроо `this._createItxClient()` дуудна;
 * хуулбарласан үед `this` нь өргөтгөлгүй PrismaService болно.
 *
 * ⚠️ ЭНЭ НЬ ЧИМЭЭГҮЙ АЛДАА БАЙХ БАЙСАН: код compile болно, энгийн
 * тест өнгөрнө, гэхдээ 22 `$transaction`-ий дотор өгөгдөл ХОЛИЛДОНО
 * (төлбөр баталгаажуулах, захиалга үүсгэх зэрэг ХАМГИЙН чухал
 * үйлдлүүд яг тэнд байдаг).
 *
 * ЗАСВАР: constructor-оос Proxy буцаана. JS-ийн дүрмээр
 * `new PrismaService()` нь тэр Proxy-г өгнө. Proxy нь БҮХ хандалтыг
 * өргөтгөсөн client рүү шилжүүлдэг тул `$transaction` ч өргөтгөлтэй
 * `tx` үүсгэнэ (батлагдсан — `.tmp-probe/tx-fix3.mjs`).
 *
 * ⚠️ `instanceof PrismaClient` нь `false` болно. Кодод хаана ч
 * ашиглагддаггүйг шалгасан.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();

    /* ⚠️ Холболтын амьдралын мөчлөгийг ҮНДСЭН client удирдана */
    const base = this;
    const scoped = withSiteScope(this);

    return new Proxy(scoped, {
      get(target, prop, receiver) {
        /**
         * ⚠️ `$connect` / `$disconnect` — өргөтгөл нь эдгээрийг
         * дамжуулдаг ч, үндсэн client дээр дуудах нь найдвартай
         * (холболтын pool түүнд харьяалагдана).
         */
        if (prop === '$connect' || prop === '$disconnect') {
          return base[prop].bind(base);
        }
        /* Nest-ийн lifecycle — Proxy дээр класс метод байхгүй */
        if (prop === 'onModuleInit') return () => base.$connect();
        if (prop === 'onModuleDestroy') return () => base.$disconnect();

        const value = Reflect.get(target, prop, receiver);
        /**
         * ⚠️ Функцийг `target`-д bind хийнэ. Үгүй бол `this` нь
         * Proxy болж, Prisma-гийн дотоод `#private` талбарууд
         * «Cannot read private member» алдаа өгнө.
         */
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as unknown as PrismaService;
  }

  /**
   * ⚠️ Эдгээр нь Proxy-гоор дарагдана (дээрх `get`). Энд байгаа нь
   * TypeScript-д `implements OnModuleInit` -ийг хангахын тулд.
   */
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
