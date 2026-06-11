import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// ⚠️ Staff үүсгэх/эрх солих үед SUPERADMIN сонгох боломжгүй (нэг л superadmin).
// Зөвхөн EDITOR | ADMIN зөвшөөрнө.
export const STAFF_ASSIGNABLE_ROLES = ['EDITOR', 'ADMIN'] as const;
export type StaffAssignableRole = (typeof STAFF_ASSIGNABLE_ROLES)[number];

export class CreateStaffDto {
  @IsEmail({}, { message: 'Имэйл буруу байна' })
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsIn(STAFF_ASSIGNABLE_ROLES, { message: 'Эрх нь EDITOR эсвэл ADMIN байна' })
  role!: StaffAssignableRole;

  // password байвал bcrypt hash, эс бол нууц үггүй (дараа нь админ тохируулна).
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой' })
  @MaxLength(72)
  password?: string;
}

export class UpdateStaffRoleDto {
  @IsIn(STAFF_ASSIGNABLE_ROLES, { message: 'Эрх нь EDITOR эсвэл ADMIN байна' })
  role!: StaffAssignableRole;
}

export class BlockStaffDto {
  @IsBoolean()
  blocked!: boolean;
}
