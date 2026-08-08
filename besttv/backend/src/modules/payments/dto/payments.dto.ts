import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * ⚠️⚠️ ЯАГААД DTO ХЭРЭГТЭЙ ВЭ.
 *
 * Өмнө нь эдгээр endpoint нь `@Body('amount') amount: number` гэж
 * ТҮҮХИЙ талбар авдаг байв. Глобал `ValidationPipe` (whitelist,
 * forbidNonWhitelisted, transform) нь DTO КЛАСС дээр л ажилладаг тул
 * тэдгээрт ОГТ ҮЙЛЧЛЭХГҮЙ байсан.
 *
 * БОДИТ ЭРСДЭЛ:
 *   {"amount": "abc"}  → Number() = NaN. `NaN < 1000` нь false,
 *                        `NaN > 5_000_000` ч false → ХОЁУЛАА давж
 *                        NaN нь QPay руу илгээгдэнэ.
 *   {"amount": 1000.7} → QPay-д бутархай төгрөг явна.
 *   {"amount": "1e6"}  → чимээгүй 1,000,000 болно.
 */

/** Хэтэвч цэнэглэх */
export class TopupDto {
  /**
   * ⚠️ `@IsInt` нь бутархай ба NaN хоёуланг хаана.
   * ⚠️ Хязгаарууд нь service доторх шалгалттай ИЖИЛ байх ёстой
   * (payments.service.ts — 1,000₮ / 5,000,000₮).
   */
  @IsInt({ message: 'Дүн бүхэл тоо байх ёстой' })
  @Min(1000, { message: 'Хамгийн бага цэнэглэлт 1,000₮' })
  @Max(5_000_000, { message: 'Хамгийн их цэнэглэлт 5,000,000₮' })
  amount: number;
}

/** Багц худалдан авах (QPay эсвэл хэтэвч) */
export class PurchasePlanDto {
  @IsString()
  @IsNotEmpty({ message: 'Багц сонгоно уу' })
  planId: string;

  /* ⚠️ Урт хязгаар — DB индекст сөрөг нөлөөтэй урт мөр хаана */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  couponCode?: string;
}

/** Кино түрээслэх */
export class RentTitleDto {
  @IsString()
  @IsNotEmpty({ message: 'Кино сонгоно уу' })
  titleId: string;
}
