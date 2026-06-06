import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// FB/IG доторх браузараас системийн браузар руу шилжихэд хэрэглэгчийн state-ийг
// түр хадгалж, богино token-оор сэргээх сервис.
@Injectable()
export class TransferService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly TTL_MS = 30 * 60 * 1000; // 30 минут

  // Payload-ийн дээд хэмжээ (DoS-аас сэргийлнэ — хэн нэг том JSON давтан илгээж
  // DB дүүргэхээс хамгаална). Сагс/wishlist/coupon/chat 100KB-д тав тухтай багтана.
  private static readonly MAX_PAYLOAD_BYTES = 100 * 1024;

  /** State хадгалж token буцаана (системийн браузарт дамжуулна). */
  async save(payload: unknown): Promise<{ token: string }> {
    // Хэмжээ хязгаар шалгах
    const size = Buffer.byteLength(JSON.stringify(payload ?? {}), 'utf8');
    if (size > TransferService.MAX_PAYLOAD_BYTES) {
      throw new BadRequestException('Шилжүүлэх өгөгдөл хэт том байна');
    }
    const rec = await this.prisma.transferState.create({
      data: {
        payload: payload as object,
        expiresAt: new Date(Date.now() + TransferService.TTL_MS),
      },
      select: { id: true },
    });
    return { token: rec.id };
  }

  /**
   * Token-оор state сэргээнэ. TTL (30мин) дотор ОЛОН УДАА consume хийж болно —
   * учир нь хэрэглэгч нэг линкийг Safari/Chrome хоёуланд нээж болно, мөн effect
   * давхар ажиллаж болзошгүй. Нэг удаагийн used flag тавихгүй (тавьбал хоёр дахь
   * нээлт "хоосон" болдог). Зөвхөн expiry-р хязгаарлана — TTL дуусахад автомат
   * хүчингүй.
   */
  async consume(token: string): Promise<{ payload: unknown }> {
    const rec = await this.prisma.transferState.findUnique({ where: { id: token } });
    if (!rec || rec.expiresAt < new Date()) {
      throw new NotFoundException('Шилжүүлгийн линк хүчингүй эсвэл хугацаа дууссан');
    }
    return { payload: rec.payload };
  }
}
