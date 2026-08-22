-- Institutional outbound mail ledger. Additive; seed contacts unchanged.

CREATE TYPE "OutboundEmailStatus" AS ENUM (
  'NOT_CONFIGURED',
  'QUEUED',
  'SENDING',
  'SENT',
  'ACCEPTED',
  'FAILED',
  'RETRYING',
  'PERMANENTLY_FAILED'
);

CREATE TYPE "OutboundEmailPurpose" AS ENUM (
  'INSTITUTION_NEW_CASE'
);

CREATE TABLE "OutboundEmail" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "institutionId" TEXT,
  "purpose" "OutboundEmailPurpose" NOT NULL,
  "recipient" TEXT,
  "subject" TEXT NOT NULL,
  "provider" TEXT,
  "providerMessageId" TEXT,
  "status" "OutboundEmailStatus" NOT NULL,
  "skipReason" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lastError" TEXT,
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "nextRetryAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OutboundEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutboundEmail_reportId_purpose_key" ON "OutboundEmail"("reportId", "purpose");
CREATE INDEX "OutboundEmail_status_idx" ON "OutboundEmail"("status");
CREATE INDEX "OutboundEmail_institutionId_idx" ON "OutboundEmail"("institutionId");
CREATE INDEX "OutboundEmail_nextRetryAt_idx" ON "OutboundEmail"("nextRetryAt");

ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
