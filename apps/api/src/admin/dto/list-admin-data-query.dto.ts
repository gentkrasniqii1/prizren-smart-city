import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { REPORT_STATUSES } from '@prizren/shared-types';

export class ListAdminDataQueryDto {
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
  @IsString()
  q?: string;

  /** Reports only — validated against the real ReportStatus enum. */
  @IsOptional()
  @IsIn([...REPORT_STATUSES])
  status?: (typeof REPORT_STATUSES)[number];
}
