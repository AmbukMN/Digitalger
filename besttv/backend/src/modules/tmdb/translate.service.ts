import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * AI орчуулга — TMDB-ээс ирдэг АНГЛИ текстийг монгол руу УТГАЧИЛЖ хөрвүүлнэ.
 *
 * ⚠️⚠️ ЯАГААД AI ВЭ (машин орчуулга биш):
 * Киноны тайлбар нь маркетингийн хэл — зүйрлэл, өгүүлэмжийн дэгжин
 * бүтэцтэй. Google Translate шиг үг үгээр хөрвүүлэхэд "a paraplegic
 * Marine is dispatched to the moon Pandora" → "хөлгүй тэнгисийн явган
 * цэрэг Пандора сар руу илгээгддэг" гэсэн эвгүй өгүүлбэр гардаг.
 * LLM-д "хүн орчуулсан юм шиг бич" гэж даалгавар өгвөл жинхэнэ
 * монгол өгүүлбэр болно.
 *
 * ⚠️ Түлхүүр байхгүй бол `null` буцаана — ДУУДАГЧ ТАЛ англи эхийг
 * хэвээр хэрэглэнэ. Орчуулга унасан нь импортыг УНАГААХ ёсгүй.
 */
@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);

  constructor(private readonly config: ConfigService) {}

  /** AI тохируулагдсан эсэх — админд "орчуулга идэвхтэй юу" гэдгийг харуулна */
  get enabled(): boolean {
    return !!(this.config.get<string>('ai.openaiKey') || this.config.get<string>('ai.anthropicKey'));
  }

  /**
   * Киноны бүх текстийг НЭГ дуудалтаар орчуулна.
   *
   * ⚠️⚠️ ЯАГААД НЭГ ДУУДАЛТ ВЭ: тайлбар/дүрийн нэр тус тусад нь
   * илгээвэл LLM контекстгүй болно — "Jake Sully" гэдэг нь дүрийн нэр
   * үү, жүжигчний нэр үү гэдгийг мэдэхгүй. Бүгдийг хамт өгвөл киноны
   * агуулгыг ойлгоод тохирсон нэр томьёо сонгоно. Мөн 9 дуудалт
   * биш 1 дуудалт тул ХУРДАН, ХЯМД.
   *
   * @returns null — AI тохируулаагүй эсвэл унасан үед (алдаа шидэхгүй)
   */
  async translateTitle(input: {
    title: string;
    description: string;
    /** Дүрийн нэрс — жүжигчний нэр БИШ (тэдгээрийг орчуулахгүй) */
    characters?: string[];
  }): Promise<{
    description: string;
    characters: string[];
    /** SEO — 60 тэмдэгт орчим гарчиг */
    metaTitle: string;
    /** SEO — 160 тэмдэгт орчим тайлбар */
    metaDescription: string;
  } | null> {
    if (!this.enabled) return null;

    const chars = input.characters ?? [];
    const prompt = [
      'Чи бол монгол кино сайтын контент редактор.',
      'Доорх англи мэдээллийг МОНГОЛ руу орчуул.',
      '',
      'ДҮРЭМ:',
      '1. Үг үгээр биш — УТГАЧИЛЖ, монгол хүн бичсэн мэт БАЙГАЛИЙН өгүүлбэр болго.',
      '2. Жүжигчний нэрийг ОРЧУУЛАХГҮЙ. Дүрийн нэрийг кирилл галигаар бич (Jake Sully → Жэйк Салли).',
      '3. Газар/биетийн нэрийг монголд тогтсон хэлбэрээр (Pandora → Пандора).',
      '4. Тайлбарыг 2-4 өгүүлбэрт багтаа. Сүүлийг "..." гэж таслахгүй.',
      '5. metaTitle: киноны нэр + богино тодотгол, 60 тэмдэгтээс хэтрэхгүй.',
      '6. metaDescription: хайлтад гарах уриалга, 160 тэмдэгтээс хэтрэхгүй.',
      '',
      `КИНОНЫ НЭР: ${input.title}`,
      `ТАЙЛБАР: ${input.description || '(байхгүй)'}`,
      chars.length ? `ДҮРИЙН НЭРС: ${JSON.stringify(chars)}` : '',
      '',
      'ЗӨВХӨН JSON буцаа, өөр тайлбар бичихгүй:',
      '{"description":"...","characters":[...],"metaTitle":"...","metaDescription":"..."}',
      chars.length
        ? `⚠️ characters массив нь ЯГ ${chars.length} элементтэй, ижил дараалалтай байна.`
        : '⚠️ characters нь хоосон массив [].',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const raw = await this.complete(prompt);
      if (!raw) return null;

      const parsed = this.parseJson(raw);
      if (!parsed) return null;

      /**
       * ⚠️ ДҮРИЙН НЭРИЙН ТОО таарахгүй бол орчуулгыг АВАХГҮЙ.
       * LLM нэг нэр алгасвал жүжигчид дүрээ СОЛЬЖ авна (Jake Sully-г
       * Zoe Saldaña-д оноох) — энэ нь хэрэглэгчид ХАРАГДАХ алдаа.
       */
      const outChars =
        Array.isArray(parsed.characters) && parsed.characters.length === chars.length
          ? parsed.characters.map((c: unknown) => String(c ?? ''))
          : chars;

      return {
        description: String(parsed.description ?? '').trim() || input.description,
        characters: outChars,
        metaTitle: String(parsed.metaTitle ?? '').trim(),
        metaDescription: String(parsed.metaDescription ?? '').trim(),
      };
    } catch (err) {
      /* ⚠️ Орчуулга унасан нь импортыг унагаах ёсгүй — англи эх үлдэнэ */
      this.logger.warn(`AI орчуулга амжилтгүй: ${String(err)}`);
      return null;
    }
  }

  /**
   * Богино текст (жанр, дүрийн нэр гэх мэт) орчуулах.
   * ⚠️ Хоосон эсвэл AI байхгүй бол эхийг нь буцаана.
   */
  async translateShort(text: string): Promise<string> {
    if (!text.trim() || !this.enabled) return text;
    try {
      const out = await this.complete(
        `Дараах англи хэллэгийг монгол руу орчуул. ЗӨВХӨН орчуулгыг бич, өөр юу ч бичихгүй:\n${text}`,
      );
      return out?.trim() || text;
    } catch {
      return text;
    }
  }

  /**
   * Provider-аас үл хамаарсан нэгдсэн дуудалт.
   * ⚠️ OpenAI эхэнд — хоёул тохируулсан бол OpenAI-г сонгоно.
   */
  private async complete(prompt: string): Promise<string | null> {
    const openaiKey = this.config.get<string>('ai.openaiKey');
    if (openaiKey) return this.callOpenai(openaiKey, prompt);

    const anthropicKey = this.config.get<string>('ai.anthropicKey');
    if (anthropicKey) return this.callAnthropic(anthropicKey, prompt);

    return null;
  }

  private async callOpenai(key: string, prompt: string): Promise<string | null> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: this.config.get<string>('ai.openaiModel'),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1200,
      }),
      /* ⚠️ AI удвал импорт гацна — 30 сек хүлээгээд орхино */
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      this.logger.warn(`OpenAI ${res.status}: ${await res.text()}`);
      return null;
    }
    const d = await res.json();
    return d.choices?.[0]?.message?.content ?? null;
  }

  private async callAnthropic(key: string, prompt: string): Promise<string | null> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.get<string>('ai.anthropicModel'),
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      this.logger.warn(`Anthropic ${res.status}: ${await res.text()}`);
      return null;
    }
    const d = await res.json();
    return d.content?.[0]?.text ?? null;
  }

  /**
   * LLM-ийн хариунаас JSON салгана.
   * ⚠️ "ЗӨВХӨН JSON бич" гэж хэлсэн ч ```json ...``` дотор боож
   * буцаах нь ЭНГИЙН — тиймээс эхний { ... сүүлийн } хооронд авна.
   */
  private parseJson(raw: string): Record<string, unknown> | null {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}
