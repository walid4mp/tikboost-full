const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const env = require('./config/env');
const { notFound, errorHandler } = require('./middleware/error');
const apiLimiter = require('./middleware/rateLimit');

if (typeof BigInt.prototype.toJSON !== 'function') {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value() {
      return this.toString();
    },
    configurable: true,
    writable: true,
  });
}

const app = express();
// Render (and most PaaS) run behind a reverse proxy. Trust exactly one hop so
// express-rate-limit can read X-Forwarded-For safely without ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', 1);
const allowedOrigins = env.SOCKET_CORS_ORIGIN === '*'
  ? true
  : env.SOCKET_CORS_ORIGIN.split(',').map((value) => value.trim()).filter(Boolean);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api', apiLimiter);

app.use('/admin', express.static(path.join(__dirname, '..', '..', 'admin-panel')));
app.get('/', (_req, res) => res.redirect('/admin/'));
app.get('/health', (_req, res) => res.json({ ok: true, app: env.APP_NAME, ts: Date.now() }));

app.use('/api', require('./routes/public.routes'));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/user', require('./routes/user.routes'));
app.use('/api/campaigns', require('./routes/campaign.routes'));
app.use('/api/tasks', require('./routes/task.routes'));
app.use('/api/packages', require('./routes/package.routes'));
app.use('/api/referrals', require('./routes/referral.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/vip', require('./routes/vip.routes'));
app.use('/api/contact', require('./routes/contact.routes'));
app.use('/api/wheel', require('./routes/wheel.routes'));
app.use('/api/rewards', require('./routes/rewards.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/admin-panel', require('./routes/adminPanel.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
