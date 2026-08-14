import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Rate limit-ийн түлхүүрийг ЖИНХЭНЭ клиент IP-ээс авна.
 *
 * ⚠️⚠️ КРИТИК АЛДАА байсан: Cloudflare-ийн ард `req.ip` нь Cloudflare-ийн
 * edge сервер (172.x / 104.x) болдог. Тиймээс:
 *   - Бүх хэрэглэгч НЭГ IP-тэй мэт тоологдож,
 *   - Нэг бот хязгаарыг дүүргэхэд БҮХ ХЭРЭГЛЭГЧ блоклогдоно,
 *   - Эсрэгээр нэг бот олон Cloudflare edge дундуур явж хязгаарыг тойрно.
 *
 * `CF-Connecting-IP` бол Cloudflare-ийн НАЙДВАРТАЙ header — зөвхөн CF өөрөө
 * тавьдаг, клиент хуурамчаар илгээж чадахгүй (CF дарж бичнэ).
 */
@Injectable()
export class CfThrottlerGuard extends ThrottlerGuard {
  /**
   * ⚠️⚠️ ДОТООД БОТЫГ ХЯЗГААРААС ЧӨЛӨӨЛНӨ.
   *
   * n8n чатботын БҮХ хүсэлт НЭГ IP-ээс (docker сүлжээ) ирдэг тул
   * ямар ч өндөр хязгаар тавьсан олон хэрэглэгч зэрэг бичихэд
   * дүүрнэ. Production тестээр батлагдсан: 50 хэрэглэгч зэрэг
   * бичихэд 30 нь 429 болж чат ЧИМЭЭГҮЙ алдагдсан.
   *
   * ⚠️ IP-ээр биш SECRET-ээр таних нь зөв: IP нь container дахин
   * үүсэхэд өөрчлөгдөнө, мөн ижил сүлжээн дэх өөр процесс дуурайж
   * чадна. Secret нь зөвхөн n8n-д мэдэгдэнэ.
   */
  protected async shouldSkip(context: import('@nestjs/common').ExecutionContext): Promise<boolean> {
    const secret = process.env.N8N_WEBHOOK_SECRET;
    if (secret) {
      const req = context.switchToHttp().getRequest<Request>();
      if (req.headers['x-bot-secret'] === secret) return true;
    }
    return super.shouldSkip(context);
  }

  protected async getTracker(req: Request): Promise<string> {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && cf) return cf;

    // Cloudflare-гүй (шууд хандалт) — X-Forwarded-For-ийн ЭХНИЙ утга
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();

    return req.ip ?? 'unknown';
  }
}
