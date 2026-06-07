import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CoursesService } from './courses.service';
import { LessonProgressDto } from './dto/lesson-progress.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get(':productSlug/lessons')
  lessons(@Param('productSlug') productSlug: string) {
    return this.coursesService.getLessonsByProductSlug(productSlug);
  }

  @Get(':productSlug/lessons/:lessonId/video')
  @UseGuards(JwtAuthGuard)
  video(
    @Param('productSlug') productSlug: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.coursesService.getLessonVideoUrl(productSlug, lessonId, userId);
  }

  // Хичээл үзэлтийн явц хадгалах (continue watching + дууссан тэмдэглэгээ).
  @Post(':productSlug/lessons/:lessonId/progress')
  @UseGuards(JwtAuthGuard)
  saveProgress(
    @Param('productSlug') productSlug: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: LessonProgressDto,
  ) {
    return this.coursesService.saveLessonProgress(productSlug, lessonId, userId, body);
  }

  // Хичээлийн хавсралт (нөөц файл) татах — entitlement шалгаад signed URL буцаана.
  @Get(':productSlug/resources/:resourceId/download')
  @UseGuards(JwtAuthGuard)
  downloadResource(
    @Param('productSlug') productSlug: string,
    @Param('resourceId') resourceId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.coursesService.getLessonResourceUrl(productSlug, resourceId, userId);
  }

  // Тухайн course-ийн бүх хичээлд хэрэглэгчийн үзэлтийн явц.
  @Get(':productSlug/progress')
  @UseGuards(JwtAuthGuard)
  progress(
    @Param('productSlug') productSlug: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.coursesService.getCourseProgress(productSlug, userId);
  }
}
