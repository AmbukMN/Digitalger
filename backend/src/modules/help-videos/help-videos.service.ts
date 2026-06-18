import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { assertOwner, assertCanDelete } from '../../common/ownership';
import { VIDEO_QUEUE, VideoHlsJob } from '../videos/video-queue.types';

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
  // ⚠️ R2-д түр upload хийсэн raw видео key (presign-ээр). Өгвөл backend HLS-руу
  // queue хийнэ (videoKey-г worker m3u8 болгож бичнэ). videoKey-тэй зэрэг өгөхгүй.
  @IsOptional() @IsString() rawVideoKey?: string;
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
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(VIDEO_QUEUE) private readonly videoQueue: Queue<VideoHlsJob>,
  ) {}

  // Public: Help Assistant panel-ийн "Видео заавар" tab (active + бэлэн болсон).
  // ⚠️ HLS хөрвүүлж байгаа (processing/error) видеог public-д ХАРУУЛАХГҮЙ.
  findActive() {
    return this.prisma.helpVideo.findMany({
      where: {
        active: true,
        OR: [{ streamStatus: null }, { streamStatus: 'ready' }],
      },
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

  // Admin: бүгд (SHARED resource — бүх admin харна, edit/delete ownership).
  // _count.views — тухайн видеог хэдэн удаа үзсэн (admin жагсаалтын column).
  findAll() {
    return this.prisma.helpVideo.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { views: true } } },
    });
  }

  async create(dto: CreateHelpVideoDto, me: JwtPayload) {
    const { rawVideoKey, ...rest } = dto;
    // rawVideoKey өгсөн бол → HLS-руу хөрвүүлнэ (processing), videoKey-г worker бичнэ.
    const processing = !!rawVideoKey;
    const created = await this.prisma.helpVideo.create({
      data: {
        ...rest,
        // HLS хөрвүүлж байгаа бол videoKey түр хоосон (worker m3u8 бичнэ)
        ...(processing ? { videoKey: null, streamStatus: 'processing' } : { streamStatus: 'ready' }),
        createdByUserId: me.sub,
      },
    });
    if (rawVideoKey) {
      await this.videoQueue.add(
        'convert',
        { target: 'helpVideo', targetId: created.id, rawKey: rawVideoKey, folder: 'help-videos' },
        { attempts: 2, backoff: 5000, removeOnComplete: true, removeOnFail: 50 },
      );
    }
    return created;
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
