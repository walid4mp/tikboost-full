-- Secure manual password reset workflow: encrypted OTP + attempts/status/IP metadata.
CREATE TYPE "PasswordResetStatus" AS ENUM ('PENDING', 'USED', 'LOCKED', 'EXPIRED');

ALTER TABLE "PasswordResetToken"
  ADD COLUMN "encryptedCode" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "status" "PasswordResetStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "requestIp" TEXT,
  ADD COLUMN "revealedAt" TIMESTAMP(3);

CREATE INDEX "PasswordResetToken_userId_status_createdAt_idx"
  ON "PasswordResetToken"("userId", "status", "createdAt");

CREATE INDEX "PasswordResetToken_requestIp_createdAt_idx"
  ON "PasswordResetToken"("requestIp", "createdAt");

UPDATE "PasswordResetToken"
SET "status" = 'EXPIRED'
WHERE "status" = 'PENDING' AND "encryptedCode" = '';
