import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { OrdersModule } from '../orders/orders.module';
import { UsersModule } from '../users/users.module';
import { ProductsModule } from '../products/products.module';
import { AdminController } from './admin.controller';
import { AdminProductsService } from './admin-products.service';
import { AdminAiService } from './admin-ai.service';

@Module({
  imports: [CategoriesModule, OrdersModule, UsersModule, ProductsModule],
  controllers: [AdminController],
  providers: [AdminProductsService, AdminAiService],
})
export class AdminModule {}
