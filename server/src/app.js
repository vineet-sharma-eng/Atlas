const crypto = require('crypto');
const cors = require('cors');
const express = require('express');
const path = require('path');

const config = require('./config');
const routes = require('./routes');
const logger = require('./utils/logger');
const { AppError, errorHandler, notFoundHandler } = require('./utils/errorHandler');

function createCorsOptions() {
  const allowedOrigins = new Set(config.server.corsAllowedOrigins);

  return {
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin, allowedOrigins)) {
        return callback(null, true);
      }

      return callback(new AppError(`CORS origin not allowed: ${origin}`, 403));
    },
    credentials: true,
  };
}

function isAllowedOrigin(origin, allowedOrigins) {
  if (allowedOrigins.size === 0 || allowedOrigins.has(origin)) {
    return true;
  }

  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch (_) {
    return false;
  }
}

function createApp() {
  const app = express();

  app.use((req, res, next) => {
    req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });

  if (config.isProduction) {
    app.use(
      express.static(config.frontendDistPath, {
        index: false,
      }),
    );
  }

  app.use(cors(createCorsOptions()));
  app.use(express.json({ limit: config.server.jsonLimit }));
  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    logger.info('Incoming request', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
    });
    next();
  });

  app.use(routes);

  if (config.isProduction) {
    app.get('/{*path}', (req, res, next) => {
      if (
        req.path.startsWith('/finance') ||
        req.path.startsWith('/gym') ||
        req.path.startsWith('/atlas') ||
        req.path.startsWith('/v1') ||
        req.path === '/motivation' ||
        req.path === '/health'
      ) {
        return next();
      }

      return res.sendFile(path.join(config.frontendDistPath, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
