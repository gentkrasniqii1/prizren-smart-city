import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Priority } from '@prisma/client';

export class UpdateReportPriorityDto {
  @IsEnum(Priority)
  priority!: Priority;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class EscalateReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AddReportNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  note!: string;
}
