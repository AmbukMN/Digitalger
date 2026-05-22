import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'warn', 'error'],
  });
  await app.init();
  console.log('ZIP Worker started — listening for jobs...');

  // Graceful shutdown — идэвхтэй job-уудыг дуусгаад гарна
  const shutdown = async (signal: string) => {
    console.log(`ZIP Worker: ${signal} received — draining queue...`);
    // Bull queue-г graceful stop хийнэ (идэвхтэй job дуусна, шинэ авахгүй)
    await app.close();
    console.log('ZIP Worker: shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

bootstrap();
