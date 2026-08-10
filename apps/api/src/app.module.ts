import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { ReportsModule } from './reports/reports.module';
import { CategoriesModule } from './categories/categories.module';
import { UploadsModule } from './uploads/uploads.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { DepartmentsModule } from './departments/departments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TransparencyModule } from './transparency/transparency.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    AdminModule,
    ReportsModule,
    CategoriesModule,
    UploadsModule,
    AnalyticsModule,
    DepartmentsModule,
    NotificationsModule,
    TransparencyModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
