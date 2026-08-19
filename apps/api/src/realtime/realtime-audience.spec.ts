import { describe, expect, it } from 'vitest';
import type { RealtimeEvent } from '@prizren/shared-types';
import { realtimeEventVisibleTo, type RealtimeAudience } from './realtime-audience';

const citizen: RealtimeAudience = {
  userId: 'c1',
  role: 'CITIZEN',
  departmentIds: [],
  institutionIds: [],
};

const staff: RealtimeAudience = {
  userId: 's1',
  role: 'DEPARTMENT_STAFF',
  departmentIds: ['dept-waste'],
  institutionIds: ['inst-eco'],
};

const admin: RealtimeAudience = {
  userId: 'a1',
  role: 'SUPER_ADMIN',
  departmentIds: [],
  institutionIds: [],
};

function created(partial: Partial<RealtimeEvent> = {}): RealtimeEvent {
  return {
    type: 'report.created',
    at: '2026-08-19T00:00:00.000Z',
    reportId: 'r1',
    ownerUserId: 'c1',
    departmentId: 'dept-waste',
    institutionId: 'inst-eco',
    ...partial,
  };
}

describe('realtimeEventVisibleTo', () => {
  it('shows a citizen only their own reports', () => {
    expect(realtimeEventVisibleTo(citizen, created())).toBe(true);
    expect(realtimeEventVisibleTo(citizen, created({ ownerUserId: 'other' }))).toBe(false);
  });

  it('shows staff reports in their department or institution', () => {
    expect(realtimeEventVisibleTo(staff, created({ ownerUserId: 'other' }))).toBe(true);
    expect(
      realtimeEventVisibleTo(
        staff,
        created({ ownerUserId: 'other', departmentId: 'other-dept', institutionId: 'inst-eco' }),
      ),
    ).toBe(true);
    expect(
      realtimeEventVisibleTo(
        staff,
        created({ ownerUserId: 'other', departmentId: 'x', institutionId: 'y' }),
      ),
    ).toBe(false);
  });

  it('shows every report event to super admins', () => {
    expect(
      realtimeEventVisibleTo(
        admin,
        created({ ownerUserId: 'other', departmentId: null, institutionId: null }),
      ),
    ).toBe(true);
  });

  it('delivers notification events only to the recipient', () => {
    const notif: RealtimeEvent = {
      type: 'notification.created',
      at: '2026-08-19T00:00:00.000Z',
      reportId: 'r1',
      notificationUserId: 's1',
    };
    expect(realtimeEventVisibleTo(staff, notif)).toBe(true);
    expect(realtimeEventVisibleTo(admin, notif)).toBe(false);
    expect(realtimeEventVisibleTo(citizen, notif)).toBe(false);
  });
});
