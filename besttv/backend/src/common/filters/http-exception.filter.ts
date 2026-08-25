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

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : ((exceptionResponse as { message?: string | string[] })?.message ??
          (exception instanceof Error ? exception.message : 'Internal server error'));

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
          : 'Internal Server Error',
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    });
  }
}
