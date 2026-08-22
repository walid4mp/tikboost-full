/**
 * Self-heal production schema at boot.
 *
 * Runs on EVERY server start. It performs strictly-additive, idempotent SQL
 * to guarantee the Phase-1 profile-completion / audience-targeting columns
 * exist on the live database. This is the safety net that saves us when
 * `prisma migrate deploy` never ran on production (e.g. legacy DB that was
 * originally provisioned with `prisma db push`, or a Render deploy where
 * predeploy did not execute).
 *
 * SAFETY GUARANTEES (do not weaken):
 *   - Uses ONLY: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
 *     CREATE TYPE ... IF NOT EXISTS (via DO $$ pg_type check).
 *   - Never drops a table, column, type, index.
 *   - Never deletes or updates a row.
 *   - Never truncates or resets.
 *   - Never calls `prisma db push` or `prisma migrate reset`.
 *   - No-ops if the columns already exist. Safe to run on every boot.
 *
 * Also registers the migration folder(s) as "applied" in _prisma_migrations
 * when Prisma has never seen them, so future `prisma migrate deploy` runs
 * behave normally without P3005.
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const PHASE1_NAME = '20260811161000_add_profile_completion_and_audience_targeting';
const REWARDS_NAME = '20260801003502_add_rewards_ads_system';
const RESET_OFFERS_NAME = '20260813120000_add_password_reset_and_offers';

// Each element MUST be a SINGLE SQL statement — $executeRawUnsafe does not
// accept multiple statements in one call.
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
];

// We run the column adds as separate statements so a failure on one does not
// abort the transaction for the others. Each is fully idempotent.
const COLUMN_STATEMENTS = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gender" "UserGender";`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "countryCode" TEXT;`,
  `ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "targetGender" "CampaignTargetGender" NOT NULL DEFAULT 'ALL';`,
  `ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "targetCountry" TEXT NOT NULL DEFAULT 'WORLDWIDE';`,
  `CREATE INDEX IF NOT EXISTS "User_gender_countryCode_idx" ON "User"("gender", "countryCode");`,
  `CREATE INDEX IF NOT EXISTS "Campaign_targetGender_targetCountry_idx" ON "Campaign"("targetGender", "targetCountry");`,
  `CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash")`,
  `CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId")`,
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "Offer_isActive_sortOrder_idx" ON "Offer"("isActive", "sortOrder")`,
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
  // Prisma normally creates this itself. If it is missing (legacy `db push`
  // origin), create it with the exact schema Prisma expects, so subsequent
  // `prisma migrate deploy` calls behave normally.
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
  // Only insert if not already recorded — never update, never delete.
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
  // Skip entirely in test env — the CI has migrate deploy for that.
  if (process.env.NODE_ENV === 'test') {
    return { skipped: true, reason: 'test env' };
  }
  // If the caller opts out explicitly.
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
  };

  try {
    // Only run if the User table already exists. If it does not, Prisma
    // migrate deploy will provision the whole schema itself — do nothing.
    const hasUser = await tableExists(prisma, 'User');
    if (!hasUser) {
      console.log('[self-heal] User table not present yet — leaving migrate deploy to provision schema.');
      return { skipped: true, reason: 'no User table' };
    }

    // Ensure enum types + additive columns + indexes exist.
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
        // ADD COLUMN IF NOT EXISTS may still fail if the enum type creation
        // above hit a race; log but do not throw — next boot will succeed.
        console.warn('[self-heal] statement skipped:', stmt.split('\n')[0], '-', err.message);
      }
    }

    report.userGender = await columnExists(prisma, 'User', 'gender');
    report.userCountry = await columnExists(prisma, 'User', 'countryCode');

    // Best-effort baseline: record already-shipped migrations as applied so
    // future `prisma migrate deploy` calls do not error with P3005.
    try {
      await ensurePrismaMigrationsTable(prisma);
      for (const name of [REWARDS_NAME, PHASE1_NAME, RESET_OFFERS_NAME]) {
        const inserted = await markMigrationApplied(prisma, name);
        if (inserted) report.baseline.push(name);
      }
    } catch (err) {
      console.warn('[self-heal] baseline step warning:', err.message);
    }

    console.log(
      `[self-heal] done. userGender=${report.userGender} userCountry=${report.userCountry} baselined=${report.baseline.length}`,
    );
    return report;
  } catch (err) {
    // Never let self-heal crash the server. Log and continue — the app will
    // still surface the original error on the failing request.
    console.error('[self-heal] failed (server will still start):', err.message);
    return { error: err.message };
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

module.exports = { healSchema };

// Also runnable directly: `node src/scripts/self-heal-schema.js`
if (require.main === module) {
  healSchema().then((r) => {
    console.log('[self-heal] result:', JSON.stringify(r));
    process.exit(0);
  }).catch((e) => {
    console.error(e);
    process.exit(0);
  });
}
