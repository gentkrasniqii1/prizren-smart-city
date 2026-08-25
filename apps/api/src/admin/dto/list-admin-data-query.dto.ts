import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { REPORT_STATUSES } from '@prizren/shared-types';

const SLA_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const SLA_SCOPES = ['global', 'department', 'category', 'subcategory'] as const;

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

  /** SLA policies filter. */
  @IsOptional()
  @IsIn([...SLA_PRIORITIES])
  priority?: (typeof SLA_PRIORITIES)[number];

  /** SLA policies filter. */
  @IsOptional()
  @IsIn([...SLA_SCOPES])
  scope?: (typeof SLA_SCOPES)[number];

  /** SLA policies / generic active filter (true|false). */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  active?: boolean;
}
