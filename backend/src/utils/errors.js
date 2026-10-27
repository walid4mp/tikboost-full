class AppError extends Error {
  constructor(message, statusCode = 400, code = 'APP_ERROR', errors) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
  }
}
module.exports = { AppError };
