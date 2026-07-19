const { AppError } = require('../utils/errors');

function notFound(_req, _res, next) { next(new AppError('Not found', 404)); }

function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  if (process.env.NODE_ENV !== 'production' && status >= 500) console.error(err);
  res.status(status).json({
    success: false,
    message: err.message || 'Server error',
    code,
    errors: err.errors || undefined,
  });
}

module.exports = { notFound, errorHandler };
