-- Phase 1 — Domain Foundation
-- Adds: Institution integration fields, Report identity/routing fields,
-- RoutingRule, SlaPolicy, SequenceCounter models, and richer AuditLog fields.
-- Existing "Report_location_idx" (PostGIS GIST index, created by an earlier
-- hand-written migration and invisible to Prisma's Unsupported() type) and the
-- unrelated Category.defaultPriority column are intentionally left untouched.

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('EMAIL', 'REST_API', 'WEBHOOK', 'SFTP', 'MANUAL', 'MOCK');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('NOT_CONFIGURED', 'MOCK', 'TEST', 'ACTIVE', 'DISABLED');

-- AlterTable: AuditLog — additive, defaulted/nullable columns only
ALTER TABLE "AuditLog"
  ADD COLUMN "actorType" TEXT NOT NULL DEFAULT 'USER',
  ADD COLUMN "oldValue" JSONB,
  ADD COLUMN "newValue" JSONB,
  ADD COLUMN "userAgent" TEXT;

-- AlterTable: Institution — organization integration metadata
ALTER TABLE "Institution"
  ADD COLUMN "integrationType" "IntegrationType" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "integrationStatus" "IntegrationStatus" NOT NULL DEFAULT 'NOT_CONFIGURED';

-- AlterTable: Report — additive columns. "publicId" is added nullable here and
-- backfilled below before being made required, to avoid data loss on the 8
-- existing dev rows.
ALTER TABLE "Report"
  ADD COLUMN "publicId" TEXT,
  ADD COLUMN "institutionId" TEXT,
  ADD COLUMN "subcategory" TEXT,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'WEB',
  ADD COLUMN "anonymous" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "language" TEXT NOT NULL DEFAULT 'sq',
  ADD COLUMN "isDuplicate" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: RoutingRule
CREATE TABLE "RoutingRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "subcategory" TEXT,
    "severity" "Priority",
    "zone" TEXT,
    "isEmergency" BOOLEAN,
    "departmentId" TEXT,
    "institutionId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SlaPolicy
CREATE TABLE "SlaPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "resolutionTime" INTEGER NOT NULL,
    "departmentId" TEXT,
    "categoryId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SequenceCounter
CREATE TABLE "SequenceCounter" (
    "id" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SequenceCounter_pkey" PRIMARY KEY ("id")
);

-- Data backfill: assign a per-year sequential publicId to any pre-existing
-- reports (ordered by createdAt) before the column is required/unique.
WITH ranked AS (
  SELECT id,
         EXTRACT(YEAR FROM "createdAt")::int AS yr,
         ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM "createdAt") ORDER BY "createdAt", id) AS rn
  FROM "Report"
)
UPDATE "Report" r
SET "publicId" = 'PRZ-' || ranked.yr || '-' || LPAD(ranked.rn::text, 6, '0')
FROM ranked
WHERE ranked.id = r.id;

-- Seed per-year counters so newly created reports continue the sequence
-- (rather than restarting at 1 and colliding with backfilled publicIds).
INSERT INTO "SequenceCounter" ("id", "value")
SELECT 'report-' || EXTRACT(YEAR FROM "createdAt")::int, COUNT(*)::int
FROM "Report"
GROUP BY EXTRACT(YEAR FROM "createdAt")
ON CONFLICT ("id") DO UPDATE SET "value" = EXCLUDED."value";

-- Now that every row has a value, enforce NOT NULL + uniqueness.
ALTER TABLE "Report" ALTER COLUMN "publicId" SET NOT NULL;
CREATE UNIQUE INDEX "Report_publicId_key" ON "Report"("publicId");

-- CreateIndex: RoutingRule
CREATE INDEX "RoutingRule_active_priority_idx" ON "RoutingRule"("active", "priority");
CREATE INDEX "RoutingRule_categoryId_idx" ON "RoutingRule"("categoryId");
CREATE INDEX "RoutingRule_departmentId_idx" ON "RoutingRule"("departmentId");
CREATE INDEX "RoutingRule_institutionId_idx" ON "RoutingRule"("institutionId");

-- CreateIndex: SlaPolicy
CREATE INDEX "SlaPolicy_active_priority_idx" ON "SlaPolicy"("active", "priority");
CREATE INDEX "SlaPolicy_departmentId_idx" ON "SlaPolicy"("departmentId");
CREATE INDEX "SlaPolicy_categoryId_idx" ON "SlaPolicy"("categoryId");

-- CreateIndex: AuditLog
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex: Report
CREATE INDEX "Report_status_idx" ON "Report"("status");
CREATE INDEX "Report_categoryId_idx" ON "Report"("categoryId");
CREATE INDEX "Report_departmentId_idx" ON "Report"("departmentId");
CREATE INDEX "Report_institutionId_idx" ON "Report"("institutionId");
CREATE INDEX "Report_userId_idx" ON "Report"("userId");
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
CREATE INDEX "Report_dueAt_idx" ON "Report"("dueAt");

-- AddForeignKey
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
