-- Phase 3 — Zone model + RoutingRule.zoneId / Report.zoneId.
-- Additive: keeps legacy RoutingRule.zone string; backfills Zone only from
-- existing non-empty zone strings (no invented municipal names).

CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Zone_name_key" ON "Zone"("name");
CREATE INDEX "Zone_active_idx" ON "Zone"("active");

ALTER TABLE "RoutingRule" ADD COLUMN "zoneId" TEXT;
CREATE INDEX "RoutingRule_zoneId_idx" ON "RoutingRule"("zoneId");
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report" ADD COLUMN "zoneId" TEXT;
CREATE INDEX "Report_zoneId_idx" ON "Report"("zoneId");
ALTER TABLE "Report" ADD CONSTRAINT "Report_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Promote distinct existing free-text zone labels (if any).
INSERT INTO "Zone" ("id", "name", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, src.name, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT TRIM(zone) AS name
  FROM "RoutingRule"
  WHERE zone IS NOT NULL AND TRIM(zone) <> ''
) src
ON CONFLICT ("name") DO NOTHING;

UPDATE "RoutingRule" r
SET "zoneId" = z.id
FROM "Zone" z
WHERE r.zone IS NOT NULL
  AND TRIM(r.zone) = z.name
  AND r."zoneId" IS NULL;
