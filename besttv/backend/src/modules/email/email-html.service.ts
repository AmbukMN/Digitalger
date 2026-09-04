import { Injectable } from '@nestjs/common';

/**
 * TipTap-ийн гаралтыг ИМЭЙЛД тохирсон HTML болгоно.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ: имэйлийн клиент (Gmail/Outlook) нь гадаад
 * CSS класс ОГТ ачаалдаггүй — зөвхөн inline `style` ажиллана.
 * TipTap нь `<p>Текст</p>` гэж КЛАСС/ӨНГӨГҮЙ гаргадаг тул манай
 * БАРААН карт (#17181c) дээр текст ХАР болж УНШИГДАХГҮЙ болно.
 *
 * ⚠️⚠️ ЭНЭ ФУНКЦ НЭГ Л ГАЗАР — урьдчилан харах ба илгээх ХОЁУЛАА
 * үүгээр дамжина. Хоёр тусдаа хувиргалт бичвэл админы харсан зүйл
 * хүлээн авагчийнхтай ЗӨРНӨ.
 */
@Injectable()
export class EmailHtmlService {
  /** Үндсэн бичвэрийн өнгө — бараан карт дээр уншигдана */
  private static readonly BODY = 'color:#c8c8ce;font-size:14px;line-height:1.65;margin:0 0 12px';
  /** Гарчиг — тод цагаан */
  private static readonly HEAD = 'color:#ffffff;font-weight:700;line-height:1.35;margin:18px 0 10px';

  /**
   * ⚠️ Аюулгүй байдал: гүйцэтгэх боломжтой зүйлийг АГУУЛГАТАЙ нь хаяна.
   * Админ өөрөө бичдэг ч, буруу хуулсан HTML имэйлийг эвдэж болно.
   */
  private strip(html: string): string {
    return html
      .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
      /* ⚠️ `on*` эвент — имэйлд ажиллахгүй ч спам шүүлтүүр сэжиглэнэ */
      .replace(/\son[a-z]+="[^"]*"/gi, '')
      .replace(/\son[a-z]+='[^']*'/gi, '');
  }

  /** Байгаа `style`-д нэмнэ, байхгүй бол шинээр үүсгэнэ */
  private withStyle(tag: string, style: string): string {
    if (/style="/i.test(tag)) {
      return tag.replace(/style="/i, `style="${style};`);
    }
    return tag.replace(/^<([a-z0-9]+)/i, `<$1 style="${style}"`);
  }

  /**
   * TipTap HTML → имэйлийн HTML.
   *
   * ⚠️ Байгаа inline `style`-ыг ХАДГАЛНА (админы сонгосон өнгө,
   * тэгшлэлт) — зөвхөн ДУТУУ зүйлийг нөхнө.
   */
  toEmailHtml(raw: string): string {
    if (!raw?.trim()) return '';
    let html = this.strip(raw);

    /**
     * ── Догол мөр ──
     * ⚠️ НЭГ дүрэм — өмнө нь хоёр `replace` дараалж, хоёр дахь нь
     * эхнийхийн НЭМСЭН style-тай тааран `color:...;color:...` гэж
     * ДАВХАРДУУЛДАГ байв. `withStyle` нь style байгаа эсэхийг өөрөө
     * шалгадаг тул нэг удаа дуудахад хангалттай.
     */
    html = html.replace(/<p([^>]*)>/gi, (m, a: string) =>
      this.withStyle(`<p${a}>`, EmailHtmlService.BODY));

    /* ── Гарчиг: h1-h3 ── */
    for (const [tag, size] of [['h1', '22px'], ['h2', '19px'], ['h3', '16px']] as const) {
      const re = new RegExp(`<${tag}([^>]*)>`, 'gi');
      html = html.replace(re, (m, attrs: string) =>
        this.withStyle(`<${tag}${attrs}>`, `${EmailHtmlService.HEAD};font-size:${size}`),
      );
    }

    /* ── Тод/налуу — өнгө ЗААВАЛ (өгөгдмөл хар болно) ── */
    html = html.replace(/<strong([^>]*)>/gi, (m, a: string) =>
      this.withStyle(`<strong${a}>`, 'color:#ffffff'));
    html = html.replace(/<b([^>]*)>/gi, (m, a: string) =>
      this.withStyle(`<b${a}>`, 'color:#ffffff'));

    /* ── Жагсаалт ── */
    html = html.replace(/<ul([^>]*)>/gi, (m, a: string) =>
      this.withStyle(`<ul${a}>`, `${EmailHtmlService.BODY};padding-left:20px`));
    html = html.replace(/<ol([^>]*)>/gi, (m, a: string) =>
      this.withStyle(`<ol${a}>`, `${EmailHtmlService.BODY};padding-left:20px`));
    html = html.replace(/<li([^>]*)>/gi, (m, a: string) =>
      this.withStyle(`<li${a}>`, 'margin:0 0 6px'));

    /* ── Линк — брэндийн улаан (өгөгдмөл цэнхэр нь бараан дээр бүдэг) ── */
    html = html.replace(/<a([^>]*)>/gi, (m, a: string) =>
      this.withStyle(`<a${a}>`, 'color:#e50914;text-decoration:underline'));

    /**
     * ── Зураг ──
     * ⚠️⚠️ TipTap нь `class="rounded-lg"` (Tailwind) тавьдаг — имэйлд
     * ОГТ ажиллахгүй тул зураг өргөнгүй, дүрсгүй гарна. Классыг хаяж
     * inline `style` тавина.
     */
    html = html.replace(/<img([^>]*)>/gi, (m, a: string) => {
      const attrs = a.replace(/\sclass="[^"]*"/gi, '');
      return this.withStyle(`<img${attrs}>`,
        'width:100%;max-width:536px;height:auto;border-radius:10px;display:block;margin:14px 0');
    });

    /* ── Тэмдэглэсэн текст: <mark> нь Outlook-д ажиллахгүй ── */
    html = html.replace(/<mark([^>]*)>/gi, (m, a: string) =>
      this.withStyle(`<mark${a}>`, 'background:#e50914;color:#ffffff;padding:1px 4px'));

    /* ── Тусгаарлагч ── */
    html = html.replace(/<hr([^>]*)>/gi,
      '<hr style="border:0;border-top:1px solid #2a2b31;margin:20px 0" />');

    /* ── Ишлэл ── */
    html = html.replace(/<blockquote([^>]*)>/gi, (m, a: string) =>
      this.withStyle(`<blockquote${a}>`,
        `${EmailHtmlService.BODY};border-left:3px solid #e50914;padding-left:14px;margin-left:0`));

    return html;
  }
}
