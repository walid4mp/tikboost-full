const r = require('express').Router();
const { authRequired, requireRole } = require('../middleware/auth');
const { requireAdminPermission, requireSuperAdmin } = require('../middleware/adminPermissions');
const ctrl = require('../controllers/admin.controller');
const packageCtrl = require('../controllers/package.controller');
const offerCtrl = require('../controllers/offer.controller');

r.use(authRequired, requireRole('MODERATOR', 'FINANCE', 'ADMIN', 'SUPER_ADMIN'));
r.use((req, _res, next) => {
  const p = req.path;
  const map = p.startsWith('/users') ? 'users' : p.startsWith('/campaigns') ? 'campaigns' : p.startsWith('/purchases') ? 'purchases' : p.startsWith('/reports') ? 'reports' : p.startsWith('/notifications') ? 'notifications' : p.startsWith('/logs') ? 'logs' : p.startsWith('/settings/ads') ? 'ads' : p.startsWith('/settings/rewards') ? 'rewards' : p.startsWith('/packages') ? 'packages' : p.startsWith('/offers') ? 'offers' : p.startsWith('/wheel') ? 'rewards' : p.startsWith('/stats') ? 'dashboard' : p.startsWith('/analytics') ? 'analytics' : p.startsWith('/admins') ? 'admins' : p.startsWith('/settings') ? 'settings' : p.startsWith('/vip') ? 'rewards' : p.startsWith('/password-reset-requests') ? 'users' : 'dashboard';
  return requireAdminPermission(map)(req, _res, next);
});

r.get('/users', ctrl.listUsers);
r.get('/users/:id', ctrl.userDetail);
r.put('/users/:id', ctrl.updateUser);
r.delete('/users/:id', ctrl.deleteUser);
r.post('/users/:id/freeze', ctrl.freezeUser);
r.post('/users/:id/unfreeze', ctrl.unfreezeUser);
r.post('/users/:id/ban', ctrl.banUser);
r.post('/users/:id/grant-points', ctrl.grantPoints);
r.put('/users/:id/role', ctrl.updateRole);

r.get('/campaigns', ctrl.listCampaigns);
r.post('/campaigns/:id/action', ctrl.campaignAction);

r.get('/purchases', ctrl.listPurchases);
r.post('/purchases/:id/approve', ctrl.approvePurchase);
r.post('/purchases/:id/reject', ctrl.rejectPurchase);

r.get('/reports', ctrl.listReports);
r.post('/reports/:id/resolve', ctrl.resolveReport);

r.post('/notifications/send', ctrl.sendNotification);

r.get('/password-reset-requests', ctrl.listPasswordResetRequests);
r.post('/password-reset-requests/:id/reveal', ctrl.revealPasswordResetCode);
r.post('/password-reset-requests/:id/regenerate', ctrl.regeneratePasswordResetCode);
r.post('/password-reset-requests/:id/cancel', ctrl.cancelPasswordResetRequest);

r.get('/settings/app', ctrl.getAppSettings);
r.put('/settings/app', ctrl.updateAppSettings);
r.get('/settings/pricing', ctrl.getPricingSettings);
r.put('/settings/pricing', ctrl.updatePricingSettings);
r.get('/settings/payments', ctrl.getPaymentSettings);
r.put('/settings/payments', ctrl.updatePaymentSettings);
r.get('/settings/rewards', ctrl.getRewardSettings);
r.put('/settings/rewards', ctrl.updateRewardSettings);
r.get('/settings/ads', ctrl.getAdSettings);
r.put('/settings/ads', ctrl.updateAdSettings);
r.get('/packages', packageCtrl.listAdmin);
r.post('/packages', packageCtrl.createAdmin);
r.put('/packages/:id', packageCtrl.updateAdmin);
r.delete('/packages/:id', packageCtrl.deleteAdmin);
r.get('/wheel/prizes', ctrl.listWheelPrizes);
r.put('/wheel/prizes/:id', ctrl.updateWheelPrize);

r.get('/vip/subscriptions', require('../controllers/vip.controller').listAdmin);
r.post('/vip/subscriptions/:id/action', require('../controllers/vip.controller').actionAdmin);
r.post('/vip/grant', require('../controllers/vip.controller').grantAdmin);
r.put('/vip/plans', require('../controllers/vip.controller').savePlans);
r.get('/offers', offerCtrl.listAdmin);
r.post('/offers', offerCtrl.createAdmin);
r.put('/offers/:id', offerCtrl.updateAdmin);
r.delete('/offers/:id', offerCtrl.deleteAdmin);

r.get('/stats', ctrl.stats);
r.get('/stats/top-users', ctrl.topUsers);
r.get('/stats/chart', ctrl.chart);

r.get('/logs', ctrl.adminLogs);
r.get('/analytics/ads', ctrl.listAdAnalytics);
r.get('/admins', requireSuperAdmin, ctrl.listAdmins);
r.post('/admins', requireSuperAdmin, ctrl.createAdmin);
r.put('/admins/:id', requireSuperAdmin, ctrl.updateAdmin);
r.delete('/admins/:id', requireSuperAdmin, ctrl.deleteAdmin);

module.exports = r;
