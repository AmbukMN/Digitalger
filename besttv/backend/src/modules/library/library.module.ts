import { Module } from '@nestjs/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { TitleMediaHelper } from '../titles/title-media.helper';
import { TitlesModule } from '../titles/titles.module';

// ─── Үзэлтийн явц + Миний жагсаалт ──────────────────────────────────────────

class ProgressDto {
  @IsString()
  titleId: string;

  @IsOptional()
  @IsString()
  episodeId?: string;

  @IsInt()
  @Min(0)
  positionSec: number;

  @IsInt()
  @Min(0)
  durationSec: number;
}

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: TitleMediaHelper,
  ) {}

  async saveProgress(userId: string, dto: ProgressDto) {
    return this.prisma.watchProgress.upsert({
      where: { userId_titleId: { userId, titleId: dto.titleId } },
      create: { userId, ...dto },
      update: {
        positionSec: dto.positionSec,
        durationSec: dto.durationSec,
        episodeId: dto.episodeId ?? null,
      },
    });
  }

  async myList(userId: string) {
    const rows = await this.prisma.myListItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        title: {
          select: {
            id: true,
            type: true,
            title: true,
            slug: true,
            posterKey: true,
            isPremium: true,
            rating: true,
            year: true,
          },
        },
      },
    });
    return this.media.decorateMany(rows.map((r) => r.title));
  }

  /** Зөвхөн titleId-үүд — карт бүрт "жагсаалтад орсон эсэх" шалгахад хурдан */
  async myListIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.myListItem.findMany({
      where: { userId },
      select: { titleId: true },
    });
    return rows.map((r) => r.titleId);
  }

  async addToList(userId: string, titleId: string) {
    await this.prisma.myListItem.upsert({
      where: { userId_titleId: { userId, titleId } },
      create: { userId, titleId },
      update: {},
    });
    return { ok: true };
  }

  async removeFromList(userId: string, titleId: string) {
    await this.prisma.myListItem
      .delete({ where: { userId_titleId: { userId, titleId } } })
      .catch(() => null);
    return { ok: true };
  }
}

@Controller()
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly svc: LibraryService) {}

  @Post('progress')
  saveProgress(@CurrentUser() user: JwtPayload, @Body() dto: ProgressDto) {
    return this.svc.saveProgress(user.sub, dto);
  }

  @Get('my-list')
  myList(@CurrentUser() user: JwtPayload) {
    return this.svc.myList(user.sub);
  }

  @Get('my-list/ids')
  myListIds(@CurrentUser() user: JwtPayload) {
    return this.svc.myListIds(user.sub);
  }

  @Post('my-list/:titleId')
  add(@CurrentUser() user: JwtPayload, @Param('titleId') titleId: string) {
    return this.svc.addToList(user.sub, titleId);
  }

  @Delete('my-list/:titleId')
  remove(@CurrentUser() user: JwtPayload, @Param('titleId') titleId: string) {
    return this.svc.removeFromList(user.sub, titleId);
  }
}

@Module({
  imports: [TitlesModule],
  controllers: [LibraryController],
  providers: [LibraryService],
})
export class LibraryModule {}
