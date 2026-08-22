-- Hashed, expiring, revocable institutional access links. Additive; seed unchanged.

CREATE TYPE "InstitutionAccessPurpose" AS ENUM (
  'INSTITUTION_NEW_CASE'
);

CREATE TABLE "InstitutionAccessToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "purpose" "InstitutionAccessPurpose" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InstitutionAccessToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstitutionAccessToken_tokenHash_key" ON "InstitutionAccessToken"("tokenHash");
CREATE INDEX "InstitutionAccessToken_reportId_purpose_idx" ON "InstitutionAccessToken"("reportId", "purpose");
CREATE INDEX "InstitutionAccessToken_institutionId_idx" ON "InstitutionAccessToken"("institutionId");
CREATE INDEX "InstitutionAccessToken_expiresAt_idx" ON "InstitutionAccessToken"("expiresAt");

ALTER TABLE "InstitutionAccessToken" ADD CONSTRAINT "InstitutionAccessToken_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstitutionAccessToken" ADD CONSTRAINT "InstitutionAccessToken_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OutboundEmail" ADD COLUMN "accessTokenId" TEXT;
ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_accessTokenId_fkey" FOREIGN KEY ("accessTokenId") REFERENCES "InstitutionAccessToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
