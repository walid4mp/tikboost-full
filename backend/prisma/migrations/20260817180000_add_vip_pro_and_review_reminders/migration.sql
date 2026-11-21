ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vipProUntil" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "vipPriority" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "vipBonusPoints" BIGINT NOT NULL DEFAULT 0;
DO $$ BEGIN
  CREATE TYPE "VipSubscriptionStatus" AS ENUM ('PENDING','ACTIVE','EXPIRED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS "VipSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "priceCents" INTEGER NOT NULL DEFAULT 1000,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "VipSubscriptionStatus" NOT NULL DEFAULT 'PENDING',
  "method" TEXT NOT NULL DEFAULT 'manual_transfer',
  "reference" TEXT,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VipSubscription_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VipSubscription_userId_status_expiresAt_idx" ON "VipSubscription"("userId","status","expiresAt");
ALTER TABLE "VipSubscription" ADD CONSTRAINT "VipSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
