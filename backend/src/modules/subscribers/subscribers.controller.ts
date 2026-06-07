import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SubscribersService } from './subscribers.service';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';
import { UpdateSubscriberDto } from './dto/update-subscriber.dto';

// ─── PUBLIC: имэйл захиалах (newsletter) ──────────────────────────────────────
@Controller('subscribers')
export class SubscribersPublicController {
  constructor(private readonly subscribers: SubscribersService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } }) // спам имэйл бүртгэлээс сэргийлэх
  @Post('subscribe')
  subscribe(@Body() body: { email: string; source?: string }) {
    return this.subscribers.subscribe(body?.email, body?.source);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('unsubscribe')
  unsubscribe(@Body() body: { email: string }) {
    return this.subscribers.unsubscribe(body?.email);
  }
}

// ─── ADMIN: захиалагч + категори удирдах ──────────────────────────────────────
@Controller('admin/subscribers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminSubscribersController {
  constructor(private readonly subscribers: SubscribersService) {}

  // ── Категори (захиалагчаас өмнө — :id route-той зөрчилдөхгүйн тулд тусгай зам) ──
  @Get('categories')
  listCategories() {
    return this.subscribers.listCategories();
  }

  @Post('categories')
  createCategory(@Body() body: { name: string; description?: string }) {
    return this.subscribers.createCategory(body.name, body.description);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() body: { name?: string; description?: string }) {
    return this.subscribers.updateCategory(id, body.name, body.description);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.subscribers.removeCategory(id);
  }

  @Post('assign-category')
  assignCategory(@Body() body: { subscriberIds: string[]; categoryId: string | null }) {
    return this.subscribers.assignCategory(body.subscriberIds, body.categoryId ?? null);
  }

  @Post('bulk-delete')
  bulkDelete(@Body() body: { subscriberIds: string[] }) {
    return this.subscribers.bulkDelete(body.subscriberIds);
  }

  // ── Import / Export ──
  @Post('bulk-import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async bulkImport(@UploadedFile() file: Express.Multer.File, @Body('categoryId') categoryId?: string) {
    if (!file) throw new BadRequestException('Файл сонгоогүй байна');
    const name = file.originalname.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      throw new BadRequestException('Зөвхөн .xlsx, .xls, .csv файл зөвшөөрнө');
    }
    return this.subscribers.bulkImport(file, categoryId);
  }

  @Get('export')
  async exportData(
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('source') source?: string,
  ) {
    const fmt = format === 'pdf' ? 'pdf' : 'excel';
    const { buffer, filename, contentType } = await this.subscribers.exportData(fmt, { status, categoryId, source });
    res.setHeader('Content-Type', contentType);
    // PDF (html) → inline (browser-д нээж хэвлэнэ), Excel → attachment (татна)
    const disposition = fmt === 'pdf' ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.send(buffer);
  }

  // ── Захиалагч CRUD ──
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('source') source?: string,
    @Query('sex') sex?: string,
  ) {
    return this.subscribers.findAll({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      search,
      status,
      categoryId,
      source,
      sex,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.subscribers.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSubscriberDto) {
    return this.subscribers.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSubscriberDto) {
    return this.subscribers.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.subscribers.remove(id);
  }
}
