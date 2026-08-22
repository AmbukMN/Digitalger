import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { VideoDownloadService } from './video-download.service';

/**
 * АДМИН — БАЙРШУУЛСАН ВИДЕОГ ТАТАЖ АВАХ.
 *
 * ⚠️⚠️ ЗӨВХӨН ADMIN. Энэ нь бүтэн кино/ангийг эх чанараар нь өгдөг
 * тул хэрэглэгчид ХЭЗЭЭ Ч нээгдэж болохгүй — контент алдагдана.
 */
@Controller('admin/video-download')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class VideoDownloadController {
  constructor(private readonly svc: VideoDownloadService) {}

  /**
   * Боломжит нягтралуудыг буцаана.
   *
   * Хариу: `{ name, variants: [{ index, label, width, height, approxMb }] }`
   */
  @Get(':kind/:id/variants')
  variants(@Param('kind') kind: 'movie' | 'episode', @Param('id') id: string) {
    return this.svc.variants(kind, id);
  }

  /**
   * ⚠️⚠️ НЭГ УДААГИЙН ТАСАЛБАР ОЛГОНО.
   *
   * Татах нь хөтчийн энгийн GET навигаци тул `Authorization` header
   * тавих боломжгүй. JWT-г query-д тавих нь лог, түүхэнд үлдэх тул
   * АЮУЛТАЙ — оронд нь 2 минутын хугацаатай, нэг удаагийн тасалбар.
   */
  @Post(':kind/:id/ticket')
  async ticket(
    @Param('kind') kind: 'movie' | 'episode',
    @Param('id') id: string,
    @Body() body: { v?: number },
  ) {
    return { ticket: await this.svc.issueTicket(kind, id, Number(body?.v) || 0) };
  }
}

/**
 * ⚠️⚠️ ТАСАЛБАРААР ТАТАХ — guard-ГҮЙ controller.
 *
 * `JwtAuthGuard` header шаарддаг тул энэ замыг ТУСАД нь гаргав.
 * Эрхийг тасалбар өөрөө хангана: түүнийг зөвхөн ADMIN авч чадна
 * (дээрх controller), 2 минут хүчинтэй, НЭГ УДАА ашиглагдана.
 */
@Controller('admin/video-download')
export class VideoDownloadPublicController {
  constructor(private readonly svc: VideoDownloadService) {}

  @Get('file')
  async file(@Query('t') ticket: string, @Res() res: Response) {
    const claim = await this.svc.redeemTicket(String(ticket ?? ''));
    if (!claim) {
      throw new BadRequestException('Тасалбар хүчингүй эсвэл хугацаа дууссан');
    }
    return this.svc.streamMp4(claim.kind, claim.id, claim.v, res);
  }
}
