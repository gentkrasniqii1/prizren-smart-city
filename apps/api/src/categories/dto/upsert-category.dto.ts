import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Priority } from '@prisma/client';

export class UpsertCategoryDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsUUID()
  departmentId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8760)
  slaHours?: number;

  @IsOptional()
  @IsEnum(Priority)
  defaultPriority?: Priority;
}
