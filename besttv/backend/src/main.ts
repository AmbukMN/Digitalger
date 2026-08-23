import cluster from 'node:cluster';
import { cpus } from 'node:os';
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
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    /**
     * ⚠️ `X-Auth-Stale` — `OptionalJwtAuthGuard` нь токен хүчингүй үед
     * тавьдаг дохио. Browser нь `exposedHeaders`-т заагаагүй header-ийг
     * JS-д ХАРУУЛДАГГҮЙ тул энд заавал бүртгэнэ (frontend нь proxy-оор
     * same-origin ирдэг ч, шууд домэйнээр хандах тохиолдол бий).
     */
    exposedHeaders: ['X-Auth-Stale'],
  });

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
  const role = cluster.isWorker
    ? ` (worker ${cluster.worker?.id}${process.env.CRON_ENABLED !== 'false' ? ', cron' : ''})`
    : '';
  console.log(`BestTV API listening on http://localhost:${port}/api${role}`);
}

/**
 * ⚠️⚠️ CLUSTER — олон CPU цөм ашиглаж зэрэг хандалтыг хурдасгана.
 *
 * БОДИТ АСУУДАЛ: NestJS default нь ГАНЦ процесс — 4 цөмтэй серверт
 * зөвхөн 1 цөм ажиллаж, огцом ачаалалд хүсэлтүүд дараалалд орж
 * удаашрдаг байв (500 зэрэг хандалтад p50 ~5.9с).
 *
 * ⚠️ ЦӨМИЙН ХУВААРЬ: видео worker тусдаа container-т 1 цөм иддэг тул
 *    backend-т CLUSTER_WORKERS-аар (default 2) хязгаарлана — бүх цөмийг
 *    авахгүй.
 *
 * ⚠️⚠️ CRON ЗӨВХӨН worker 0-Д: NODE_APP_INSTANCE-ыг node:cluster
 *    автоматаар өгдөг. Worker 0-оос бусдад CRON_ENABLED=false тавьж
 *    @Cron-г унтраана (app.module.ts) — тайлан/сануулга ДАВХАРЛАХГҮЙ.
 *
 * ⚠️ CLUSTER_WORKERS=1 (эсвэл тохируулаагүй хөгжүүлэлт) үед cluster
 *    огт ажиллахгүй — нэг процессын хуучин зан төлөв ХЭВЭЭР.
 */
const WORKERS = Math.max(1, Math.min(Number(process.env.CLUSTER_WORKERS ?? 1), cpus().length));

if (WORKERS > 1 && cluster.isPrimary) {
  console.log(`BestTV primary ${process.pid} — ${WORKERS} worker асааж байна`);
  /* worker.id → cron эзэн эсэх. Cron эзэн унавал шинийг нь мөн cron эзэн болгоно. */
  const cronOwner = new Map<number, boolean>();
  const fork = (isCron: boolean) => {
    const w = cluster.fork({ CRON_ENABLED: isCron ? 'true' : 'false' });
    cronOwner.set(w.id, isCron);
  };
  for (let i = 0; i < WORKERS; i++) fork(i === 0);
  cluster.on('exit', (worker, code, signal) => {
    const wasCron = cronOwner.get(worker.id) ?? false;
    cronOwner.delete(worker.id);
    console.error(`Worker ${worker.process.pid} унав (${signal || code}) — сэргээж байна`);
    fork(wasCron);
  });
} else {
  bootstrap();
}
