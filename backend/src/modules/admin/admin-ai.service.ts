import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

interface GenerateInput {
  fileNames: string[];
  fileTypes: string[];
  productType: string;
  categoryName?: string;
}

export interface GeneratedContent {
  title: string;
  description: string;
  howToUse: string;
  whatsIncluded: string;
}

@Injectable()
export class AdminAiService {
  private client: Anthropic;

  constructor(private readonly config: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.config.get<string>('anthropicApiKey') ?? '',
    });
  }

  isEnabled(): boolean {
    const key = this.config.get<string>('anthropicApiKey');
    return !!(key && key.length > 0);
  }

  async generateProductContent(input: GenerateInput): Promise<GeneratedContent> {
    const { fileNames, fileTypes, productType, categoryName } = input;

    const fileList = fileNames
      .map((name, i) => `${i + 1}. ${name}${fileTypes[i] ? ` (${fileTypes[i]})` : ''}`)
      .join('\n');

    const prompt = `Та DigitalGer.mn Монгол дижитал бүтээгдэхүүний зах зээлийн контент бичгч AI туслагч юм.

Доорх файлуудаас бүрдсэн "${productType}" төрлийн${categoryName ? ` "${categoryName}" ангилалд харьяалах` : ''} дижитал бүтээгдэхүүний дараах агуулгуудыг Монгол хэлээр бич:

Файлуудын жагсаалт:
${fileList}

Дараах JSON форматаар хариул (JSON-аас өөр юм бичихгүй):
{
  "title": "Бүтээгдэхүүний богино нэр (3-7 үг, тодорхой, хэрэглэгчид ойлгомжтой)",
  "description": "Бүтээгдэхүүний дэлгэрэнгүй тайлбар (2-3 өгүүлбэр, хэрэглэгчид яагаад хэрэгтэй болохыг тайлбарла)",
  "howToUse": "Хэрхэн ашиглах вэ? алхам алхмаар заавар (3-5 алхам, мөр бүр нэг алхам)",
  "whatsIncluded": "Багцад юу багтсан бэ? (файл бүрийг дурдаж, товч тайлбарла)"
}`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON олдсонгүй');

      const parsed = JSON.parse(jsonMatch[0]) as GeneratedContent;
      return parsed;
    } catch (err) {
      throw new InternalServerErrorException(
        'AI контент үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.',
      );
    }
  }
}
