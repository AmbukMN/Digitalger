import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { Prisma, SubscriberSex } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';
import { UpdateSubscriberDto } from './dto/update-subscriber.dto';

// "Веб-д бүртгүүлсэн" системийн категори — хэрэглэгч сайтад бүртгүүлэх/имэйл
// солих үед энэ категори руу автоматаар нэмэгдэнэ.
const WEB_REGISTER_CATEGORY = 'Веб-д бүртгүүлсэн';

@Injectable()
export class SubscribersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── ADMIN: жагсаалт (хайлт/шүүлт/хуудаслалт) ─────────────────────────────
  async findAll(query: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    categoryId?: string;
    source?: string;
    sex?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const and: Prisma.SubscriberWhereInput[] = [];
    if (query.search) {
      and.push({
        OR: [
          { email: { contains: query.search, mode: 'insensitive' } },
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }
    if (query.status) and.push({ status: query.status as Prisma.EnumSubscriberStatusFilter['equals'] });
    if (query.categoryId) and.push({ categoryId: query.categoryId });
    if (query.source) and.push({ source: query.source });
    if (query.sex) and.push({ sex: query.sex as SubscriberSex });

    const where: Prisma.SubscriberWhereInput = and.length ? { AND: and } : {};

    const [items, total] = await Promise.all([
      this.prisma.subscriber.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { category: true },
      }),
      this.prisma.subscriber.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const subscriber = await this.prisma.subscriber.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!subscriber) throw new NotFoundException('Захиалагч олдсонгүй');
    return subscriber;
  }

  async create(dto: CreateSubscriberDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.subscriber.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Энэ имэйл аль хэдийн бүртгэлтэй байна');

    return this.prisma.subscriber.create({
      data: {
        email,
        firstName: dto.firstName?.trim() || null,
        lastName: dto.lastName?.trim() || null,
        age: dto.age ?? null,
        sex: dto.sex ?? null,
        phone: dto.phone?.trim() || null,
        source: dto.source || 'admin',
        categoryId: dto.categoryId || null,
        tags: dto.tags ?? [],
      },
      include: { category: true },
    });
  }

  async update(id: string, dto: UpdateSubscriberDto) {
    await this.findOne(id);
    if (dto.email) {
      const email = dto.email.toLowerCase().trim();
      const conflict = await this.prisma.subscriber.findFirst({ where: { email, NOT: { id } } });
      if (conflict) throw new BadRequestException('Энэ имэйл өөр захиалагчид бүртгэлтэй байна');
    }
    return this.prisma.subscriber.update({
      where: { id },
      data: {
        ...(dto.email !== undefined && { email: dto.email.toLowerCase().trim() }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName?.trim() || null }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName?.trim() || null }),
        ...(dto.age !== undefined && { age: dto.age }),
        ...(dto.sex !== undefined && { sex: dto.sex }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() || null }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.source !== undefined && { source: dto.source }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId || null }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { category: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.subscriber.delete({ where: { id } });
    return { success: true };
  }

  // ─── PUBLIC: имэйл захиалах (homepage/free-ppt/checkout/popup) ─────────────
  async subscribe(emailRaw: string, source?: string) {
    const email = (emailRaw ?? '').toLowerCase().trim();
    if (!email || !email.includes('@') || email.length > 254) {
      throw new BadRequestException('Имэйл хаяг буруу байна');
    }
    const existing = await this.prisma.subscriber.findUnique({ where: { email } });
    if (existing) {
      // Хэрэв өмнө unsubscribe хийсэн бол дахин идэвхжүүлнэ
      if (existing.status === 'UNSUBSCRIBED') {
        await this.prisma.subscriber.update({
          where: { email },
          data: { status: 'ACTIVE', isActive: true },
        });
      }
      return { success: true, alreadySubscribed: existing.status !== 'UNSUBSCRIBED' };
    }
    await this.prisma.subscriber.create({
      data: { email, source: source || 'popup', status: 'ACTIVE', isActive: true },
    });
    return { success: true, alreadySubscribed: false };
  }

  async unsubscribe(emailRaw: string) {
    const email = (emailRaw ?? '').toLowerCase().trim();
    const sub = await this.prisma.subscriber.findUnique({ where: { email } });
    if (!sub) return { success: true };
    await this.prisma.subscriber.update({
      where: { email },
      data: { status: 'UNSUBSCRIBED', isActive: false },
    });
    return { success: true };
  }

  // ─── Веб-д бүртгүүлсэн хэрэглэгчийг автомат subscribers-д нэмэх ────────────
  // Бүртгэл/имэйл солих үед auth.service дуудна. "Веб-д бүртгүүлсэн" категорид
  // оруулна. Fire-and-forget (нэвтрэлтэд нөлөөлөхгүй).
  async ensureWebRegister(emailRaw: string, userId?: string, firstName?: string) {
    try {
      const email = (emailRaw ?? '').toLowerCase().trim();
      if (!email || !email.includes('@')) return;
      // guest имэйл (@guest.digitalger.mn) хасах
      if (email.endsWith('@guest.digitalger.mn')) return;

      const category = await this.prisma.subscriberCategory.upsert({
        where: { name: WEB_REGISTER_CATEGORY },
        create: { name: WEB_REGISTER_CATEGORY, isSystem: true, description: 'Сайтад бүртгүүлсэн хэрэглэгчид' },
        update: {},
      });

      const existing = await this.prisma.subscriber.findUnique({ where: { email } });
      if (existing) {
        // Категори/userId шинэчлэх (категоригүй байсан бол)
        await this.prisma.subscriber.update({
          where: { email },
          data: {
            categoryId: existing.categoryId ?? category.id,
            userId: existing.userId ?? userId ?? null,
            ...(existing.status === 'UNSUBSCRIBED' ? {} : { status: 'ACTIVE', isActive: true }),
          },
        });
        return;
      }
      await this.prisma.subscriber.create({
        data: {
          email,
          firstName: firstName?.trim() || null,
          source: 'web-register',
          categoryId: category.id,
          userId: userId ?? null,
          status: 'ACTIVE',
          isActive: true,
        },
      });
    } catch {
      /* subscriber бүртгэл алдаа гарвал нэвтрэлт/бүртгэлд нөлөөлөхгүй */
    }
  }

  // ─── Категори CRUD ────────────────────────────────────────────────────────
  async listCategories() {
    const cats = await this.prisma.subscriberCategory.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { subscribers: true } } },
    });
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      isSystem: c.isSystem,
      count: c._count.subscribers,
      createdAt: c.createdAt,
    }));
  }

  async createCategory(name: string, description?: string) {
    const trimmed = (name ?? '').trim();
    if (!trimmed) throw new BadRequestException('Нэр оруулна уу');
    const existing = await this.prisma.subscriberCategory.findUnique({ where: { name: trimmed } });
    if (existing) throw new BadRequestException('Энэ нэртэй категори аль хэдийн байна');
    return this.prisma.subscriberCategory.create({
      data: { name: trimmed, description: description?.trim() || null },
    });
  }

  async updateCategory(id: string, name?: string, description?: string) {
    const cat = await this.prisma.subscriberCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Категори олдсонгүй');
    if (name && name.trim() !== cat.name) {
      const conflict = await this.prisma.subscriberCategory.findFirst({
        where: { name: name.trim(), NOT: { id } },
      });
      if (conflict) throw new BadRequestException('Энэ нэртэй категори аль хэдийн байна');
    }
    return this.prisma.subscriberCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
    });
  }

  async removeCategory(id: string) {
    const cat = await this.prisma.subscriberCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Категори олдсонгүй');
    if (cat.isSystem) throw new BadRequestException('Системийн категорийг устгах боломжгүй');
    // Захиалагчдын categoryId нь onDelete:SetNull тул null болно (захиалагч устахгүй)
    await this.prisma.subscriberCategory.delete({ where: { id } });
    return { success: true };
  }

  // Олон захиалагчийг категорид зүүх (bulk assign)
  async assignCategory(subscriberIds: string[], categoryId: string | null) {
    if (!subscriberIds?.length) throw new BadRequestException('Захиалагч сонгоогүй байна');
    if (categoryId) {
      const cat = await this.prisma.subscriberCategory.findUnique({ where: { id: categoryId } });
      if (!cat) throw new NotFoundException('Категори олдсонгүй');
    }
    const res = await this.prisma.subscriber.updateMany({
      where: { id: { in: subscriberIds } },
      data: { categoryId },
    });
    return { updated: res.count };
  }

  // ─── Import (XLSX/CSV) ────────────────────────────────────────────────────
  async bulkImport(file: Express.Multer.File, categoryId?: string) {
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!rows.length) throw new BadRequestException('Файл хоосон байна');

    const pick = (r: Record<string, unknown>, keys: string[]) => {
      for (const k of keys) {
        const v = r[k] ?? r[k.toLowerCase()] ?? r[k.toUpperCase()];
        if (v != null && String(v).trim()) return String(v).trim();
      }
      return '';
    };

    const results: { row: number; status: 'created' | 'skipped' | 'error'; email?: string; error?: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const email = pick(r, ['email', 'имэйл', 'Email', 'и-мэйл']).toLowerCase();
      if (!email || !email.includes('@')) {
        results.push({ row: i + 2, status: 'error', error: 'имэйл буруу' });
        continue;
      }
      const firstName = pick(r, ['firstName', 'нэр', 'first_name', 'овог нэр']) || null;
      const lastName = pick(r, ['lastName', 'овог', 'last_name']) || null;
      const phone = pick(r, ['phone', 'утас', 'Phone']) || null;
      const ageStr = pick(r, ['age', 'нас', 'Age']);
      const age = ageStr && !Number.isNaN(Number(ageStr)) ? Number(ageStr) : null;
      try {
        const existing = await this.prisma.subscriber.findUnique({ where: { email } });
        if (existing) {
          results.push({ row: i + 2, status: 'skipped', email, error: 'аль хэдийн байна' });
          continue;
        }
        await this.prisma.subscriber.create({
          data: { email, firstName, lastName, phone, age, source: 'import', categoryId: categoryId || null },
        });
        results.push({ row: i + 2, status: 'created', email });
      } catch (err) {
        results.push({ row: i + 2, status: 'error', email, error: (err as Error)?.message ?? 'Алдаа' });
      }
    }
    return {
      total: rows.length,
      created: results.filter((r) => r.status === 'created').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'error').length,
      results,
    };
  }

  // ─── Export (CSV) ─────────────────────────────────────────────────────────
  async exportCsv(query: { status?: string; categoryId?: string; source?: string }) {
    const where: Prisma.SubscriberWhereInput = {};
    if (query.status) where.status = query.status as Prisma.EnumSubscriberStatusFilter['equals'];
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.source) where.source = query.source;

    const subs = await this.prisma.subscriber.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });

    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['email', 'firstName', 'lastName', 'age', 'sex', 'phone', 'status', 'source', 'category', 'tags', 'createdAt'];
    const lines = [header.join(',')];
    for (const s of subs) {
      lines.push([
        esc(s.email), esc(s.firstName), esc(s.lastName), esc(s.age), esc(s.sex),
        esc(s.phone), esc(s.status), esc(s.source), esc(s.category?.name),
        esc(s.tags.join(';')), esc(new Date(s.createdAt).toISOString()),
      ].join(','));
    }
    return { data: '﻿' + lines.join('\n'), filename: `subscribers_${new Date().toISOString().slice(0, 10)}.csv` };
  }
}
