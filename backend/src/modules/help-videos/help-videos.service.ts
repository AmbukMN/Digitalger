import { Injectable } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { assertOwner, assertCanDelete } from '../../common/ownership';

export class CreateHelpVideoDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() videoUrl?: string;
  @IsOptional() @IsString() videoKey?: string;
  @IsOptional() @IsString() videoStreamId?: string;
  @IsOptional() @IsString() posterKey?: string;
  @IsOptional() @IsString() durationLabel?: string;
  @IsOptional() @IsNumber() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateHelpVideoDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() videoUrl?: string;
  @IsOptional() @IsString() videoKey?: string;
  @IsOptional() @IsString() videoStreamId?: string;
  @IsOptional() @IsString() posterKey?: string;
  @IsOptional() @IsString() durationLabel?: string;
  @IsOptional() @IsNumber() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Injectable()
export class HelpVideosService {
  constructor(private readonly prisma: PrismaService) {}

  // Public: Help Assistant panel-ийн "Видео заавар" tab (active, эрэмбээр)
  findActive() {
    return this.prisma.helpVideo.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        videoUrl: true,
        videoKey: true,
        videoStreamId: true,
        posterKey: true,
        durationLabel: true,
      },
    });
  }

  // Admin: бүгд (SHARED resource — бүх admin харна, edit/delete ownership)
  findAll() {
    return this.prisma.helpVideo.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  create(dto: CreateHelpVideoDto, me: JwtPayload) {
    return this.prisma.helpVideo.create({
      data: { ...dto, createdByUserId: me.sub },
    });
  }

  async update(id: string, dto: UpdateHelpVideoDto, me: JwtPayload) {
    const existing = await this.prisma.helpVideo.findUniqueOrThrow({ where: { id } });
    assertOwner(me, existing, 'засах');
    return this.prisma.helpVideo.update({ where: { id }, data: dto });
  }

  async remove(id: string, me: JwtPayload) {
    assertCanDelete(me);
    const existing = await this.prisma.helpVideo.findUniqueOrThrow({ where: { id } });
    assertOwner(me, existing, 'устгах');
    return this.prisma.helpVideo.delete({ where: { id } });
  }
}
