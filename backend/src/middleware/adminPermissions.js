const { AppError } = require('../utils/errors');

const ALL_PERMISSIONS = [
  'dashboard', 'users', 'campaigns', 'purchases', 'reports', 'notifications',
  'logs', 'ads', 'packages', 'offers', 'rewards', 'admins', 'settings', 'analytics'
];

function hasAdminPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  if (!['ADMIN', 'MODERATOR', 'FINANCE'].includes(user.role)) return false;
  if (!Array.isArray(user.adminPermissions) || user.adminPermissions.length === 0) return true;
  return user.adminPermissions.includes('*') || user.adminPermissions.includes(permission);
}

const requireAdminPermission = (permission) => (req, _res, next) => {
  if (!hasAdminPermission(req.user, permission)) {
    return next(new AppError(`Missing admin permission: ${permission}`, 403, 'ADMIN_PERMISSION_DENIED'));
  }
  return next();
};

const requireSuperAdmin = (req, _res, next) => {
  if (req.user?.role !== 'SUPER_ADMIN') return next(new AppError('Super admin required', 403, 'SUPER_ADMIN_REQUIRED'));
  return next();
};

module.exports = { ALL_PERMISSIONS, hasAdminPermission, requireAdminPermission, requireSuperAdmin };
