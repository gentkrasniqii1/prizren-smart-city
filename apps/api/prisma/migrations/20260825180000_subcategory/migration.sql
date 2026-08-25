-- Phase 2 — first-class Subcategory under Category.
-- Additive only: keeps legacy RoutingRule.subcategory / Report.subcategory strings
-- and backfills Subcategory rows from existing non-empty strings when categoryId is set.

-- CreateTable
CREATE TABLE "Subcategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subcategory_categoryId_idx" ON "Subcategory"("categoryId");
CREATE INDEX "Subcategory_active_idx" ON "Subcategory"("active");
CREATE UNIQUE INDEX "Subcategory_categoryId_name_key" ON "Subcategory"("categoryId", "name");

-- AddForeignKey
ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: RoutingRule
ALTER TABLE "RoutingRule" ADD COLUMN "subcategoryId" TEXT;
CREATE INDEX "RoutingRule_subcategoryId_idx" ON "RoutingRule"("subcategoryId");
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Report
ALTER TABLE "Report" ADD COLUMN "subcategoryId" TEXT;
CREATE INDEX "Report_subcategoryId_idx" ON "Report"("subcategoryId");
ALTER TABLE "Report" ADD CONSTRAINT "Report_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill Subcategory from distinct (categoryId, subcategory) pairs on rules and reports.
-- No invented names: only non-empty strings already stored with a real categoryId.
INSERT INTO "Subcategory" ("id", "name", "categoryId", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, src.name, src."categoryId", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "categoryId", TRIM(subcategory) AS name
  FROM "RoutingRule"
  WHERE "categoryId" IS NOT NULL
    AND subcategory IS NOT NULL
    AND TRIM(subcategory) <> ''
  UNION
  SELECT DISTINCT "categoryId", TRIM(subcategory) AS name
  FROM "Report"
  WHERE "categoryId" IS NOT NULL
    AND subcategory IS NOT NULL
    AND TRIM(subcategory) <> ''
) src
ON CONFLICT ("categoryId", "name") DO NOTHING;

UPDATE "RoutingRule" r
SET "subcategoryId" = s.id
FROM "Subcategory" s
WHERE r."categoryId" = s."categoryId"
  AND r.subcategory IS NOT NULL
  AND TRIM(r.subcategory) = s.name
  AND r."subcategoryId" IS NULL;

UPDATE "Report" r
SET "subcategoryId" = s.id
FROM "Subcategory" s
WHERE r."categoryId" = s."categoryId"
  AND r.subcategory IS NOT NULL
  AND TRIM(r.subcategory) = s.name
  AND r."subcategoryId" IS NULL;
