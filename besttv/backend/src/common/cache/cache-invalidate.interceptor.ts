import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { CacheService } from './cache.service';

/**
 * Контент өөрчлөгдөхөд нийтийн кэшийг ЦЭВЭРЛЭНЭ.
 *
 * ⚠️⚠️ ЯАГААД INTERCEPTOR ВЭ (метод бүрд гараар дуудахын оронд):
 * `TitlesAdminService`-д мутаци хийдэг 11 метод байна (create, update,
 * remove, bulkDelete, bulkSetActive, bulkSetPremium, season/episode…).
 * Гараар дуудвал ШИНЭ метод нэмэхэд МАРТАГДАЖ, админ "кино нэмсэн ч
 * нүүрэнд гарахгүй байна" гэж гомдоно. Interceptor нь БҮХ бичих
 * үйлдлийг автоматаар барина.
 *
 * ⚠️ ЗӨВХӨН амжилттай хариунд цэвэрлэнэ (`tap` нь алдаа гарвал
 * ажиллахгүй) — 400 буцсан хүсэлт кэш эвдэх ёсгүй.
 */
@Injectable()
export class CacheInvalidateInterceptor implements NestInterceptor {
  constructor(private readonly cache: CacheService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    /* ⚠️ GET/HEAD нь юу ч өөрчлөхгүй — дэмий SCAN хийхгүй */
    if (req.method === 'GET' || req.method === 'HEAD') return next.handle();

    return next.handle().pipe(
      tap(() => {
        /* ⚠️ `void` — кэш цэвэрлэлт хариуг ХҮЛЭЭЛГЭХГҮЙ (админ хүлээхгүй) */
        void this.cache.invalidate('home:*');
      }),
    );
  }
}
