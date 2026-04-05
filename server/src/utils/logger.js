function serialize(level, message, meta) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  });
}

function write(stream, level, message, meta) {
  stream.write(`${serialize(level, message, meta)}\n`);
}

const logger = {
  info(message, meta = {}) {
    write(process.stdout, 'info', message, meta);
  },
  warn(message, meta = {}) {
    write(process.stdout, 'warn', message, meta);
  },
  error(message, meta = {}) {
    write(process.stderr, 'error', message, meta);
  },
};

module.exports = logger;
