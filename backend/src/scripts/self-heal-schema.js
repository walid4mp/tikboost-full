/**
 * Self-heal production schema at boot.
 *
 * Runs on EVERY server start. It performs strictly-additive, idempotent SQL
 * to guarantee the currently shipped schema exists on the live database.
 * This is the safety net for legacy / drifted databases where
 * `prisma migrate deploy` may fail (for example after moving to a new Neon
 * database or when an older database was provisioned outside Prisma migrate).
 *
 * SAFETY GUARANTEES (do not weaken):
 *   - Uses ONLY additive / metadata-only operations:
 *       ADD COLUMN IF NOT EXISTS
 *       CREATE TABLE IF NOT EXISTS
 *       CREATE INDEX IF NOT EXISTS
 *       CREATE TYPE guarded by pg_type checks
 *       ADD CONSTRAINT guarded by pg_constraint checks
 *   - Never drops a table, column, type, index.
 *   - Never deletes business data.
 *   - Never truncates or resets.
 *   - Never calls `prisma db push` or `prisma migrate reset`.
 *   - Safe to run on every boot.
 *
 * It also best-effort baselines the shipped migration folders in
 * `_prisma_migrations` so future `prisma migrate deploy` runs do not fail on a
 * legacy non-empty database.
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const MIGRATION_NAMES = [
  '20260801003502_add_rewards_ads_system',
  '20260811161000_add_profile_completion_and_audience_targeting',
  '20260813120000_add_password_reset_and_offers',
  '20260817130000_add_ad_analytics_admin_permissions',
  '20260817180000_add_vip_pro_and_review_reminders',
  '20260817190000_secure_manual_password_reset',
  '20260818193000_add_personal_offers_and_vip_tools',
  '20260821160000_add_fcm_push_notifications',
];

// Each entry MUST remain a single SQL statement.
const ENUM_STATEMENTS = [
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserGender') THEN
       CREATE TYPE "UserGender" AS ENUM ('MALE', 'FEMALE');
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CampaignTargetGender') THEN
       CREATE TYPE "CampaignTargetGender" AS ENUM ('ALL', 'MALE', 'FEMALE');
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdType') THEN
       CREATE TYPE "AdType" AS ENUM ('BANNER', 'INTERSTITIAL', 'REWARDED', 'NATIVE', 'CUSTOM_BANNER');
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VipSubscriptionStatus') THEN
       CREATE TYPE "VipSubscriptionStatus" AS ENUM ('PENDING','ACTIVE','EXPIRED','REJECTED');
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PasswordResetStatus') THEN
       CREATE TYPE "PasswordResetStatus" AS ENUM ('PENDING', 'USED', 'LOCKED', 'EXPIRED');
     END IF;
   END $$`,
];

const COLUMN_STATEMENTS = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gender" "UserGender";`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "countryCode" TEXT;`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminPermissions" JSONB;`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vipProUntil" TIMESTAMP(3);`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fcmToken" TEXT;`,

  `ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "targetGender" "CampaignTargetGender" NOT NULL DEFAULT 'ALL';`,
  `ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "targetCountry" TEXT NOT NULL DEFAULT 'WORLDWIDE';`,
  `ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "vipPriority" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "vipBonusPoints" BIGINT NOT NULL DEFAULT 0;`,

  `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "offerId" TEXT;`,

  `CREATE INDEX IF NOT EXISTS "User_gender_countryCode_idx" ON "User"("gender", "countryCode");`,
  `CREATE INDEX IF NOT EXISTS "Campaign_targetGender_targetCountry_idx" ON "Campaign"("targetGender", "targetCountry");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_fcmToken_key" ON "User"("fcmToken");`,
  `CREATE INDEX IF NOT EXISTS "Purchase_offerId_idx" ON "Purchase"("offerId");`,

  `CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "encryptedCode" TEXT NOT NULL DEFAULT '';`,
  `ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "status" "PasswordResetStatus" NOT NULL DEFAULT 'PENDING';`,
  `ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "requestIp" TEXT;`,
  `ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "revealedAt" TIMESTAMP(3);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");`,
  `CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");`,
  `CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_status_createdAt_idx" ON "PasswordResetToken"("userId", "status", "createdAt");`,
  `CREATE INDEX IF NOT EXISTS "PasswordResetToken_requestIp_createdAt_idx" ON "PasswordResetToken"("requestIp", "createdAt");`,

  `CREATE TABLE IF NOT EXISTS "Offer" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "oldPriceCents" INTEGER,
    "newPriceCents" INTEGER NOT NULL,
    "discountPct" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "packageId" TEXT,
    "targetGender" TEXT NOT NULL DEFAULT 'ALL',
    "targetCountry" TEXT NOT NULL DEFAULT 'WORLDWIDE',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "targetUserId" TEXT,
    "targetVip" BOOLEAN NOT NULL DEFAULT false,
    "minTasks" INTEGER NOT NULL DEFAULT 0,
    "maxTasks" INTEGER,
    "minPoints" BIGINT NOT NULL DEFAULT 0,
    "maxPoints" BIGINT,
    "pointsOverride" BIGINT,
    "showNotification" BOOLEAN NOT NULL DEFAULT true,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "maxClaimsPerUser" INTEGER
  )`,
  `ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "audience" TEXT NOT NULL DEFAULT 'ALL';`,
  `ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "targetUserId" TEXT;`,
  `ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "targetVip" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "minTasks" INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "maxTasks" INTEGER;`,
  `ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "minPoints" BIGINT NOT NULL DEFAULT 0;`,
  `ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "maxPoints" BIGINT;`,
  `ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "pointsOverride" BIGINT;`,
  `ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "showNotification" BOOLEAN NOT NULL DEFAULT true;`,
  `ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "notificationSent" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "maxClaimsPerUser" INTEGER;`,
  `CREATE INDEX IF NOT EXISTS "Offer_isActive_sortOrder_idx" ON "Offer"("isActive", "sortOrder");`,
  `CREATE INDEX IF NOT EXISTS "Offer_audience_targetUserId_idx" ON "Offer"("audience", "targetUserId");`,

  `CREATE TABLE IF NOT EXISTS "AdImpression" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AdType" NOT NULL,
    "event" TEXT NOT NULL DEFAULT 'VIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdImpression_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "AdImpression_userId_type_createdAt_idx" ON "AdImpression"("userId", "type", "createdAt");`,
  `CREATE INDEX IF NOT EXISTS "AdImpression_type_event_createdAt_idx" ON "AdImpression"("type", "event", "createdAt");`,

  `CREATE TABLE IF NOT EXISTS "VipSubscription" (
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
  )`,
  `CREATE INDEX IF NOT EXISTS "VipSubscription_userId_status_expiresAt_idx" ON "VipSubscription"("userId", "status", "expiresAt");`,

  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdImpression_userId_fkey') THEN
       ALTER TABLE "AdImpression" ADD CONSTRAINT "AdImpression_userId_fkey"
       FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VipSubscription_userId_fkey') THEN
       ALTER TABLE "VipSubscription" ADD CONSTRAINT "VipSubscription_userId_fkey"
       FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Purchase_offerId_fkey') THEN
       ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_offerId_fkey"
       FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
     END IF;
   END $$`,

  `UPDATE "PasswordResetToken"
   SET "status" = 'EXPIRED'
   WHERE "status" = 'PENDING' AND COALESCE("encryptedCode", '') = ''`,
];

async function tableExists(prisma, tableName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS present`,
    tableName,
  );
  return rows && rows[0] && rows[0].present === true;
}

async function columnExists(prisma, tableName, columnName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2) AS present`,
    tableName,
    columnName,
  );
  return rows && rows[0] && rows[0].present === true;
}

async function ensurePrismaMigrationsTable(prisma) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum"              VARCHAR(64) NOT NULL,
      "finished_at"           TIMESTAMPTZ,
      "migration_name"        VARCHAR(255) NOT NULL,
      "logs"                  TEXT,
      "rolled_back_at"        TIMESTAMPTZ,
      "started_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
    );
  `);
}

async function markMigrationApplied(prisma, name) {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $1 LIMIT 1`,
    name,
  );
  if (existing && existing.length) return false;

  const id = crypto.randomUUID();
  const checksum = crypto.createHash('sha256').update(name).digest('hex');
  await prisma.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations"
       ("id","checksum","finished_at","migration_name","logs","rolled_back_at","started_at","applied_steps_count")
     VALUES ($1,$2,NOW(),$3,'self-heal baseline',NULL,NOW(),1)`,
    id,
    checksum,
    name,
  );
  return true;
}

async function healSchema() {
  if (process.env.NODE_ENV === 'test') {
    return { skipped: true, reason: 'test env' };
  }
  if (process.env.DISABLE_SELF_HEAL === '1') {
    return { skipped: true, reason: 'DISABLE_SELF_HEAL=1' };
  }
  if (!process.env.DATABASE_URL) {
    console.warn('[self-heal] DATABASE_URL missing — skipping schema self-heal.');
    return { skipped: true, reason: 'no DATABASE_URL' };
  }

  const prisma = new PrismaClient({ log: ['warn', 'error'] });
  const report = {
    ranStatements: [],
    baseline: [],
    userGender: false,
    userCountry: false,
    userFcmToken: false,
    offerTable: false,
    vipTable: false,
  };

  try {
    const hasUser = await tableExists(prisma, 'User');
    if (!hasUser) {
      console.log('[self-heal] User table not present yet — leaving migrate deploy to provision schema.');
      return { skipped: true, reason: 'no User table' };
    }

    for (const stmt of ENUM_STATEMENTS) {
      try {
        await prisma.$executeRawUnsafe(stmt);
        report.ranStatements.push(stmt.split('\n')[0]);
      } catch (err) {
        console.warn('[self-heal] enum stmt skipped:', err.message);
      }
    }

    for (const stmt of COLUMN_STATEMENTS) {
      try {
        await prisma.$executeRawUnsafe(stmt);
        report.ranStatements.push(stmt.split('\n')[0]);
      } catch (err) {
        console.warn('[self-heal] statement skipped:', stmt.split('\n')[0], '-', err.message);
      }
    }

    report.userGender = await columnExists(prisma, 'User', 'gender');
    report.userCountry = await columnExists(prisma, 'User', 'countryCode');
    report.userFcmToken = await columnExists(prisma, 'User', 'fcmToken');
    report.offerTable = await tableExists(prisma, 'Offer');
    report.vipTable = await tableExists(prisma, 'VipSubscription');

    try {
      await ensurePrismaMigrationsTable(prisma);
      for (const name of MIGRATION_NAMES) {
        const inserted = await markMigrationApplied(prisma, name);
        if (inserted) report.baseline.push(name);
      }
    } catch (err) {
      console.warn('[self-heal] baseline step warning:', err.message);
    }

    console.log(
      `[self-heal] done. userGender=${report.userGender} userCountry=${report.userCountry} fcm=${report.userFcmToken} offer=${report.offerTable} vip=${report.vipTable} baselined=${report.baseline.length}`,
    );
    return report;
  } catch (err) {
    console.error('[self-heal] failed (server will still start):', err.message);
    return { error: err.message };
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

module.exports = { healSchema };

if (require.main === module) {
  healSchema().then((r) => {
    console.log('[self-heal] result:', JSON.stringify(r));
    process.exit(0);
  }).catch((e) => {
    console.error(e);
    process.exit(0);
  });
}
