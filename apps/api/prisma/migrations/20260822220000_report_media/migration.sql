-- ReportMedia relation (keep photoUrl/photoAfterUrl). PDF tokens reuse InstitutionAccessToken.

ALTER TYPE "InstitutionAccessPurpose" ADD VALUE 'INSTITUTION_CASE_PDF';

CREATE TYPE "ReportMediaRole" AS ENUM (
  'INITIAL',
  'AFTER',
  'ATTACHMENT'
);

CREATE TYPE "ReportMediaVisibility" AS ENUM (
  'PUBLIC',
  'STAFF'
);

CREATE TABLE "ReportMedia" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "role" "ReportMediaRole" NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "url" TEXT NOT NULL,
  "cloudinaryId" TEXT,
  "mimeType" TEXT,
  "byteSize" INTEGER,
  "visibility" "ReportMediaVisibility" NOT NULL DEFAULT 'PUBLIC',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReportMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportMedia_reportId_role_sortOrder_idx" ON "ReportMedia"("reportId", "role", "sortOrder");

ALTER TABLE "ReportMedia" ADD CONSTRAINT "ReportMedia_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
