import { IsEnum, IsOptional, IsArray, IsUUID } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserRoleDto {
  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  departmentIds?: string[];
}
