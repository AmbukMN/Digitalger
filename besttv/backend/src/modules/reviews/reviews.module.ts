import { Module } from '@nestjs/common';
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
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { ReviewsService, type ReviewSort } from './reviews.service';

class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(10)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  comment?: string;

  @IsOptional()
  @IsBoolean()
  hasSpoiler?: boolean;
}

class ReplyDto {
  @IsString()
  @MaxLength(3000)
  comment: string;

  @IsOptional()
  @IsBoolean()
  hasSpoiler?: boolean;
}

class VoteDto {
  @IsIn([1, -1])
  value: 1 | -1;
}

class ReportDto {
  @IsIn(['spam', 'offensive', 'spoiler', 'other'])
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class BulkDeleteDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}

class HiddenDto {
  @IsBoolean()
  isHidden: boolean;
}

/** Тухайн киноны сэтгэгдлүүд */
@Controller('titles/:titleId/reviews')
export class ReviewsController {
  constructor(private readonly svc: ReviewsService) {}

  /**
   * Жагсаалт — нэвтэрсэн бол өөрийн өгсөн саналыг ч буцаана
   * (OptionalJwtAuthGuard: зочин ч үзнэ)
   */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @Param('titleId') titleId: string,
    @CurrentUser() user: JwtPayload | undefined,
    @Query('page') page?: string,
    @Query('sort') sort?: ReviewSort,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list(titleId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      sort,
      userId: user?.sub,
    });
  }

  /** Одны тархалт (график) */
  @Get('stats')
  stats(@Param('titleId') titleId: string) {
    return this.svc.stats(titleId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  upsert(
    @Param('titleId') titleId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateReviewDto,
  ) {
    return this.svc.upsert(user.sub, titleId, dto);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@Param('titleId') titleId: string, @CurrentUser() user: JwtPayload) {
    return this.svc.myReview(user.sub, titleId);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  remove(@Param('titleId') titleId: string, @CurrentUser() user: JwtPayload) {
    return this.svc.remove(user.sub, titleId);
  }
}

/** Тодорхой нэг сэтгэгдэл дээрх үйлдлүүд */
@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewActionsController {
  constructor(private readonly svc: ReviewsService) {}

  /** Хариу бичих (админ бол isStaff тэмдэгтэй) */
  @Post(':id/reply')
  reply(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: ReplyDto) {
    return this.svc.reply(user.sub, id, dto, user.role === Role.ADMIN);
  }

  /** Хэрэгтэй / хэрэггүй (дахин дарвал цуцлагдана) */
  @Post(':id/vote')
  vote(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: VoteDto) {
    return this.svc.vote(user.sub, id, dto.value);
  }

  /** Тохиромжгүй гэж мэдээлэх */
  @Post(':id/report')
  report(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: ReportDto) {
    return this.svc.report(user.sub, id, dto.reason, dto.note);
  }

  /** Өөрийн сэтгэгдэл/хариу устгах */
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.removeOwn(user.sub, id, user.role);
  }
}

@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ReviewsAdminController {
  constructor(private readonly svc: ReviewsService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('rating') rating?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('onlyReported') onlyReported?: string,
    @Query('onlyHidden') onlyHidden?: string,
  ) {
    return this.svc.adminList({
      q,
      rating: rating ? Number(rating) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      onlyReported: onlyReported === '1' || onlyReported === 'true',
      onlyHidden: onlyHidden === '1' || onlyHidden === 'true',
    });
  }

  /** Устгахгүйгээр нуух/буцаах */
  @Patch(':id/hidden')
  setHidden(@Param('id') id: string, @Body() dto: HiddenDto) {
    return this.svc.adminSetHidden(id, dto.isHidden);
  }

  /** Мэдээллийг цэвэрлэх (зөв сэтгэгдэл гэж шийдвэрлэв) */
  @Post(':id/clear-reports')
  clearReports(@Param('id') id: string) {
    return this.svc.adminClearReports(id);
  }

  @Delete('bulk')
  bulkRemove(@Body() dto: BulkDeleteDto) {
    return this.svc.adminBulkRemove(dto.ids);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.adminRemove(id);
  }
}

@Module({
  controllers: [ReviewsController, ReviewActionsController, ReviewsAdminController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
