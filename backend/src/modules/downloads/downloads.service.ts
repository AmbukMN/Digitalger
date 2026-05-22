import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import * as archiver from 'archiver';
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
      expiresIn: 300,
      generatedAt: Date.now(),
    };
  }

  async streamZipDownload(userId: string, productId: string, res: Response) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { files: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!product) throw new NotFoundException('Product not found');

    const owned = await this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.PAID,
        items: { some: { productId } },
      },
    });

    if (!owned) throw new ForbiddenException('You do not own this product');

    if (!product.files.length) throw new NotFoundException('No files to download');

    const zipName = `${product.slug ?? productId}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const zip = archiver.default('zip', { zlib: { level: 6 } });
    zip.pipe(res);

    await Promise.all(
      product.files.map(async (file) => {
        const url = await this.storage.getPresignedUrl(file.fileKey, 300, 'get');
        const response = await fetch(url);
        if (!response.ok || !response.body) return;
        const { Readable } = await import('stream');
        const nodeStream = Readable.fromWeb(response.body as any);
        zip.append(nodeStream, { name: file.fileName });
      }),
    );

    await zip.finalize();
  }

  async streamBundleZip(userId: string, productId: string, bundleId: string, res: Response) {
    const owned = await this.prisma.order.findFirst({
      where: { userId, status: OrderStatus.PAID, items: { some: { productId } } },
    });
    if (!owned) throw new ForbiddenException('You do not own this product');

    const bundle = await this.prisma.productBundle.findUnique({
      where: { id: bundleId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!bundle || bundle.productId !== productId) throw new NotFoundException('Bundle not found');

    const allFileIds = bundle.items.flatMap((item) =>
      item.fileIds.length > 0 ? item.fileIds : item.fileId ? [item.fileId] : [],
    );
    if (!allFileIds.length) throw new NotFoundException('No files in bundle');

    const files = await this.prisma.productFile.findMany({
      where: { id: { in: allFileIds } },
    });

    const zipName = `${bundle.title.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const zip = archiver.default('zip', { zlib: { level: 6 } });
    zip.pipe(res);

    for (const file of files) {
      const url = await this.storage.getPresignedUrl(file.fileKey, 300, 'get');
      const response = await fetch(url);
      if (!response.ok || !response.body) continue;
      const { Readable } = await import('stream');
      const nodeStream = Readable.fromWeb(response.body as any);
      zip.append(nodeStream, { name: file.fileName });
    }

    await zip.finalize();
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
