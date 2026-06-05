import { Controller, Get, Logger, Param, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { DownloadsService } from './downloads.service';

/**
 * FB/IG доторх браузерт зориулсан "go" татах PROXY endpoint (auth-гүй).
 *
 * АСУУДАЛ: (1) Facebook линк нээх бүрд URL-д &fbclid=... нэмдэг тул presigned R2
 * URL-ийн signature эвддэг. (2) 302 redirect-ийн дараах R2 хариуг FB WebView
 * харуулж чаддаггүй ("Page not found").
 *
 * ШИЙДЭЛ: signed URL-ийг ил гаргахгүй, R2 redirect ч хийхгүй. Backend өөрөө
 * R2-аас файлыг STREAM-аар татаж аваад МАНАЙ домэйноос шууд дамжуулна
 * (Content-Disposition: attachment). FB WebView манай домэйноос файл татна —
 * redirect/signed URL/fbclid огт оролцохгүй → stable. Stream pipe тул том файл
 * (GB) ч memory-д ачаалахгүй.
 *
 * Token өөрөө HMAC-signed + хугацаатай тул эрх шалгах шаардлагагүй (нэвтрэлтгүй).
 * Зам: GET /downloads/go/:token
 */
@Controller('downloads/go')
export class DownloadGoController {
  private readonly logger = new Logger(DownloadGoController.name);
  constructor(private readonly downloadsService: DownloadsService) {}

  @Get(':token')
  @SkipThrottle()
  async go(@Param('token') token: string, @Res() res: Response) {
    let stream: { body: NodeJS.ReadableStream; contentLength?: number; contentType?: string };
    let fileName: string;
    try {
      const resolved = await this.downloadsService.streamGoToken(token);
      stream = resolved.stream;
      fileName = resolved.fileName;
    } catch {
      // Token буруу/хугацаа дууссан → энгийн мессеж (HTML биш, FB-д ойлгомжтой)
      return res
        .status(410)
        .type('text/plain; charset=utf-8')
        .send('Татах линкийн хугацаа дууссан байна. Сайт руугаа орж дахин татна уу.');
    }

    // Файлыг attachment-аар манай домэйноос stream хийнэ
    const safeName = encodeURIComponent(fileName).replace(/['()]/g, escape);
    res.setHeader('Content-Type', stream.contentType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${safeName}`);
    if (stream.contentLength) res.setHeader('Content-Length', String(stream.contentLength));
    res.setHeader('Cache-Control', 'no-store');

    // Stream pipe — chunk-аар урсгана (том файл ч аюулгүй). Алдаа гарвал таслана.
    const body = stream.body as NodeJS.ReadableStream & { on: (e: string, cb: (err?: Error) => void) => void };
    body.on('error', (err) => {
      this.logger.error('Download stream алдаа', err);
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });
    body.pipe(res);
  }
}
