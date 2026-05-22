import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WishlistService } from './wishlist.service';

@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  getMyWishlist(@CurrentUser('sub') userId: string) {
    return this.wishlist.getForUser(userId);
  }

  @Post()
  toggle(@CurrentUser('sub') userId: string, @Body('productId') productId: string) {
    return this.wishlist.toggle(userId, productId);
  }

  @Delete(':productId')
  remove(@CurrentUser('sub') userId: string, @Param('productId') productId: string) {
    return this.wishlist.remove(userId, productId);
  }
}
