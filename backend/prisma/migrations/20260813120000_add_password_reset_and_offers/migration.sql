-- Safe additive migration: PasswordResetToken + Offer (Promotions)
-- No DROP, no DELETE, no data loss. Idempotent via IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id"         TEXT PRIMARY KEY,
  "userId"     TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash"  TEXT NOT NULL UNIQUE,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "usedAt"     TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

CREATE TABLE IF NOT EXISTS "Offer" (
  "id"            TEXT PRIMARY KEY,
  "title"         TEXT NOT NULL,
  "description"   TEXT,
  "oldPriceCents" INTEGER,
  "newPriceCents" INTEGER NOT NULL,
  "discountPct"   INTEGER,
  "currency"      TEXT NOT NULL DEFAULT 'USD',
  "packageId"     TEXT,
  "targetGender"  TEXT NOT NULL DEFAULT 'ALL',
  "targetCountry" TEXT NOT NULL DEFAULT 'WORLDWIDE',
  "startsAt"      TIMESTAMP(3),
  "endsAt"        TIMESTAMP(3),
  "isActive"      BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder"     INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Offer_isActive_sortOrder_idx" ON "Offer"("isActive", "sortOrder");
