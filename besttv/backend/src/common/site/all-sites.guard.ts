import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { runAcrossSites } from './site-context';
import type { JwtPayload } from '../decorators/current-user.decorator';

/**
 * ⚠️⚠️ «БҮХ САЙТ» ГОРИМЫН ЭРХ ШАЛГАХ GUARD.
 *
 * `X-Site: all` нь өгөгдлийн тусгаарлалтыг УНТРААДАГ. Тиймээс
 * ЗӨВХӨН админд зөвшөөрөгдөнө.
 *
 * ⚠️ ЯАГААД MIDDLEWARE-Т ШАЛГААГҮЙ ВЭ: middleware нь guard-аас
 * ӨМНӨ ажилладаг тул `req.user` хараахан байхгүй. Тиймээс
 * middleware нь зөвхөн ТЭМДЭГЛЭНЭ, эрхийг энд шалгана.
 *
 * ⚠️ Хэрэглээ: `@UseGuards(JwtAuthGuard, AllSitesGuard)` — JWT-ийн
 * ДАРАА байрлана (эс бөгөөс `req.user` хоосон).
 */
@Injectable()
export class AllSitesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload; allSites?: boolean }>();

    if (!req.allSites) return true; // энгийн горим — асуудалгүй

    if (req.user?.role !== Role.ADMIN) {
      /**
       * ⚠️ Алдаа ШИДНЭ, чимээгүй буулт хийхгүй. Учир нь клиент
       * «бүх сайтын дүн» хүлээж байгаа бол нэг сайтын дүн буцаах нь
       * ТӨӨРӨГДҮҮЛНЭ — админ буруу тоо хараад шийдвэр гаргана.
       */
      throw new ForbiddenException('Бүх сайтын өгөгдөл харах эрх байхгүй');
    }
    return true;
  }
}

/**
 * ⚠️ Сервер талын кодод (cron, worker, дотоод дуудлага) хоёр сайтын
 * өгөгдлийг зориуд нийлүүлэх туслах.
 *
 * ЗӨВХӨН дараах үед:
 *   · Админы нэгдсэн дашбоард («нийт борлуулалт»)
 *   · Хоёр сайтад хамаарах cleanup cron
 *   · Migration шалгах скрипт
 *
 * Бусад газар ХЭРЭГЛЭВЭЛ өгөгдөл холилдоно.
 */
export { runAcrossSites };
