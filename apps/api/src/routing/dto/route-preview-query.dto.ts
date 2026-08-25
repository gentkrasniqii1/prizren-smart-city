import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { Priority } from '@prisma/client';

export class RoutePreviewQueryDto {
  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  subcategory?: string;

  @IsOptional()
  @IsEnum(Priority)
  severity?: Priority;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isEmergency?: boolean;
}
