import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { WORKFLOW_ACTIONS, type WorkflowAction } from '@prizren/shared-types';

export class WorkflowActionDto {
  @IsIn([...WORKFLOW_ACTIONS])
  action!: WorkflowAction;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
