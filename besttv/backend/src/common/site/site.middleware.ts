import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { runWithSite } from './site-context';
import { resolveSite } from './site.resolve';
import type { Site } from './site.constants';

/**
 * ⚠️⚠️ САЙТЫГ ТОГТООХ MIDDLEWARE — INTERCEPTOR БИШ.
 *
 * ЯАГААД MIDDLEWARE ВЭ (ЭНЭ НЬ ЧУХАЛ ЗӨРҮҮ):
 *
 * NestJS-ийн гүйцэтгэлийн дараалал:
 *   Middleware → Guard → Interceptor → Pipe → Handler
 *
 * `JwtAuthGuard` нь GUARD давхаргад ажилладаг бөгөөд `JwtStrategy`
 * дотроо `prisma.user.findUnique({ id })` дуудна. Хэрэв сайтыг
 * INTERCEPTOR-т тогтоовол тэр query нь context-ГҮЙ явж, шүүлт
 * хийгдэхгүй.
 *
 * БОДИТ ҮР ДАГАВАР: BestFilm-ийн хүсэлт BestTV-ийн хэрэглэгчийн
 * токеноор нэвтэрч чадна — өгөгдлийн тусгаарлалт нүхтэй болно.
 *
 * ⚠️ Middleware нь `next()`-ийг AsyncLocalStorage дотор дуудсанаар
 * ЦААШИД бүх давхарга (guard, interceptor, handler, тэр ч байтугай
 * `await`-ийн дараах код) context-той болно.
 *
 * ⚠️ АНХААР: `runWithSite(site, () => next())` — `next()`-ийг
 * callback ДОТОР дуудна. Гадна дуудвал context алдагдана.
 */
@Injectable()
export class SiteMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const { site, allSites } = resolveSite(req);

    /* Controller-т `@CurrentSite()`-аар авахад зориулж req-д ч хадгална */
    (req as Request & { site?: Site; allSites?: boolean }).site = site;
    (req as Request & { site?: Site; allSites?: boolean }).allSites = allSites;

    /**
     * ⚠️ Хариунд сайтыг буцаана — debug, кэш түлхүүр, CDN-д хэрэгтэй.
     * `Vary` нь CDN-д «энэ толгойгоор кэш салгана» гэж хэлнэ —
     * эс бөгөөс BestTV-ийн хариу BestFilm-д өгөгдөж болзошгүй.
     */
    res.setHeader('X-Resolved-Site', site);
    res.setHeader('Vary', appendVary(res.getHeader('Vary'), 'X-Site, Origin'));

    runWithSite(site, () => next(), allSites);
  }
}

/** Байгаа `Vary` утгыг дарж бичихгүйгээр нэмнэ. */
function appendVary(existing: unknown, add: string): string {
  const cur = typeof existing === 'string' ? existing : '';
  if (!cur) return add;
  const have = new Set(cur.split(',').map((s) => s.trim().toLowerCase()));
  const missing = add
    .split(',')
    .map((s) => s.trim())
    .filter((s) => !have.has(s.toLowerCase()));
  return missing.length ? `${cur}, ${missing.join(', ')}` : cur;
}
