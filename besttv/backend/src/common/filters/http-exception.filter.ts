import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { ErrorsService } from '../../modules/errors/errors.module';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  /**
   * ⚠️⚠️ `@Optional()` ЗААВАЛ. Энэ шүүлтүүр нь `main.ts`-д ГАРААР
   * үүсгэгддэг (`new HttpExceptionFilter()`) бөгөөс тэнд DI байхгүй.
   * Заавал шаардвал сервер ОГТ АСАХГҮЙ болно.
   *
   * Байвал 500 алдааг DB-д ч хадгална → админ `/errors` хуудсанд
   * browser болон серверийн алдаа НЭГ дор харагдана.
   */
  constructor(@Optional() private readonly errors?: ErrorsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    /**
     * ⚠️⚠️ PRISMA-ГИЙН VALIDATION АЛДАА нь ҮРГЭЛЖ КЛИЕНТИЙН БУРУУ ОРОЛТ.
     *
     * ⛔ БОДИТ АСУУДАЛ (2026-09-09 аудит): `@Query('limit') limit?: number`
     * гэсэн ПРИМИТИВ параметрт глобал `ValidationPipe` ХҮРДЭГГҮЙ тул
     * `?limit=abc` → `NaN` → Prisma-д очиж `PrismaClientValidationError`
     * → **500**. 25+ endpoint нөлөөлсөн (`titles`, `blog`, `email`,
     * `users`, `wallet`, `payments-admin`…).
     *
     * Үр дагавар: (1) клиентэд буруу дохио (серверийн алдаа гэж ойлгоно,
     * дахин оролдоно), (2) админы `/errors` хуудас хог алдаагаар дүүрнэ
     * — бодит доголдол дунд нь алдагдана.
     *
     * ⚠️ Энд НЭГ газраас засаж байгаа шалтгаан: 25+ controller гараар
     * засах нь регрессийн эрсдэл өндөр. `PrismaClientValidationError`
     * нь схемд нийцээгүй аргумент илэрхийлдэг ба хэрэглэгчийн оролт л
     * тэр байдалд хүргэдэг тул 400 нь утга зүйн хувьд ЗӨВ.
     *
     * ⚠️ Мессежийг ХЭЛДЭГГҮЙ — доорх production нуулт хэвээр үйлчилнэ
     * (query бүтэц задрахгүй).
     */
    const isPrismaValidation =
      exception instanceof Error && exception.constructor.name === 'PrismaClientValidationError';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : isPrismaValidation
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    /**
     * ⚠️⚠️ PRODUCTION-Д ДОТООД АЛДААГ НУУНА.
     *
     * ⛔ БОДИТ ЦООРХОЙ (2026-09-09 аудит, production дээр батлагдсан):
     * `HttpException` БИШ алдааны түүхий `message` шууд клиент рүү
     * явдаг байв. Жишээ — `GET /api/titles?limit=abc`:
     *
     *   500 {"message":["Invalid `prisma.title.findMany()` invocation:
     *   { where: { AND: [{isActive:true},{sites:{has:"besttv"}}] },
     *     orderBy:{createdAt:"desc"}, skip: NaN, select:{...} }"]}
     *
     * Халдагч ямар ч буруу параметрээр Prisma query бүтэц, багана нэр,
     * `site` шүүлтийн ДОТООД ЛОГИК, select талбаруудыг бүгдийг харна —
     * дараагийн халдлагын зураглал.
     *
     * ⚠️ `HttpException` (`BadRequestException` г.м.) нь ЗОРИУД
     * бичигдсэн, хэрэглэгчид зориулсан мессеж тул ХЭВЭЭР дамжина.
     * Зөвхөн гэнэтийн (500) алдааг нууна.
     *
     * ⚠️ Дэлгэрэнгүй нь logger болон `ErrorLog`-д ХЭВЭЭР бичигдэнэ
     * (доор) — админ `/errors` хуудсанд бүрэн харна.
     */
    const isProd = process.env.NODE_ENV === 'production';
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : ((exceptionResponse as { message?: string | string[] })?.message ??
          (isPrismaValidation
            ? /* ⚠️ 400 — оролт буруу гэж ХЭЛНЭ, гэхдээ query бүтэц задлахгүй */
              'Хүсэлтийн параметр буруу байна.'
            : exception instanceof Error && !isProd
              ? exception.message
              : 'Дотоод алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.'));

    // Request ID — ирсэн header байвал ашиглана, эс бол шинээр үүсгэнэ.
    // Энэ нь production дээр алдааг log-той тулгаж дебаг хийхэд хэрэгтэй.
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ||
      randomUUID();

    if (status >= 500) {
      // Структурлэсэн дэлгэрэнгүй log — Sentry-гүйгээр ч production debug
      // дээшилнэ (timestamp, method, path, requestId, stack).
      const errStack =
        exception instanceof Error ? exception.stack : String(exception);
      const stackHead = errStack
        ? errStack.split('\n').slice(0, 6).join('\n')
        : 'no stack';

      this.logger.error(
        JSON.stringify({
          level: 'fatal',
          timestamp: new Date().toISOString(),
          requestId,
          method: request.method,
          path: request.url,
          status,
          message: Array.isArray(message) ? message.join('; ') : String(message),
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        }),
        stackHead,
      );

      /**
       * ⚠️ DB-д ч хадгална — docker лог нь эргэлддэг (rotate) бөгөөс
       * хайхад бэрх. ⚠️ `void` + `catch` — лог бичих үйлдэл ХЭЗЭЭ Ч
       * хариу буцаахад саад болох ёсгүй.
       */
      void this.errors
        ?.record({
          source: 'server',
          message: Array.isArray(message) ? message.join('; ') : String(message),
          stack: errStack ?? null,
          path: request.url,
          userAgent: request.headers['user-agent'] ?? null,
          meta: { status, requestId, method: request.method, ip: request.ip },
        })
        .catch(() => {
          /* аль хэдийн дотроо барьдаг — энэ нь нэмэлт хамгаалалт */
        });
    }

    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      error:
        exception instanceof HttpException
          ? (exceptionResponse as { error?: string })?.error
          : /* ⚠️ `statusCode`-той нийцүүлнэ — 400 дээр «Internal Server
               Error» гэж бичих нь клиентийг төөрөлдүүлнэ */
            isPrismaValidation
            ? 'Bad Request'
            : 'Internal Server Error',
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    });
  }
}
