import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EmailService } from '../notifications/email.service';

interface ContactDto {
  name: string;
  email: string;
  phone?: string;
  message: string;
  // Math captcha: frontend "3+5" асуултын хариу. Сервер дахин шалгана.
  captchaA?: number;
  captchaB?: number;
  captchaAnswer?: number;
}

@Controller('contact')
export class ContactController {
  constructor(private readonly email: EmailService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } }) // спам хүсэлтээс сэргийлэх
  @Post()
  async submit(@Body() dto: ContactDto) {
    const name = (dto?.name ?? '').trim();
    const email = (dto?.email ?? '').trim().toLowerCase();
    const message = (dto?.message ?? '').trim();
    const phone = (dto?.phone ?? '').trim();

    if (!name || name.length > 100) throw new BadRequestException('Нэрээ зөв оруулна уу');
    if (!email.includes('@') || email.length > 254) throw new BadRequestException('И-мэйл буруу байна');
    if (!message || message.length < 5) throw new BadRequestException('Мессеж хэт богино байна');
    if (message.length > 5000) throw new BadRequestException('Мессеж хэт урт байна');

    // ── Bot спам хамгаалалт: math captcha сервер талаас дахин шалгана ──
    const a = Number(dto?.captchaA);
    const b = Number(dto?.captchaB);
    const ans = Number(dto?.captchaAnswer);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(ans) || a + b !== ans) {
      throw new BadRequestException('Баталгаажуулалт буруу байна. Тооцооллыг дахин шалгана уу.');
    }

    await this.email.sendContactInquiry({ name, email, phone: phone || undefined, message });
    return { success: true };
  }
}
