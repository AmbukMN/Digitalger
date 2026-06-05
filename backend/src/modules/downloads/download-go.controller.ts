import { Controller, Get, Param, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { DownloadsService } from './downloads.service';

/**
 * FB/IG доторх браузерт зориулсан "go" татах redirect endpoint (auth-гүй).
 *
 * Facebook/Instagram линк нээх бүрд URL-д &fbclid=... нэмдэг тул presigned R2
 * URL-ийн signature эвдэрч "SignatureDoesNotMatch" гардаг. Энэ route нь манай
 * домэйны богино токен линк — fbclid нэмэгдсэн ч хамаагүй, token-оо задлаад
 * R2 presigned URL-ийг ШИНЭЭР (цэвэр) үүсгэж 302 redirect хийнэ.
 *
 * Token өөрөө HMAC-signed + хугацаатай тул эрх шалгах шаардлагагүй (нэвтрэлтгүй).
 * Зам: GET /downloads/go/:token
 */
@Controller('downloads/go')
export class DownloadGoController {
  constructor(private readonly downloadsService: DownloadsService) {}

  @Get(':token')
  @SkipThrottle()
  async go(@Param('token') token: string, @Res() res: Response) {
    try {
      const { url } = await this.downloadsService.resolveGoToken(token);
      // 302 → цэвэр presigned URL (fbclid-гүй). R2 Content-Disposition: attachment
      // тул браузер (FB доторх ч) файлыг татаж эхэлнэ.
      return res.redirect(302, url);
    } catch {
      // Token буруу/хугацаа дууссан → энгийн мессеж (HTML биш, FB-д ойлгомжтой)
      return res
        .status(410)
        .type('text/plain; charset=utf-8')
        .send('Татах линкийн хугацаа дууссан байна. Сайт руугаа орж дахин татна уу.');
    }
  }
}
