import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Хавсралтын дээд хэмжээ — uploads pattern-тай нийцүүлж 100MB. */
export const QA_ATTACHMENT_MAX_SIZE = 100 * 1024 * 1024; // 100 MB

/**
 * Q&A хавсралтад зөвшөөрөгдсөн MIME төрлүүд (зураг / pdf / doc).
 * Хэрэглэгч асуулт/хариултад файл хавсаргахад серверт шалгана.
 */
export const QA_ALLOWED_MIME_TYPES = new Set<string>([
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  // PDF
  'application/pdf',
  // Word/doc
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

/**
 * Q&A асуулт/хариултын хавсралтын мета (R2 key + нэр/төрөл/хэмжээ).
 * Файлыг урьдчилан uploads (presigned/proxy)-аар R2-д хууль, key-г энд дамжуулна.
 * Бүх талбар сонголттой — хавсралтгүй ч асуулт асууж/хариулж болно.
 */
export class QaAttachmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  attachmentKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  attachmentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  attachmentMimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(QA_ATTACHMENT_MAX_SIZE)
  attachmentSize?: number;
}

/** Хичээлд асуулт асуух DTO (хавсралт сонголттой). */
export class AskQuestionDto extends QaAttachmentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  question!: string;
}

/** Асуултад хариулах DTO (хэрэглэгч ч хариулж болно, хавсралт сонголттой). */
export class AddAnswerDto extends QaAttachmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  answer!: string;
}
