import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { DEFAULT_SITE, type Site } from './site.constants';

/**
 * Одоогийн хүсэлтийн сайтыг controller-т өгнө.
 *
 * ```ts
 * @Get()
 * list(@CurrentSite() site: Site) { … }
 * ```
 *
 * ⚠️ ИХЭНХ ТОХИОЛДОЛД ХЭРЭГГҮЙ — Prisma өргөтгөл автоматаар
 * шүүдэг. Үүнийг ЗӨВХӨН дараах үед хэрэглэ:
 *   · Имэйлийн холбоос үүсгэх (домэйн сайт бүрд өөр)
 *   · QPay merchant сонгох (данс ӨӨР)
 *   · Лог, хариунд сайт буцаах
 *   · `$queryRaw` — өргөтгөл хамардаггүй тул ГАРААР
 */
export const CurrentSite = createParamDecorator((_data: unknown, ctx: ExecutionContext): Site => {
  const req = ctx.switchToHttp().getRequest<Request & { site?: Site }>();
  return req.site ?? DEFAULT_SITE;
});

/** Админ «бүх сайт» горимд байгаа эсэх. */
export const IsAllSites = createParamDecorator((_data: unknown, ctx: ExecutionContext): boolean => {
  const req = ctx.switchToHttp().getRequest<Request & { allSites?: boolean }>();
  return req.allSites ?? false;
});
