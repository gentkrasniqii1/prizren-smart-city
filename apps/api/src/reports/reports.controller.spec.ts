import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { ReportsController } from './reports.controller';

const STAFF_ROLES = [Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN];

describe('ReportsController civic roles', () => {
  it('restricts moderate and the institution queue to staff', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ReportsController.prototype.moderate)).toEqual(
      STAFF_ROLES,
    );
    expect(Reflect.getMetadata(ROLES_KEY, ReportsController.prototype.listQueue)).toEqual(
      STAFF_ROLES,
    );
  });

  it('RolesGuard forbids a citizen from approving or opening the queue', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(STAFF_ROLES),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    const citizenCtx = {
      getHandler: () => ReportsController.prototype.moderate,
      getClass: () => ReportsController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'c1', email: 'c@t.local', role: Role.CITIZEN },
        }),
      }),
    };

    expect(() => guard.canActivate(citizenCtx as never)).toThrow(ForbiddenException);

    const queueCtx = {
      ...citizenCtx,
      getHandler: () => ReportsController.prototype.listQueue,
    };
    expect(() => guard.canActivate(queueCtx as never)).toThrow(ForbiddenException);

    const staffCtx = {
      ...citizenCtx,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 's1', email: 's@t.local', role: Role.DEPARTMENT_STAFF },
        }),
      }),
    };
    expect(guard.canActivate(staffCtx as never)).toBe(true);
  });
});
