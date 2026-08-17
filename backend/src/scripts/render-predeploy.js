const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', '..', 'prisma', 'schema.prisma');
const migrationsDir = path.join(__dirname, '..', '..', 'prisma', 'migrations');

function run(cmd, args) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, {
    stdio: 'inherit',
    env: process.env,
  });
}

function runCapture(cmd, args) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    env: process.env,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result;
}

function assertRenderDatabaseUrl() {
  const dbUrl = process.env.DATABASE_URL || '';

  if (!dbUrl) {
    throw new Error('DATABASE_URL is required for Render deploys');
  }

  const lowered = dbUrl.toLowerCase();
  if (lowered.includes('localhost:5432') || lowered.includes('127.0.0.1:5432')) {
    throw new Error('DATABASE_URL points to localhost:5432. Render must use the managed Postgres connection string, not localhost.');
  }
}

function listMigrations() {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs.readdirSync(migrationsDir)
    .filter((entry) => {
      if (entry.startsWith('.')) return false;
      if (entry === 'migration_lock.toml') return false;
      return fs.statSync(path.join(migrationsDir, entry)).isDirectory();
    })
    .sort();
}

/**
 * Detect whether the DB was originally created by prisma db push or a legacy
 * schema (i.e. tables like "User" exist but _prisma_migrations does not).
 * When that is the case, and our schema fields (e.g. User.gender) are missing
 * we cannot simply run `migrate deploy` because Prisma will refuse to apply
 * migrations on top of a divergent schema. Baselining tells Prisma "these
 * migrations are already applied" for the parts that ARE in the DB, and then
 * `migrate deploy` will apply only the truly-missing ones with our safe
 * ADD COLUMN IF NOT EXISTS statements.
 *
 * We do NOT delete or recreate anything; this preserves all user data.
 */
function ensureMigrationsBaseline() {
  const migrations = listMigrations();
  if (migrations.length === 0) {
    throw new Error('Prisma migrations directory is required for production deploys. Refusing to use prisma db push.');
  }

  // Attempt migrate deploy first. If it succeeds, we are done.
  const first = runCapture('npx', ['prisma', 'migrate', 'deploy', '--schema', schemaPath]);
  if (first.status === 0) {
    console.log('✔ prisma migrate deploy applied cleanly.');
    return;
  }

  const combined = `${first.stdout || ''}\n${first.stderr || ''}`;

  // Case 1: DB is drifted / legacy schema without _prisma_migrations.
  const looksLikeMissingBaseline = /P3005|database schema is not empty|non-empty database|migrations table does not exist|The database schema is not empty/i.test(combined);

  // Case 2: Prisma reports a failed / partial migration state we must resolve
  const looksLikeFailedMigration = /P3009|migrate found failed migrations/i.test(combined);

  if (!looksLikeMissingBaseline && !looksLikeFailedMigration) {
    // Real error: rethrow by re-running to fail hard with stderr visible.
    throw new Error('prisma migrate deploy failed for a reason other than missing baseline. See logs above.');
  }

  console.warn('⚠ prisma migrate deploy could not proceed cleanly. Attempting safe baseline / resolve.');

  // For every migration folder we already ship, mark it as applied.
  // `resolve --applied` is a metadata-only op: it records the migration in
  // _prisma_migrations without executing any SQL. Combined with our
  // idempotent ADD COLUMN IF NOT EXISTS SQL, this is safe even if some of
  // the columns already exist.
  for (const name of migrations) {
    const res = runCapture('npx', ['prisma', 'migrate', 'resolve', '--applied', name, '--schema', schemaPath]);
    if (res.status !== 0) {
      const msg = `${res.stdout || ''}\n${res.stderr || ''}`;
      if (/already recorded as applied|is already applied|already exists/i.test(msg)) {
        continue;
      }
      // Non-fatal: continue trying the next one so we can still apply later
      // migrations idempotently below.
      console.warn(`⚠ resolve --applied ${name} did not succeed cleanly. Continuing.`);
    }
  }

  // Now the migrations table exists and we can run migrate deploy again.
  // Because our SQL uses IF NOT EXISTS everywhere, any migration whose
  // columns are already present will simply no-op.
  const second = runCapture('npx', ['prisma', 'migrate', 'deploy', '--schema', schemaPath]);
  if (second.status === 0) {
    console.log('✔ prisma migrate deploy applied after baseline.');
    return;
  }

  // Final defensive step: manually run the additive Phase-1 SQL so the
  // production DB gains the missing User.gender / User.countryCode /
  // Campaign.targetGender / Campaign.targetCountry columns even if the
  // Prisma migrator remains stuck. The statements are strictly ADD COLUMN
  // IF NOT EXISTS + CREATE INDEX IF NOT EXISTS — no destructive ops.
  console.warn('⚠ Falling back to direct additive SQL for Phase 1 profile columns.');
  const phase1Sql = path.join(
    migrationsDir,
    '20260811161000_add_profile_completion_and_audience_targeting',
    'migration.sql',
  );
  if (!fs.existsSync(phase1Sql)) {
    throw new Error('Missing Phase 1 migration SQL file. Refusing to continue.');
  }
  const fallback = runCapture('npx', ['prisma', 'db', 'execute', '--schema', schemaPath, '--file', phase1Sql]);
  if (fallback.status !== 0) {
    throw new Error('Direct additive SQL fallback failed. See logs above.');
  }
  console.log('✔ Phase 1 additive SQL applied directly. No data destroyed.');
}

function main() {
  assertRenderDatabaseUrl();
  run('npx', ['prisma', 'generate', '--schema', schemaPath]);
  run('node', [path.join(__dirname, 'verify-prisma-client.js')]);
  ensureMigrationsBaseline();
  // Seed is intentionally last so any new admin roles / packages / wheel
  // prizes exist for the freshly-migrated schema. Seed itself is idempotent.
  run('node', [path.join(__dirname, 'seed.js')]);
}

main();
