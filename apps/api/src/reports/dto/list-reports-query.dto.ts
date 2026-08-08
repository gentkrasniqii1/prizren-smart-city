import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ReportStatus } from '@prisma/client';

export class ListReportsQueryDto {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  /** Format: minLng,minLat,maxLng,maxLat */
  @IsOptional()
  @IsString()
  bbox?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(String(value)) : undefined))
  from?: Date;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(String(value)) : undefined))
  to?: Date;
}
