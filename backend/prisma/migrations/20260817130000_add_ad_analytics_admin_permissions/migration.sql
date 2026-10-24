ALTER TABLE "User" ADD COLUMN "adminPermissions" JSONB;
CREATE TYPE "AdType" AS ENUM ('BANNER', 'INTERSTITIAL', 'REWARDED', 'NATIVE', 'CUSTOM_BANNER');
CREATE TABLE "AdImpression" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "AdType" NOT NULL,
  "event" TEXT NOT NULL DEFAULT 'VIEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdImpression_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdImpression_userId_type_createdAt_idx" ON "AdImpression"("userId", "type", "createdAt");
CREATE INDEX "AdImpression_type_event_createdAt_idx" ON "AdImpression"("type", "event", "createdAt");
ALTER TABLE "AdImpression" ADD CONSTRAINT "AdImpression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
