const { validationResult } = require('express-validator');
const { AppError } = require('../utils/errors');

module.exports = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return next(new AppError(first.msg, 400, 'VALIDATION', errors.array()));
  }
  next();
};
