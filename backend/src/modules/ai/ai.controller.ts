import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { SearchDto } from './search.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  search(@Body() dto: SearchDto) {
    return this.aiService.search(dto.query);
  }
}
