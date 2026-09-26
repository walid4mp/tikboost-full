-- Payment transaction metadata and receipt storage for manual deposits.
ALTER TABLE "VipSubscription" ADD COLUMN IF NOT EXISTS "planKey" TEXT;
ALTER TABLE "VipSubscription" ADD COLUMN IF NOT EXISTS "notes" TEXT;
