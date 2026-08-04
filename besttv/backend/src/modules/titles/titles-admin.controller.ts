import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TitlesAdminService } from './titles-admin.service';
import {
  BulkActiveDto,
  BulkDeleteDto,
  BulkIdsDto,
  BulkPremiumDto,
  CreateEpisodeDto,
  CreateSeasonDto,
  CreateTitleDto,
  UpdateEpisodeDto,
  UpdateTitleDto,
} from './dto/title-admin.dto';

@Controller('admin/titles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class TitlesAdminController {
  constructor(private readonly svc: TitlesAdminService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('genre') genre?: string,
    @Query('status') status?: string,
    @Query('access') access?: string,
    @Query('active') active?: string,
    @Query('year') year?: number,
    @Query('sort') sort?: string,
    @Query('dir') dir?: 'asc' | 'desc',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.list({ q, type, genre, status, access, active, year, sort, dir, page, limit });
  }

  /** Шүүлтэд тохирсон тоолол — табын badge (`:id`-ээс ӨМНӨ байх ёстой) */
  @Get('counts')
  counts(@Query('q') q?: string, @Query('genre') genre?: string, @Query('year') year?: number) {
    return this.svc.counts({ q, genre, year });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post()
  create(@Body() dto: CreateTitleDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTitleDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  // ── Bulk үйлдлүүд ───────────────────────────────────────────────────────────
  // ⚠️ `:id` route-уудаас ДООШ байрлуулбал `bulk/...` нь `:id`-д баригдана.
  //    Тиймээс тусдаа `bulk/` угтвартай — Nest давхцлыг зам уртаар нь шийднэ.

  /**
   * Устгахын ӨМНӨ нөлөөллийг харуулна (идэвхтэй түрээс, дуртай, үзэлт).
   * ⚠️ Rental нь Cascade тул кино устахад ТӨЛБӨР ТӨЛСӨН хэрэглэгчийн
   *    идэвхтэй эрх чимээгүй устдаг — админ үүнийг мэдэж байх ёстой.
   */
  @Post('bulk/impact')
  bulkImpact(@Body() dto: BulkIdsDto) {
    return this.svc.bulkImpact(dto.ids);
  }

  @Post('bulk/delete')
  bulkDelete(@Body() dto: BulkDeleteDto) {
    return this.svc.bulkDelete(dto.ids, dto.force ?? false);
  }

  /** Идэвх (нийтлэгдсэн эсэх) бөөнөөр солих */
  @Post('bulk/active')
  bulkActive(@Body() dto: BulkActiveDto) {
    return this.svc.bulkSetActive(dto.ids, dto.isActive);
  }

  /** Төлбөртэй/үнэгүй бөөнөөр солих */
  @Post('bulk/premium')
  bulkPremium(@Body() dto: BulkPremiumDto) {
    return this.svc.bulkSetPremium(dto.ids, dto.isPremium);
  }

  // ── Season / Episode ────────────────────────────────────────────────────────

  @Post(':id/seasons')
  createSeason(@Param('id') titleId: string, @Body() dto: CreateSeasonDto) {
    return this.svc.createSeason(titleId, dto);
  }

  @Delete('seasons/:seasonId')
  removeSeason(@Param('seasonId') seasonId: string) {
    return this.svc.removeSeason(seasonId);
  }

  @Post('seasons/:seasonId/episodes')
  createEpisode(@Param('seasonId') seasonId: string, @Body() dto: CreateEpisodeDto) {
    return this.svc.createEpisode(seasonId, dto);
  }

  @Patch('episodes/:episodeId')
  updateEpisode(@Param('episodeId') episodeId: string, @Body() dto: UpdateEpisodeDto) {
    return this.svc.updateEpisode(episodeId, dto);
  }

  @Delete('episodes/:episodeId')
  removeEpisode(@Param('episodeId') episodeId: string) {
    return this.svc.removeEpisode(episodeId);
  }
}
