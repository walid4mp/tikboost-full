const { AppError } = require('../utils/errors');
const { getSettings } = require('../services/appSettings.service');

const maintenanceGuard = async (req, _res, next) => {
  try {
    const maintenance = (await getSettings()).app?.maintenance || {};
    if (maintenance.enabled !== true) return next();
    const staff = ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'FINANCE', 'DEVELOPER'].includes(req.user?.role);
    const allowed = Array.isArray(maintenance.allowUserIds) && maintenance.allowUserIds.includes(String(req.user?.id));
    if (staff || allowed) return next();
    return next(new AppError('التطبيق تحت الصيانة حالياً. يرجى المحاولة لاحقاً.', 503, 'MAINTENANCE_MODE', {
      title: maintenance.title || 'التطبيق تحت الصيانة',
      message: maintenance.message || '',
      expectedReturnAt: maintenance.expectedReturnAt || '',
      buttons: maintenance.buttons || [],
    }));
  } catch (error) { return next(error); }
};

module.exports = maintenanceGuard;
