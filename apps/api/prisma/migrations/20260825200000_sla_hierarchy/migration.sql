-- Phase 4 — SLA hierarchy (subcategory scope) + report SLA snapshot fields.
-- Additive / nullable: no invented historical assignments or deadlines.

ALTER TABLE "SlaPolicy" ADD COLUMN "subcategoryId" TEXT;
CREATE INDEX "SlaPolicy_subcategoryId_idx" ON "SlaPolicy"("subcategoryId");
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report" ADD COLUMN "slaPolicyId" TEXT;
ALTER TABLE "Report" ADD COLUMN "responseDueAt" TIMESTAMP(3);
ALTER TABLE "Report" ADD COLUMN "resolutionDueAt" TIMESTAMP(3);

CREATE INDEX "Report_slaPolicyId_idx" ON "Report"("slaPolicyId");
CREATE INDEX "Report_responseDueAt_idx" ON "Report"("responseDueAt");
CREATE INDEX "Report_resolutionDueAt_idx" ON "Report"("resolutionDueAt");

ALTER TABLE "Report" ADD CONSTRAINT "Report_slaPolicyId_fkey" FOREIGN KEY ("slaPolicyId") REFERENCES "SlaPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
