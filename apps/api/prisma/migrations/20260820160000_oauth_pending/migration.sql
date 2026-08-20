-- CreateTable
CREATE TABLE "OauthPending" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OauthPending_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OauthPending_tokenHash_key" ON "OauthPending"("tokenHash");

-- CreateIndex
CREATE INDEX "OauthPending_provider_providerId_idx" ON "OauthPending"("provider", "providerId");
