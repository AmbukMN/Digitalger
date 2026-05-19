import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.ordersService.findUserOrders(
      userId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Get(':id')
  one(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.ordersService.findById(id, userId);
  }

  @Post()
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateOrderDto) {
    return this.ordersService.createPending(userId, dto);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.ordersService.cancelOrder(id, userId);
  }
}
