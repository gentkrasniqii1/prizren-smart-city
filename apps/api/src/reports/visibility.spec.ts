import { ReportStatus, Role } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  isStaffUser,
  publicStatusHistory,
  viewerCanAccessReport,
  canCommentOnReport,
} from './visibility';

describe('viewerCanAccessReport', () => {
  const owner = { id: 'owner-1', email: 'o@t.local', role: Role.CITIZEN };
  const stranger = { id: 'c2', email: 'c@t.local', role: Role.CITIZEN };
  const staff = { id: 's1', email: 's@t.local', role: Role.DEPARTMENT_STAFF };

  it('allows anyone to see an official public status', () => {
    expect(viewerCanAccessReport({ status: ReportStatus.ASSIGNED, userId: owner.id }, null)).toBe(
      true,
    );
    expect(
      viewerCanAccessReport({ status: ReportStatus.RESOLVED, userId: owner.id }, stranger),
    ).toBe(true);
  });

  it('hides submitted reports from the public and other citizens', () => {
    const report = { status: ReportStatus.SUBMITTED, userId: owner.id };
    expect(viewerCanAccessReport(report, null)).toBe(false);
    expect(viewerCanAccessReport(report, stranger)).toBe(false);
    expect(viewerCanAccessReport(report, owner)).toBe(true);
    expect(viewerCanAccessReport(report, staff)).toBe(true);
  });

  it('hides rejected and duplicate reports from the public', () => {
    expect(viewerCanAccessReport({ status: ReportStatus.REJECTED, userId: owner.id }, null)).toBe(
      false,
    );
    expect(
      viewerCanAccessReport({ status: ReportStatus.DUPLICATE, userId: owner.id }, stranger),
    ).toBe(false);
  });
});

describe('canCommentOnReport', () => {
  const owner = { id: 'owner-1', email: 'o@t.local', role: Role.CITIZEN };
  const stranger = { id: 'c2', email: 'c@t.local', role: Role.CITIZEN };
  const staff = { id: 's1', email: 's@t.local', role: Role.DEPARTMENT_STAFF };

  it('requires a logged-in viewer', () => {
    expect(canCommentOnReport({ status: ReportStatus.ASSIGNED, userId: owner.id }, null)).toBe(
      false,
    );
  });

  it('lets staff and the owner comment while the case is still in review', () => {
    const report = { status: ReportStatus.SUBMITTED, userId: owner.id };
    expect(canCommentOnReport(report, staff)).toBe(true);
    expect(canCommentOnReport(report, owner)).toBe(true);
    expect(canCommentOnReport(report, stranger)).toBe(false);
  });

  it('lets other citizens comment only after the case is official', () => {
    expect(canCommentOnReport({ status: ReportStatus.ASSIGNED, userId: owner.id }, stranger)).toBe(
      true,
    );
  });
});

describe('isStaffUser', () => {
  it('treats only department roles and super admin as staff', () => {
    expect(isStaffUser({ id: '1', email: 'c@t.local', role: Role.CITIZEN })).toBe(false);
    expect(isStaffUser({ id: '1', email: 's@t.local', role: Role.DEPARTMENT_STAFF })).toBe(true);
    expect(isStaffUser(null)).toBe(false);
  });
});

describe('publicStatusHistory', () => {
  it('keeps only official statuses once the case is public', () => {
    const history = [
      { id: 'h1', newStatus: ReportStatus.UNDER_REVIEW },
      { id: 'h2', newStatus: ReportStatus.ASSIGNED },
      { id: 'h3', newStatus: ReportStatus.RECEIVED },
    ];
    expect(publicStatusHistory(history, ReportStatus.RECEIVED).map((row) => row.id)).toEqual([
      'h2',
      'h3',
    ]);
  });

  it('leaves the owner timeline intact while the case is still in review', () => {
    const history = [{ id: 'h1', newStatus: ReportStatus.UNDER_REVIEW }];
    expect(publicStatusHistory(history, ReportStatus.UNDER_REVIEW)).toEqual(history);
  });
});
