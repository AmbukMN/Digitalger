import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

interface CreateReviewBody {
  rating: number;
  comment?: string;
  authorName?: string;
  // Math captcha (contact загвар): сервер a+b===ans дахин шалгана.
  captchaA?: number;
  captchaB?: number;
  captchaAnswer?: number;
}

interface UpdateReviewBody {
  rating?: number;
  comment?: string;
  authorName?: string;
}

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  // GET /reviews/:productSlug — public, pagination. Optional auth (UI mine тэмдэглэх).
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':productSlug')
  list(
    @Param('productSlug') productSlug: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.reviews.listReviews(productSlug, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  // GET /reviews/:productSlug/mine — нэвтэрсэн хэрэглэгчийн өөрийн review.
  @UseGuards(JwtAuthGuard)
  @Get(':productSlug/mine')
  mine(@Param('productSlug') productSlug: string, @CurrentUser() user: JwtPayload) {
    return this.reviews.getMyReview(user.sub, productSlug);
  }

  // POST /reviews/:productSlug — нэвтэрсэн хэрэглэгч үлдээх (upsert). Captcha + throttle.
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post(':productSlug')
  create(
    @Param('productSlug') productSlug: string,
    @Body() body: CreateReviewBody,
    @CurrentUser() user: JwtPayload,
  ) {
    // ── Bot спам хамгаалалт: math captcha сервер талаас дахин шалгана ──
    const a = Number(body?.captchaA);
    const b = Number(body?.captchaB);
    const ans = Number(body?.captchaAnswer);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(ans) || a + b !== ans) {
      throw new BadRequestException('Баталгаажуулалт буруу байна. Тооцооллыг дахин шалгана уу.');
    }

    return this.reviews.createReview(user.sub, productSlug, {
      rating: body.rating,
      comment: body.comment,
      authorName: body.authorName,
    });
  }

  // PUT /reviews/:reviewId — зөвхөн өөрийн review засах.
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Put(':reviewId')
  update(
    @Param('reviewId') reviewId: string,
    @Body() body: UpdateReviewBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reviews.updateReview(user.sub, reviewId, {
      rating: body.rating,
      comment: body.comment,
      authorName: body.authorName,
    });
  }

  // DELETE /reviews/:reviewId — зөвхөн өөрийн review устгах.
  @UseGuards(JwtAuthGuard)
  @Delete(':reviewId')
  remove(@Param('reviewId') reviewId: string, @CurrentUser() user: JwtPayload) {
    return this.reviews.deleteReview(user.sub, reviewId);
  }
}
