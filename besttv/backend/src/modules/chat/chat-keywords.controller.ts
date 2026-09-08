import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ChatMatchType, Role } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ChatKeywordsService } from './chat-keywords.service';

/**
 * ⚠️⚠️ ЧАТБОТЫН ТҮЛХҮҮР ҮГ — АДМИН ПАНЕЛЬ.
 *
 * Админ хэдэн ч дүрэм нэмнэ: «99» → «Өнчин охин» кино харуулах.
 * Код засах шаардлагагүй.
 *
 * ⚠️ Дүрэм нь САЙТААР тусгаарлагдана (Prisma өргөтгөл автоматаар).
 */

class CreateKeywordDto {
  /** ⚠️ Түлхүүр үгс — «99», «999», «онч» */
  @IsArray()
  @IsString({ each: true })
  keywords!: string[];

  @IsOptional()
  @IsEnum(ChatMatchType)
  matchType?: ChatMatchType;

  /** Харуулах кинонууд — ЭРЭМБЭТЭЙ */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  titleIds?: string[];

  /** ⚠️ Нэмэлт текст. Хоосон бол зөвхөн кино харагдана. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reply?: string;

  /** Админд ойлгомжтой нэр */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;
}

class UpdateKeywordDto extends CreateKeywordDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  declare keywords: string[];
}

class TestDto {
  @IsString()
  @MaxLength(500)
  message!: string;
}

@Controller('admin/chat-keywords')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ChatKeywordsAdminController {
  constructor(private readonly svc: ChatKeywordsService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list({
      q,
      /* ⚠️ Query нь ҮРГЭЛЖ мөр — 'false' нь truthy тул тодорхой шалгана */
      isActive: isActive === undefined ? undefined : isActive === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post()
  create(@Body() dto: CreateKeywordDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateKeywordDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  /**
   * ⚠️ ТУРШИХ — дүрэм зөв ажиллаж байгааг хадгалахаас ӨМНӨ шалгана.
   *
   * Админ «99» гэж бичээд ямар кино гарахыг шууд харна.
   */
  @Post('test')
  test(@Body() dto: TestDto) {
    return this.svc.test(dto.message);
  }
}
