import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

/**
 * BestTV worker — HLS хөрвүүлэлтийн queue consumer.
 * ⚠️ Тусдаа process: ffmpeg CPU их иддэг тул API-г блоклохгүй.
 * ⚠️ HLS/queue код өөрчилбөл worker-ийг ЗААВАЛ дахин build/restart!
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  await app.init();
  console.log('BestTV worker started — HLS queue consumer');
}

bootstrap();
