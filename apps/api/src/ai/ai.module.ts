import { Module } from '@nestjs/common';
import { AiClassificationService } from './ai-classification.service';

@Module({
  providers: [AiClassificationService],
  exports: [AiClassificationService],
})
export class AiModule {}
