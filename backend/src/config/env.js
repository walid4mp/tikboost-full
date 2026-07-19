require('dotenv').config();

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  APP_NAME: process.env.APP_NAME || 'TikBoost',
  APP_URL: process.env.APP_URL || 'http://localhost:4000',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || '15m',
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || '30d',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL || 'admin@tikboost.app',
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || 'Admin@123456',
  SEED_ADMIN_NAME: process.env.SEED_ADMIN_NAME || 'Super Admin',
  TASK_COOLDOWN_SECONDS: parseInt(process.env.TASK_COOLDOWN_SECONDS || '8', 10),
  MAX_CAMPAIGNS_PER_USER: parseInt(process.env.MAX_CAMPAIGNS_PER_USER || '20', 10),
  FREEZE_DURATION_MIN: parseInt(process.env.FREEZE_DURATION_MIN || '60', 10),
  SOCKET_CORS_ORIGIN: process.env.SOCKET_CORS_ORIGIN || '*',
  ENABLE_GOOGLE_LOGIN: (process.env.ENABLE_GOOGLE_LOGIN || 'true') === 'true',
};
