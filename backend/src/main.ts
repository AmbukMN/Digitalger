import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: false, // express.json/urlencoded-г доор өөрсдөө тохируулна
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 4000;
  const corsOrigins = config.get<string[]>('corsOrigin') ?? [];

  app.setGlobalPrefix('api');

  // ⚠️ nginx reverse proxy-ийн ард ажилладаг тул жинхэнэ клиент IP-г
  // X-Forwarded-For header-ээс авна. Эс бол throttle бүх клиентийг nginx-ийн
  // нэг IP гэж үзэж бүгдийг нэг bucket-д хийж (rate limit найдваргүй) болдог.
  app.set('trust proxy', 1);

  // Том файл upload-д зориулан body limit нэмэгдүүлнэ (multipart/form-data нь multer хянана)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(helmet());
  app.use(compression({ filter: (req) => !req.path.includes('/uploads') }));

  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.listen(port);
  console.log(`DigitalGer API listening on http://localhost:${port}/api`);
}

bootstrap();
