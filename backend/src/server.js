/* TikBoost Backend Entry */
require('dotenv').config();
const http = require('http');
const app = require('./app');
const { attachSockets } = require('./sockets/io');
const env = require('./config/env');
const { healSchema } = require('./scripts/self-heal-schema');
const { seedCoreData } = require('./scripts/seed');
const { initMailer, verifyEmailProvider } = require('./services/mailer.service');

function assertProductionConfig() {
  if (env.NODE_ENV !== 'production') return;

  const errors = [];
  if (!env.DATABASE_URL) errors.push('DATABASE_URL is required in production');
  if (!env.JWT_ACCESS_SECRET || env.JWT_ACCESS_SECRET === 'dev_access_secret') {
    errors.push('JWT_ACCESS_SECRET must be replaced in production');
  }
  if (!env.JWT_REFRESH_SECRET || env.JWT_REFRESH_SECRET === 'dev_refresh_secret') {
    errors.push('JWT_REFRESH_SECRET must be replaced in production');
  }
  if (env.SEED_ADMIN_PASSWORD === 'ChangeMeBeforeProduction_2026!') {
    errors.push('SEED_ADMIN_PASSWORD must be replaced in production');
  }
  if (env.ENABLE_LEGACY_PASSWORD_RESET) {
    errors.push('ENABLE_LEGACY_PASSWORD_RESET must stay disabled in production');
  }

  if (errors.length) {
    throw new Error(`Unsafe production configuration:\n- ${errors.join('\n- ')}`);
  }
}

assertProductionConfig();

const server = http.createServer(app);
attachSockets(server);

initMailer()
  .then(() => verifyEmailProvider())
  .then((info) => console.log(`[boot] email provider verified: provider=${info.provider} status=${info.status}`))
  .catch((err) => console.error(`[boot] email provider verification failed: ${err.code || ''} ${err.message}`))
  .then(() => healSchema())
  .catch((err) => console.error('[boot] self-heal error (continuing):', err.message))
  .then(() => seedCoreData())
  .catch((err) => console.error('[boot] seed error (continuing):', err.message))
  .finally(() => {
    server.listen(env.PORT, () => {
      console.log(`🚀 TikBoost API listening on :${env.PORT}  (${env.NODE_ENV})`);
    });
  });

process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err);
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
