import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { SearchDto } from './search.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // Public хайлт — @SkipThrottle байсныг арилгаж throttle тавив. Хайлт бүр хэд
  // хэдэн хүнд raw SQL (tsvector) ажиллуулдаг тул бот спамаар DB DoS хийхээс
  // сэргийлнэ. n8n chatbot ч энэ endpoint-ийг дуудна (30/мин хангалттай).
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('search')
  @HttpCode(HttpStatus.OK)
  search(@Body() dto: SearchDto) {
    return this.aiService.search(dto.query);
  }
}
