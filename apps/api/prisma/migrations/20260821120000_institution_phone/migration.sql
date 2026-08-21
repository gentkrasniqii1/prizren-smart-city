-- Public switchboard number, kept separate from Institution.contact (email).
ALTER TABLE "Institution" ADD COLUMN "phone" TEXT;
