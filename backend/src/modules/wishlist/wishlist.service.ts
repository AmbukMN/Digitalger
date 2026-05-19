import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getForUser(userId: string) {
    const items = await this.prisma.wishlist.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            price: true,
            type: true,
            previewUrl: true,
            images: { where: { isPrimary: true }, take: 1, select: { fileKey: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((item) => {
      const img = item.product.images[0];
      const thumbnailUrl = img
        ? this.storage.getAssetUrl(img.fileKey)
        : (item.product.previewUrl ?? null);
      return {
        id: item.id,
        createdAt: item.createdAt,
        product: {
          id: item.product.id,
          title: item.product.title,
          slug: item.product.slug,
          price: item.product.price,
          type: item.product.type,
          thumbnailUrl,
        },
      };
    });
  }

  async toggle(userId: string, productId: string) {
    const existing = await this.prisma.wishlist.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) {
      await this.prisma.wishlist.delete({ where: { id: existing.id } });
      return { added: false };
    }
    await this.prisma.wishlist.create({ data: { userId, productId } });
    return { added: true };
  }

  remove(userId: string, productId: string) {
    return this.prisma.wishlist.deleteMany({ where: { userId, productId } });
  }
}
