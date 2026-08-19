-- Standardized civic statuses:
--   PENDING     → SUBMITTED
--   IN_REVIEW   → UNDER_REVIEW
--   ACCEPTED    → RECEIVED
-- Existing rows keep their meaning; only the enum labels change.

ALTER TABLE "Report" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "ReportStatus" RENAME VALUE 'PENDING' TO 'SUBMITTED';
ALTER TYPE "ReportStatus" RENAME VALUE 'IN_REVIEW' TO 'UNDER_REVIEW';
ALTER TYPE "ReportStatus" RENAME VALUE 'ACCEPTED' TO 'RECEIVED';

ALTER TABLE "Report" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
