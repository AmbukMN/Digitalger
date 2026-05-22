import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  // HTTP listener байхгүй — зөвхөн Bull queue processor
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'warn', 'error'],
  });
  await app.init();
  console.log('ZIP Worker started — listening for jobs...');
}

bootstrap();
