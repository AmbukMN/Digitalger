import { Global, Module } from '@nestjs/common';
import { AppCacheService } from './app-cache.service';

/**
 * AppCacheService-ийг global болгож бүх module-д тарьж ашиглах боломжтой болгоно.
 * (CacheModule аль хэдийн isGlobal — CACHE_MANAGER хаанаас ч хүртээмжтэй.)
 */
@Global()
@Module({
  providers: [AppCacheService],
  exports: [AppCacheService],
})
export class AppCacheModule {}
