const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const env = require('./config/env');
const { notFound, errorHandler } = require('./middleware/error');
const apiLimiter = require('./middleware/rateLimit');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.SOCKET_CORS_ORIGIN === '*' ? true : env.SOCKET_CORS_ORIGIN.split(','), credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limit all /api routes
app.use('/api', apiLimiter);

// Static admin panel
app.use('/admin', express.static(path.join(__dirname, '..', '..', 'admin-panel')));
app.get('/', (_, res) => res.redirect('/admin/'));

app.get('/health', (_, res) => res.json({ ok: true, app: env.APP_NAME, ts: Date.now() }));

// API routes
app.use('/api/auth',          require('./routes/auth.routes'));
app.use('/api/user',          require('./routes/user.routes'));
app.use('/api/campaigns',     require('./routes/campaign.routes'));
app.use('/api/tasks',         require('./routes/task.routes'));
app.use('/api/packages',      require('./routes/package.routes'));
app.use('/api/referrals',     require('./routes/referral.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/contact',       require('./routes/contact.routes'));
app.use('/api/wheel',         require('./routes/wheel.routes'));
app.use('/api/admin',         require('./routes/admin.routes'));
app.use('/api/admin-panel',   require('./routes/adminPanel.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
