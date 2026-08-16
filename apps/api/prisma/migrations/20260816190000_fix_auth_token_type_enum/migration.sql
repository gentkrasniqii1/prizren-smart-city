-- Corrects DB drift: the previous migration created AuthToken."type" as TEXT,
-- but schema.prisma declares it as the AuthTokenType enum. Existing values
-- (EMAIL_VERIFY / PASSWORD_RESET / TWO_FACTOR) are valid enum members, so
-- the cast is safe.
DO $$ BEGIN
  CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET', 'TWO_FACTOR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "AuthToken"
  ALTER COLUMN "type" TYPE "AuthTokenType" USING "type"::"AuthTokenType";
