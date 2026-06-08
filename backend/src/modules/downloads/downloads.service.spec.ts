// archiver нь ESM-only package — Jest node_modules-ийг transform хийдэггүй тул
// downloads.service import хийхэд унана. verifyAndGetSignedUrl зип ашигладаггүй
// тул бүрэн mock хийнэ (бусад зип метод энэ тест файлд хамаагүй).
jest.mock('archiver', () => ({ default: jest.fn(), __esModule: true }));

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { DownloadsService } from './downloads.service';

/**
 * DownloadsService.verifyAndGetSignedUrl() unit тест (entitlement).
 * PrismaService + StorageService + zipQueue бүгдийг mock хийсэн.
 * Гол логик: PAID эзэмшигч → signed url; эзэмшээгүй → ForbiddenException;
 * файл олдохгүй → NotFoundException; bundle (cross-product) эзэмшил.
 */
describe('DownloadsService.verifyAndGetSignedUrl', () => {
  let service: DownloadsService;
  let prisma: any;
  let storage: any;
  let zipQueue: any;

  beforeEach(() => {
    prisma = {
      productFile: { findUnique: jest.fn(), findMany: jest.fn() },
      order: { findFirst: jest.fn(), findMany: jest.fn() },
      orderItem: { findMany: jest.fn() },
      productBundle: { findMany: jest.fn() },
      product: { update: jest.fn() },
      download: { createMany: jest.fn() },
    };
    storage = { getPresignedUrl: jest.fn().mockResolvedValue('https://signed.url/file') };
    zipQueue = { add: jest.fn() };
    service = new DownloadsService(prisma as any, storage as any, zipQueue as any);

    prisma.product.update.mockResolvedValue({});
    prisma.download.createMany.mockResolvedValue({ count: 1 });
  });

  it('файл олдохгүй → NotFoundException', async () => {
    prisma.productFile.findUnique.mockResolvedValue(null);

    await expect(service.verifyAndGetSignedUrl('user-1', 'file-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('PAID шууд эзэмшигч → signed url буцаана', async () => {
    prisma.productFile.findUnique.mockResolvedValue({
      id: 'file-1',
      fileName: 'doc.pdf',
      fileKey: 'keys/doc.pdf',
      productId: 'prod-1',
      product: { id: 'prod-1' },
    });
    // Шууд эзэмшсэн ИДЭВХТЭЙ (expiresAt=null=насан туршийн) PAID order олдсон
    prisma.order.findMany.mockResolvedValue([{ id: 'order-1', expiresAt: null }]);

    const res = await service.verifyAndGetSignedUrl('user-1', 'file-1');

    expect(res.url).toBe('https://signed.url/file');
    expect(res.fileId).toBe('file-1');
    expect(res.fileName).toBe('doc.pdf');
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          status: OrderStatus.PAID,
        }),
      }),
    );
  });

  it('эзэмшээгүй (direct ч биш, bundle-д ч байхгүй) → ForbiddenException', async () => {
    prisma.productFile.findUnique.mockResolvedValue({
      id: 'file-2',
      fileName: 'x.pdf',
      fileKey: 'keys/x.pdf',
      productId: 'prod-2',
      product: { id: 'prod-2' },
    });
    prisma.order.findMany.mockResolvedValue([]); // direct эзэмшээгүй
    prisma.orderItem.findMany.mockResolvedValue([]); // эзэмшсэн product байхгүй

    await expect(service.verifyAndGetSignedUrl('user-1', 'file-2')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('bundle (cross-product) дотор байгаа файлыг эзэмшсэн product-аар татна', async () => {
    prisma.productFile.findUnique.mockResolvedValue({
      id: 'cross-file',
      fileName: 'bonus.pdf',
      fileKey: 'keys/bonus.pdf',
      productId: 'other-prod', // өөр product-ийн файл
      product: { id: 'other-prod' },
    });
    prisma.order.findMany.mockResolvedValue([]); // direct биш
    // хэрэглэгч prod-1-ийг эзэмшсэн (ИДЭВХТЭЙ — expiresAt=null)
    prisma.orderItem.findMany.mockResolvedValue([
      { productId: 'prod-1', order: { expiresAt: null } },
    ]);
    // prod-1-ийн bundle дотор cross-file байна
    prisma.productBundle.findMany.mockResolvedValue([
      { items: [{ fileId: null, fileIds: ['cross-file'] }] },
    ]);

    const res = await service.verifyAndGetSignedUrl('user-1', 'cross-file');

    expect(res.url).toBe('https://signed.url/file');
    expect(res.fileId).toBe('cross-file');
  });

  it('эзэмшсэн product байгаа ч bundle-д файл багтаагүй → ForbiddenException', async () => {
    prisma.productFile.findUnique.mockResolvedValue({
      id: 'cross-file',
      fileName: 'bonus.pdf',
      fileKey: 'keys/bonus.pdf',
      productId: 'other-prod',
      product: { id: 'other-prod' },
    });
    prisma.order.findMany.mockResolvedValue([]);
    prisma.orderItem.findMany.mockResolvedValue([
      { productId: 'prod-1', order: { expiresAt: null } },
    ]);
    // bundle байгаа ч ондоо файл
    prisma.productBundle.findMany.mockResolvedValue([
      { items: [{ fileId: 'some-other', fileIds: [] }] },
    ]);

    await expect(service.verifyAndGetSignedUrl('user-1', 'cross-file')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
