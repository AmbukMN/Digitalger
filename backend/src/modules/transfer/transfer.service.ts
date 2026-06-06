import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// FB/IG доторх браузараас системийн браузар руу шилжихэд хэрэглэгчийн state-ийг
// түр хадгалж, богино token-оор сэргээх сервис.
@Injectable()
export class TransferService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly TTL_MS = 30 * 60 * 1000; // 30 минут

  /** State хадгалж token буцаана (системийн браузарт дамжуулна). */
  async save(payload: unknown): Promise<{ token: string }> {
    const rec = await this.prisma.transferState.create({
      data: {
        payload: payload as object,
        expiresAt: new Date(Date.now() + TransferService.TTL_MS),
      },
      select: { id: true },
    });
    return { token: rec.id };
  }

  /** Token-оор state сэргээнэ (нэг удаагийн — авмагц used болгоно). */
  async consume(token: string): Promise<{ payload: unknown }> {
    const rec = await this.prisma.transferState.findUnique({ where: { id: token } });
    if (!rec || rec.used || rec.expiresAt < new Date()) {
      throw new NotFoundException('Шилжүүлгийн линк хүчингүй эсвэл хугацаа дууссан');
    }
    // Нэг удаагийн — дахин ашиглахаас сэргийлж used болгоно
    await this.prisma.transferState.update({
      where: { id: token },
      data: { used: true },
    }).catch(() => {});
    return { payload: rec.payload };
  }
}
