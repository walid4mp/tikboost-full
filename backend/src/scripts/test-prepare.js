const { execSync } = require('node:child_process');

function run(command) {
  console.log(`\n$ ${command}`);
  execSync(command, { stdio: 'inherit', env: process.env });
}

function assertSafeTestDatabase() {
  const url = String(process.env.DATABASE_URL || '');
  const nodeEnv = String(process.env.NODE_ENV || '');

  if (!url) {
    throw new Error('DATABASE_URL is required for test preparation.');
  }

  const looksLikeTestDb = /(?:_|-|\/)test(?:\b|$)/i.test(url) || /tikboost_test/i.test(url);
  if (nodeEnv !== 'test' && !looksLikeTestDb) {
    throw new Error(`Refusing to reset a non-test database. NODE_ENV=${nodeEnv}, DATABASE_URL=${url}`);
  }
}

(function main() {
  assertSafeTestDatabase();
  run('npx prisma generate --schema=prisma/schema.prisma');
  run('npx prisma migrate reset --force --skip-generate --skip-seed --schema=prisma/schema.prisma');
  run('node src/scripts/seed.js');
  console.log('\n✓ Test database is ready.');
})();
