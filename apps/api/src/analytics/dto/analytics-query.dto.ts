import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;

  /** Service-only. Not accepted from HTTP (no validator = stripped by whitelist). */
  publicOnly?: boolean;
}
