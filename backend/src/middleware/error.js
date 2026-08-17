const { AppError } = require('../utils/errors');

function notFound(_req, _res, next) { next(new AppError('Not found', 404)); }

function normalizePrismaError(err) {
  const target = Array.isArray(err?.meta?.target) ? err.meta.target.map(String) : [];

  if (err?.name === 'PrismaClientValidationError') {
    return new AppError('Invalid database request', 400, 'PRISMA_VALIDATION_ERROR');
  }

  if (err?.name === 'PrismaClientInitializationError') {
    const code = err?.errorCode || err?.code;
    if (code === 'P1001') return new AppError('Database connection failed', 503, 'P1001');
    if (code === 'P1003') return new AppError('Database does not exist', 503, 'P1003');
    return new AppError('Database initialization failed', 503, code || 'PRISMA_INIT_ERROR');
  }

  switch (err?.code) {
    case 'P1001':
      return new AppError('Database connection failed', 503, 'P1001');
    case 'P1003':
      return new AppError('Database does not exist', 503, 'P1003');
    case 'P2002':
      if (target.includes('email')) {
        return new AppError('Email already in use', 409, 'EMAIL_USED');
      }
      if (target.includes('deviceId')) {
        return new AppError('Device already linked to another account', 409, 'DEVICE_ID_USED');
      }
      return new AppError('Unique constraint conflict', 409, 'P2002', { target });
    case 'P2003':
      return new AppError('Related record constraint failed', 409, 'P2003');
    case 'P2025':
      return new AppError('Record not found', 404, 'P2025');
    case 'P2022':
      return new AppError(
        process.env.NODE_ENV === 'production'
          ? 'Database schema mismatch'
          : err.message || 'Database schema mismatch',
        500,
        'P2022',
      );
    default:
      return null;
  }
}

function errorHandler(err, _req, res, _next) {
  const normalized = err instanceof AppError ? err : normalizePrismaError(err) || err;
  const status = normalized.statusCode || 500;
  const code = normalized.code || 'INTERNAL_ERROR';
  const message =
    status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Server error'
      : normalized.message || 'Server error';

  if (status >= 500) {
    console.error(normalized);
  }

  res.status(status).json({
    success: false,
    message,
    code,
    errors: normalized.errors || undefined,
  });
}

module.exports = { notFound, errorHandler };
