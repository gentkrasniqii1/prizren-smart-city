-- Enable PostGIS (idempotent on postgis image)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Geography column for radius / spatial queries
ALTER TABLE "Report"
ADD COLUMN IF NOT EXISTS "location" geography(Point, 4326);

-- Backfill from existing lat/lng
UPDATE "Report"
SET "location" = ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography
WHERE "location" IS NULL;

CREATE INDEX IF NOT EXISTS "Report_location_idx"
ON "Report"
USING GIST ("location");
