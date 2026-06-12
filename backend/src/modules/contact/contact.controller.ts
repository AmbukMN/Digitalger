import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EmailService } from '../notifications/email.service';
import { PrismaService } from '../../prisma/prisma.service';

// HTML-ийг цэвэр текст болгоно (n8n chatbot context-д уншихад зориулсан).
function htmlToText(html: string): string {
  return (html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

interface ContactDto {
  name: string;
  email: string;
  phone: string;
  message: string;
  // Math captcha: frontend "3+5" асуултын хариу. Сервер дахин шалгана.
  captchaA?: number;
  captchaB?: number;
  captchaAnswer?: number;
}

@Controller('contact')
export class ContactController {
  constructor(
    private readonly email: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── n8n chatbot context (public) ───────────────────────────────────────────
  // Холбоо барих + Бидний тухай хуудасны бодит DB өгөгдөл + social/email-ийг
  // нэгтгэж текстээр буцаана. n8n AI agent энэ мэдээллээр "утас?", "хэрхэн холбоо
  // барих?" зэрэг асуултад БОДИТ өгөгдлөөр хариулна (system message-д статик биш).
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('chatbot-context')
  async chatbotContext() {
    const [contactPage, aboutPage, site] = await Promise.all([
      this.prisma.page.findUnique({ where: { slug: 'contact' } }),
      this.prisma.page.findUnique({ where: { slug: 'about' } }),
      this.prisma.siteSetting.findUnique({ where: { id: 'default' } }),
    ]);

    const socials: Record<string, string | null | undefined> = {
      Facebook: site?.socialFacebook,
      Instagram: site?.socialInstagram,
      Twitter: site?.socialTwitter,
      Threads: site?.socialThreads,
      Telegram: site?.socialTelegram,
      WhatsApp: site?.socialWhatsapp,
      TikTok: site?.socialTiktok,
      YouTube: site?.socialYoutube,
      LinkedIn: site?.socialLinkedin,
    };
    const socialLines = Object.entries(socials)
      .filter(([, v]) => !!v)
      .map(([k, v]) => `${k}: ${v}`);

    // AI agent-д шууд уншихад бэлэн нэгдсэн текст
    const lines: string[] = [];
    lines.push('=== ХОЛБОО БАРИХ (бодит мэдээлэл) ===');
    if (contactPage?.content) lines.push(htmlToText(contactPage.content).slice(0, 1500));
    if (site?.supportEmail) lines.push(`Дэмжлэгийн имэйл: ${site.supportEmail}`);
    if (socialLines.length) lines.push('Социал сүлжээ:\n' + socialLines.join('\n'));
    lines.push('Холбоо барих хуудас: https://digitalger.mn/contact');
    if (aboutPage?.content) {
      lines.push('\n=== БИДНИЙ ТУХАЙ ===');
      lines.push(htmlToText(aboutPage.content).slice(0, 1500));
    }

    return {
      contactText: htmlToText(contactPage?.content ?? '').slice(0, 1500),
      aboutText: htmlToText(aboutPage?.content ?? '').slice(0, 1500),
      supportEmail: site?.supportEmail ?? 'info@digitalger.mn',
      socials: socialLines,
      // n8n agentInput-д шууд хийхэд бэлэн нэгдсэн текст
      contextBlock: lines.filter(Boolean).join('\n'),
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } }) // спам хүсэлтээс сэргийлэх
  @Post()
  async submit(@Body() dto: ContactDto) {
    const name = (dto?.name ?? '').trim();
    const email = (dto?.email ?? '').trim().toLowerCase();
    const message = (dto?.message ?? '').trim();
    const phone = (dto?.phone ?? '').trim();

    if (!name || name.length > 100) throw new BadRequestException('Нэрээ зөв оруулна уу');
    if (!email.includes('@') || email.length > 254) throw new BadRequestException('И-мэйл буруу байна');
    // Утас ЗААВАЛ — дор хаяж 6 орон (8 оронтой Монгол дугаар + код хүлээнэ)
    if (!phone || phone.replace(/\D/g, '').length < 6) throw new BadRequestException('Утасны дугаараа зөв оруулна уу');
    if (!message || message.length < 5) throw new BadRequestException('Мессеж хэт богино байна');
    if (message.length > 5000) throw new BadRequestException('Мессеж хэт урт байна');

    // ── Bot спам хамгаалалт: math captcha сервер талаас дахин шалгана ──
    const a = Number(dto?.captchaA);
    const b = Number(dto?.captchaB);
    const ans = Number(dto?.captchaAnswer);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(ans) || a + b !== ans) {
      throw new BadRequestException('Баталгаажуулалт буруу байна. Тооцооллыг дахин шалгана уу.');
    }

    // ── DB-д хадгална (имэйл явуулалтаас ӨМНӨ) — алдагдахаас сэргийлэх ЧУХАЛ хэсэг.
    // create алдвал submit бүхэлдээ амжилтгүй болж хэрэглэгч дахин оролдоно
    // (fire-and-forget биш — мессеж заавал хадгалагдсан байх ёстой).
    await this.prisma.contactMessage.create({
      data: { name, email, phone: phone || null, message },
    });

    // Имэйл явуулалт ХЭВЭЭР (auto-reply + admin-д мэдэгдэл). Имэйл алдсан ч мессеж
    // DB-д аль хэдийн хадгалагдсан тул admin панелаас харж болно.
    await this.email
      .sendContactInquiry({ name, email, phone: phone || undefined, message })
      .catch(() => {});
    return { success: true };
  }
}
