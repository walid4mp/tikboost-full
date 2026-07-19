const r = require('express').Router();
const { authRequired, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/admin.controller');

// All admin endpoints require at least MODERATOR
r.use(authRequired, requireRole('MODERATOR','FINANCE','ADMIN','SUPER_ADMIN'));

r.get   ('/users',                                 ctrl.listUsers);
r.get   ('/users/:id',                             ctrl.userDetail);
r.put   ('/users/:id',                             ctrl.updateUser);
r.delete('/users/:id',                             ctrl.deleteUser);
r.post  ('/users/:id/freeze',                      ctrl.freezeUser);
r.post  ('/users/:id/unfreeze',                    ctrl.unfreezeUser);
r.post  ('/users/:id/ban',                         ctrl.banUser);
r.post  ('/users/:id/grant-points',                ctrl.grantPoints);
r.put   ('/users/:id/role',                        ctrl.updateRole);

r.get   ('/campaigns',                             ctrl.listCampaigns);
r.post  ('/campaigns/:id/action',                  ctrl.campaignAction);

r.get   ('/purchases',                             ctrl.listPurchases);
r.post  ('/purchases/:id/approve',                 ctrl.approvePurchase);
r.post  ('/purchases/:id/reject',                  ctrl.rejectPurchase);

r.get   ('/reports',                               ctrl.listReports);
r.post  ('/reports/:id/resolve',                   ctrl.resolveReport);

r.post  ('/notifications/send',                    ctrl.sendNotification);

r.get   ('/stats',                                 ctrl.stats);
r.get   ('/stats/top-users',                       ctrl.topUsers);
r.get   ('/stats/chart',                           ctrl.chart);

r.get   ('/logs',                                  ctrl.adminLogs);

module.exports = r;
