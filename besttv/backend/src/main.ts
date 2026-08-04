import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
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

  /**
   * ⚠️ AUTH хариунд ETag/кэш БАЙЖ БОЛОХГҮЙ.
   *
   * Express анхдагчаар ETag тавьдаг тул `/auth/me` хариу browser-т
   * кэшлэгдэж `304 Not Modified` буцаадаг байв (production nginx лог:
   * `auth/me 304` × 8). Токен солигдсон ч browser ХУУЧИН хариуг
   * ашиглах эрсдэлтэй — нэвтрэлтийн төлөв зөрнө.
   */
  app.getHttpAdapter().getInstance().set('etag', false);
  app.use('/api/auth', (_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  /**
   * ⚠️ JWT-г `Authorization` header-ээс ГАДНА `btv_token` cookie-оос ч
   * уншина (`jwt.strategy.ts`). Зарим browser өргөтгөл `fetch`/`XHR`-ыг
   * залгаж header-ыг арилгадаг тул тэр үед нэвтрэлт бүрэн унадаг байв.
   */
  app.use(cookieParser());
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
