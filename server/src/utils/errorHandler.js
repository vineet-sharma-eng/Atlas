const logger = require('./logger');

class AppError extends Error {
  constructor(message, statusCode = 500, details = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      type: 'not_found',
    },
  });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  logger.error('Request failed', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    error: err.message,
    details: err.details || null,
  });

  return res.status(statusCode).json({
    error: {
      message: err.message || 'Internal server error',
      type: err.name || 'Error',
      details: err.details || undefined,
    },
  });
}

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler,
};
