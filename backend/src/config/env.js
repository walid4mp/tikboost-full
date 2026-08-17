require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_URL = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:4000';

module.exports = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT || '4000', 10),
  APP_NAME: process.env.APP_NAME || 'TikBoost',
  APP_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || '15m',
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || '30d',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL || 'admin@tikboost.app',
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || 'ChangeMeBeforeProduction_2026!',
  SEED_ADMIN_NAME: process.env.SEED_ADMIN_NAME || 'Super Admin',
  TASK_COOLDOWN_SECONDS: parseInt(process.env.TASK_COOLDOWN_SECONDS || '8', 10),
  MAX_CAMPAIGNS_PER_USER: parseInt(process.env.MAX_CAMPAIGNS_PER_USER || '20', 10),
  FREEZE_DURATION_MIN: parseInt(process.env.FREEZE_DURATION_MIN || '60', 10),
  SOCKET_CORS_ORIGIN:
    process.env.SOCKET_CORS_ORIGIN || (NODE_ENV === 'production' ? APP_URL : '*'),
  ENABLE_GOOGLE_LOGIN: (process.env.ENABLE_GOOGLE_LOGIN || 'false') === 'true',
  ENABLE_LEGACY_PASSWORD_RESET:
    (process.env.ENABLE_LEGACY_PASSWORD_RESET || 'false') === 'true',
  PASSWORD_RESET_TTL_MIN: parseInt(process.env.PASSWORD_RESET_TTL_MIN || '15', 10),
  RESET_OTP_ENCRYPTION_KEY: process.env.RESET_OTP_ENCRYPTION_KEY || '',

  // HTTPS email provider (preferred over SMTP on Render free tier)
  EMAIL_PROVIDER: (process.env.EMAIL_PROVIDER || 'resend').toLowerCase(),
  EMAIL_API_KEY: process.env.EMAIL_API_KEY || '',
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN || '',
  MAIL_FROM: process.env.MAIL_FROM || process.env.SMTP_USER || 'TikBoost <noreply@tikboost.app>',

  // Legacy SMTP kept only as manual fallback when EMAIL_PROVIDER=smtp
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '465', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || '',
  SMTP_SECURE: process.env.SMTP_SECURE || '',
};
