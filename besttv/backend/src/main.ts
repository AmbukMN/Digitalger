import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import express from 'express';
import path from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: false,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 4100;
  const corsOrigins = config.get<string[]>('corsOrigin') ?? [];

  app.setGlobalPrefix('api');

  // nginx reverse proxy-ийн ард — жинхэнэ клиент IP X-Forwarded-For-оос
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  // crossOriginResourcePolicy: false — /media/* дор буй зураг/HLS segment
  // өөр origin-той frontend/admin-аас (localhost:3100/3101) чөлөөтэй ачаалагдана
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(compression({ filter: (req) => !req.path.includes('/uploads') }));

  // Локал storage драйверийн статик файлууд (R2 тохируулаагүй үед)
  app.useStaticAssets(path.resolve(process.cwd(), 'storage'), {
    prefix: '/media/',
    setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'),
  });

  // ⚠️ Production-д CORS_ORIGIN заавал — wildcard зөвхөн development-д
  const isProd = process.env.NODE_ENV === 'production';
  const corsOrigin = corsOrigins.length
    ? corsOrigins
    : isProd
      ? ['https://besttv.us', 'https://www.besttv.us', 'https://admin.besttv.us']
      : true;
  app.enableCors({ origin: corsOrigin, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(port);
  console.log(`BestTV API listening on http://localhost:${port}/api`);
}

bootstrap();
