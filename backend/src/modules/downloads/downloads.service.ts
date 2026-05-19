import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';

@Injectable()
export class DownloadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async verifyAndGetSignedUrl(userId: string, fileId: string) {
    const file = await this.prisma.productFile.findUnique({
      where: { id: fileId },
      include: { product: true },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const owned = await this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.PAID,
        items: { some: { productId: file.productId } },
      },
    });

    if (!owned) {
      throw new ForbiddenException('You do not own this product');
    }

    await this.prisma.download.create({
      data: { userId, fileId: file.id },
    });

    const url = await this.storage.getPresignedUrl(file.fileKey, 300, 'get');

    return {
      fileId: file.id,
      fileName: file.fileName,
      url,
      expiresIn: 3600,
    };
  }

  async listUserDownloads(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId, status: OrderStatus.PAID },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                type: true,
                files: {
                  select: { id: true, fileName: true, sortOrder: true },
                  orderBy: { sortOrder: 'asc' },
                },
                images: {
                  where: { videoUrl: null },
                  orderBy: { sortOrder: 'asc' },
                  take: 1,
                  select: { fileKey: true },
                },
              },
            },
          },
        },
      },
    });

    return orders.flatMap((order) =>
      order.items.map((item) => {
        const { images, ...productRest } = item.product as any;
        return {
          orderId: order.id,
          purchasedAt: order.createdAt,
          product: {
            ...productRest,
            thumbnailUrl: images?.[0]?.fileKey ? this.storage.getAssetUrl(images[0].fileKey) : null,
          },
        };
      }),
    );
  }
}
