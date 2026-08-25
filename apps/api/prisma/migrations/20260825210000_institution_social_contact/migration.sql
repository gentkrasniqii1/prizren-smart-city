-- Additive nullable social/messaging contact for institutions without a public email.
-- Informational only — never used by automated outbound-mail sending.

ALTER TABLE "Institution" ADD COLUMN "socialContact" TEXT;
