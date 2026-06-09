import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CoursesService } from './courses.service';
import { LessonProgressDto } from './dto/lesson-progress.dto';
import { AskQuestionDto, AddAnswerDto } from './dto/qa.dto';
import { SubmitQuizDto } from './dto/quiz.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  // ⚠️ 'my/certificates' нь :productSlug dynamic route-ООС ӨМНӨ зарлагдсан тул
  // route дараалал: статик 'my' эхэнд тулгарч, :productSlug-аар барьцаалагдахгүй.
  // Хэрэглэгчийн БҮХ авсан сертификат жагсаах ("Миний сертификат").
  @Get('my/certificates')
  @UseGuards(JwtAuthGuard)
  myCertificates(@CurrentUser('sub') userId: string) {
    return this.coursesService.listMyCertificates(userId);
  }


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

  // ── Certificate (курс 100% дуусахад) ────────────────────────────────────────

  // Курс бүрэн дууссан үед сертификат олгох (upsert). Дуусгаагүй бол алдаа.
  @Post(':productSlug/certificate')
  @UseGuards(JwtAuthGuard)
  issueCertificate(
    @Param('productSlug') productSlug: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.coursesService.issueCertificate(productSlug, userId);
  }

  // Хэрэглэгчийн сертификатын meta + явц (eligible эсэх).
  @Get(':productSlug/certificate')
  @UseGuards(JwtAuthGuard)
  getCertificate(
    @Param('productSlug') productSlug: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.coursesService.getCertificate(productSlug, userId);
  }

  // Нийтийн баталгаажуулах + хэвлэх — certNo-оор HTML сертификат буцаана.
  @Get('certificate/:certNo/view')
  async viewCertificate(
    @Param('certNo') certNo: string,
    @Res() res: Response,
  ) {
    const html = await this.coursesService.getCertificateHtml(certNo);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  // ── Lesson Q&A ──────────────────────────────────────────────────────────────

  // Тухайн хичээлийн асуултууд + хариултууд (entitlement шалгана).
  @Get(':productSlug/lessons/:lessonId/questions')
  @UseGuards(JwtAuthGuard)
  listQuestions(
    @Param('productSlug') productSlug: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.coursesService.listQuestions(productSlug, lessonId, userId);
  }

  // Хичээлд асуулт асуух. Спам сэргийлэх — 5 асуулт/минут.
  @Post(':productSlug/lessons/:lessonId/questions')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  askQuestion(
    @Param('productSlug') productSlug: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: AskQuestionDto,
  ) {
    return this.coursesService.askQuestion(productSlug, lessonId, userId, body.question, {
      attachmentKey: body.attachmentKey,
      attachmentName: body.attachmentName,
      attachmentMimeType: body.attachmentMimeType,
      attachmentSize: body.attachmentSize,
    });
  }

  // Асуултад хариулах — хэрэглэгч ч хариулж болно (isInstructor=false). 5 хариулт/минут.
  @Post('questions/:questionId/answers')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  addAnswer(
    @Param('questionId') questionId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: AddAnswerDto,
  ) {
    return this.coursesService.addAnswer(questionId, userId, body.answer, false, {
      attachmentKey: body.attachmentKey,
      attachmentName: body.attachmentName,
      attachmentMimeType: body.attachmentMimeType,
      attachmentSize: body.attachmentSize,
    });
  }

  // ── Quiz (хичээлийн дараах шалгалт) ──────────────────────────────────────────

  // Тухайн хичээлийн quiz (⚠️ correctIndex-гүй — аюулгүй).
  @Get(':productSlug/lessons/:lessonId/quiz')
  @UseGuards(JwtAuthGuard)
  getQuiz(
    @Param('productSlug') productSlug: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.coursesService.getQuizForLesson(productSlug, lessonId, userId);
  }

  // Quiz хариулт илгээх — серверт correctIndex-тэй тулгаж дүн тооцоолно.
  @Post(':productSlug/lessons/:lessonId/quiz/submit')
  @UseGuards(JwtAuthGuard)
  submitQuiz(
    @Param('productSlug') productSlug: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: SubmitQuizDto,
  ) {
    return this.coursesService.submitQuiz(productSlug, lessonId, userId, body.answers);
  }
}
