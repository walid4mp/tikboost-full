const { execFileSync } = require('child_process');
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

function hasMigrations() {
  if (!fs.existsSync(migrationsDir)) return false;
  return fs.readdirSync(migrationsDir).some((entry) => {
    if (entry.startsWith('.')) return false;
    return fs.statSync(path.join(migrationsDir, entry)).isDirectory();
  });
}

function main() {
  assertRenderDatabaseUrl();
  run('npx', ['prisma', 'generate', '--schema', schemaPath]);

  if (hasMigrations()) {
    run('npx', ['prisma', 'migrate', 'deploy', '--schema', schemaPath]);
  } else {
    run('npx', ['prisma', 'db', 'push', '--schema', schemaPath]);
  }

  run('node', [path.join(__dirname, 'seed.js')]);
}

main();
