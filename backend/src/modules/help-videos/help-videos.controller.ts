import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import {
  CreateHelpVideoDto,
  HelpVideosService,
  UpdateHelpVideoDto,
} from './help-videos.service';

// Public: Help Assistant panel-ийн "Видео заавар" tab
@Controller('help/videos')
export class HelpVideosPublicController {
  constructor(private readonly helpVideos: HelpVideosService) {}

  @Get()
  list() {
    return this.helpVideos.findActive();
  }
}

// Admin: CRUD
@Controller('admin/help-videos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class HelpVideosAdminController {
  constructor(private readonly helpVideos: HelpVideosService) {}

  @Get()
  listAll() {
    return this.helpVideos.findAll();
  }

  @Post()
  create(@Body() dto: CreateHelpVideoDto, @CurrentUser() me: JwtPayload) {
    return this.helpVideos.create(dto, me);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHelpVideoDto,
    @CurrentUser() me: JwtPayload,
  ) {
    return this.helpVideos.update(id, dto, me);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() me: JwtPayload) {
    return this.helpVideos.remove(id, me);
  }
}
