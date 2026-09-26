-- Allow up to two accounts to share one device identity.
-- The application enforces the account/reward limit in a transaction.
DROP INDEX IF EXISTS "User_deviceId_key";

CREATE INDEX IF NOT EXISTS "User_deviceId_idx" ON "User"("deviceId");
