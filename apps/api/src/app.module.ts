import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { ReportsModule } from './reports/reports.module';
import { CategoriesModule } from './categories/categories.module';
import { SubcategoriesModule } from './subcategories/subcategories.module';
import { ZonesModule } from './zones/zones.module';
import { UploadsModule } from './uploads/uploads.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { DepartmentsModule } from './departments/departments.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TransparencyModule } from './transparency/transparency.module';
import { AuditModule } from './audit/audit.module';
import { RoutingModule } from './routing/routing.module';
import { RealtimeModule } from './realtime/realtime.module';
import { OutboundEmailModule } from './outbound-email/outbound-email.module';
import { InstitutionAccessModule } from './institution-access/institution-access.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60_000,
          limit: 100,
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AdminModule,
    ReportsModule,
    CategoriesModule,
    SubcategoriesModule,
    ZonesModule,
    UploadsModule,
    AnalyticsModule,
    DepartmentsModule,
    InstitutionsModule,
    NotificationsModule,
    TransparencyModule,
    AuditModule,
    RoutingModule,
    RealtimeModule,
    OutboundEmailModule,
    InstitutionAccessModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
