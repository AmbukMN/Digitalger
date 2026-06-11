import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ⚠️ Staff үүсгэх/эрх солих үед зөвхөн ADMIN сонгоно.
//   - SUPERADMIN сонгох боломжгүй (нэг л superadmin).
//   - EDITOR ашиглахаа больсон (granular permission-аар орлуулсан) — зөвхөн ADMIN.
//   (Role enum-д EDITOR хэвээр байгаа ч staff CRUD-д ОЛГОХГҮЙ.)
export const STAFF_ASSIGNABLE_ROLES = ['ADMIN'] as const;
export type StaffAssignableRole = (typeof STAFF_ASSIGNABLE_ROLES)[number];

// Нэг resource-ийн permission (products|categories|... resource бүрд CRUD эрх).
export class StaffPermissionDto {
  @IsString()
  @MaxLength(50)
  resource!: string;

  @IsBoolean()
  canView!: boolean;

  @IsBoolean()
  canCreate!: boolean;

  @IsBoolean()
  canEdit!: boolean;

  @IsBoolean()
  canDelete!: boolean;
}

export class CreateStaffDto {
  @IsEmail({}, { message: 'Имэйл буруу байна' })
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsIn(STAFF_ASSIGNABLE_ROLES, { message: 'Эрх нь зөвхөн ADMIN байна' })
  role!: StaffAssignableRole;

  // password байвал bcrypt hash, эс бол нууц үггүй (дараа нь админ тохируулна).
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой' })
  @MaxLength(72)
  password?: string;

  // Resource бүрийн эрх (default: хоосон = эрхгүй).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StaffPermissionDto)
  permissions?: StaffPermissionDto[];
}

export class UpdateStaffRoleDto {
  @IsIn(STAFF_ASSIGNABLE_ROLES, { message: 'Эрх нь зөвхөн ADMIN байна' })
  role!: StaffAssignableRole;
}

export class UpdateStaffPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StaffPermissionDto)
  permissions!: StaffPermissionDto[];
}

export class BlockStaffDto {
  @IsBoolean()
  blocked!: boolean;
}
