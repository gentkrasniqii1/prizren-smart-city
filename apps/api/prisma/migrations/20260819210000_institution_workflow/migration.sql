-- Institution workflow: ACCEPTED status, optional notes on status history,
-- and enqueue already-routed pending reports.

ALTER TYPE "ReportStatus" ADD VALUE 'ACCEPTED';

ALTER TABLE "StatusHistory" ADD COLUMN "note" TEXT;

UPDATE "Report"
SET status = 'ASSIGNED'
WHERE status = 'PENDING'
  AND ("institutionId" IS NOT NULL OR "departmentId" IS NOT NULL);
