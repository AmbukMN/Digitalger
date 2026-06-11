import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { CreateStaffDto, UpdateStaffRoleDto, BlockStaffDto } from './dto/staff.dto';

// ─── Phase 4: STAFF MANAGEMENT ──────────────────────────────────────────────
// ⚠️ ЗӨВХӨН SUPERADMIN хандана (@Roles(Role.SUPERADMIN) — RolesGuard-д ADMIN
// шатлал хамаарахгүй, зөвхөн SUPERADMIN). SUPERADMIN бусад admin (EDITOR/ADMIN)-
// ийг үүсгэх, эрх солих, блоклох, устгах. Хамгаалалт UsersService дотор:
//  - SUPERADMIN-ийг хэн ч role/block/delete хийхгүй (нэг superadmin загвар).
//  - Өөрийгөө (me.sub === target.id) downgrade/block/delete хийхгүй.
//  - role create/update нь зөвхөн EDITOR|ADMIN (DTO + service шалгана).
@Controller('admin/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
export class StaffController {
  constructor(private readonly users: UsersService) {}

  /** Бүх admin (EDITOR/ADMIN/SUPERADMIN) жагсаалт. */
  @Get()
  list() {
    return this.users.listStaff();
  }

  /** Шинэ admin (EDITOR|ADMIN) үүсгэх. */
  @Post()
  create(@Body() dto: CreateStaffDto, @CurrentUser() me: JwtPayload) {
    return this.users.createStaff(dto, me.sub);
  }

  /** Admin-ийн эрх солих (EDITOR|ADMIN). */
  @Patch(':id/role')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateStaffRoleDto,
    @CurrentUser() me: JwtPayload,
  ) {
    return this.users.updateStaffRole(id, dto.role, me.sub);
  }

  /** Admin-ийг блоклох/нээх. */
  @Patch(':id/block')
  block(
    @Param('id') id: string,
    @Body() dto: BlockStaffDto,
    @CurrentUser() me: JwtPayload,
  ) {
    return this.users.blockStaff(id, dto.blocked, me.sub);
  }

  /** Admin-ийг устгах (контент createdByUserId=null болно). */
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() me: JwtPayload) {
    return this.users.deleteStaff(id, me.sub);
  }
}
