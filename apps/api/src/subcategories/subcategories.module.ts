import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { SubcategoriesController } from './subcategories.controller';
import { SubcategoriesService } from './subcategories.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [SubcategoriesController],
  providers: [SubcategoriesService],
})
export class SubcategoriesModule {}
