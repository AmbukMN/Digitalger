import { Injectable } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { assertOwner, assertCanDelete } from '../../common/ownership';
import { assertPermission } from '../../common/permission';

export class CreatePartnerDto {
  @IsString()
  name!: string;

  @IsOptional() @IsString()
  logo?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  website?: string;

  @IsOptional() @IsBoolean()
  featured?: boolean;

  @IsOptional() @IsBoolean()
  active?: boolean;

  @IsOptional() @IsNumber() @Min(0)
  sortOrder?: number;
}

export class UpdatePartnerDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  logo?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  website?: string;

  @IsOptional() @IsBoolean()
  featured?: boolean;

  @IsOptional() @IsBoolean()
  active?: boolean;

  @IsOptional() @IsNumber() @Min(0)
  sortOrder?: number;
}

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  // Public: идэвхтэй хамтрагчид (footer swiper-д)
  findAllActive() {
    return this.prisma.partner.findMany({
      where: { active: true },
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }],
    });
  }

  // Admin: бүх хамтрагч (SHARED resource — бүх admin харна, гэхдээ edit/delete ownership хэвээр)
  async findAll(me: JwtPayload) {
    await assertPermission(this.prisma, me, 'partners', 'view');
    return this.prisma.partner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  findOne(id: string) {
    return this.prisma.partner.findUniqueOrThrow({ where: { id } });
  }

  async create(dto: CreatePartnerDto, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'partners', 'create');
    return this.prisma.partner.create({
      data: { ...dto, createdByUserId: me.sub },
    });
  }

  async update(id: string, dto: UpdatePartnerDto, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'partners', 'edit');
    const row = await this.findOne(id);
    // ⚠️ IDOR: зөвхөн өөрийн (эсвэл SUPERADMIN) хамтрагчийг засна.
    assertOwner(me, row, 'засах');
    return this.prisma.partner.update({ where: { id }, data: dto });
  }

  async remove(id: string, me: JwtPayload) {
    await assertPermission(this.prisma, me, 'partners', 'delete');
    assertCanDelete(me);
    const row = await this.findOne(id);
    assertOwner(me, row, 'устгах');
    return this.prisma.partner.delete({ where: { id } });
  }
}
