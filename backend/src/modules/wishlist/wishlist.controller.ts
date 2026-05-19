import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WishlistService } from './wishlist.service';

@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  getMyWishlist(@Request() req: any) {
    return this.wishlist.getForUser(req.user.id);
  }

  @Post()
  toggle(@Request() req: any, @Body('productId') productId: string) {
    return this.wishlist.toggle(req.user.id, productId);
  }

  @Delete(':productId')
  remove(@Request() req: any, @Param('productId') productId: string) {
    return this.wishlist.remove(req.user.id, productId);
  }
}
