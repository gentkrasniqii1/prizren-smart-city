import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { Priority } from '@prisma/client';

export class RoutePreviewQueryDto {
  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  subcategory?: string;

  @IsOptional()
  @IsEnum(Priority)
  severity?: Priority;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isEmergency?: boolean;
}
