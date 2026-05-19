import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CoursesService } from './courses.service';

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
}
