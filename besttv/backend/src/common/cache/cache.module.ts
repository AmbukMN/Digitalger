import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheInvalidateInterceptor } from './cache-invalidate.interceptor';

/**
 * ⚠️ `@Global()` — кэш нь олон модульд хэрэгтэй (нүүр, каталог, insights).
 * Модуль бүрд import бичихийг шаардвал мартагдаж, кэш хэсэгчлэн
 * ажиллах эрсдэлтэй.
 */
@Global()
@Module({
  /**
   * ⚠️ Interceptor-ыг ЭНД бүртгэнэ — `@UseInterceptors(...)` нь DI-аар
   * шийддэг тул provider биш бол "Nest can't resolve dependencies"
   * гэж асахдаа унана.
   */
  providers: [CacheService, CacheInvalidateInterceptor],
  exports: [CacheService, CacheInvalidateInterceptor],
})
export class AppCacheModule {}
