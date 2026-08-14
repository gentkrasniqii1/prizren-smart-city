-- Auth identity, verification, 2FA, lockout
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "appleId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "facebookId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpSecretEnc" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "User_appleId_key" ON "User"("appleId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_facebookId_key" ON "User"("facebookId");

-- Existing accounts remain usable
UPDATE "User" SET "emailVerified" = true, "emailVerifiedAt" = COALESCE("emailVerifiedAt", "createdAt")
WHERE "emailVerified" = false AND ("passwordHash" IS NOT NULL OR "googleId" IS NOT NULL);

CREATE TABLE IF NOT EXISTS "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "AuthToken_userId_type_idx" ON "AuthToken"("userId", "type");

DO $$ BEGIN
  ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Institutions
CREATE TABLE IF NOT EXISTS "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contact" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Institution_slug_key" ON "Institution"("slug");

ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "slaHours" INTEGER NOT NULL DEFAULT 48;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Department" ADD CONSTRAINT "Department_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "slaHours" INTEGER NOT NULL DEFAULT 48;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "defaultPriority" TEXT NOT NULL DEFAULT 'MEDIUM';

-- Report statuses
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_INFORMATION';
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'DUPLICATE';
