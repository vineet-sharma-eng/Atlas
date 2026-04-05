const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env'), override: false });

const hasDatabaseUrl = Boolean(String(process.env.DATABASE_URL || '').trim());
const connectionString = String(process.env.DATABASE_URL || '').trim();
const ssl = resolveSslConfig(connectionString);

const pool = new Pool(
  hasDatabaseUrl
    ? {
        connectionString,
        ssl,
      }
    : {
        host: '127.0.0.1',
        user: 'postgres',
        password: 'postgres',
        database: 'atlas',
        port: 5432,
      }
);

function resolveSslConfig(databaseUrl) {
  const explicitMode = String(process.env.DATABASE_SSL_MODE || process.env.PGSSLMODE || '').trim().toLowerCase();

  if (['disable', 'off', 'false', 'no'].includes(explicitMode)) {
    return false;
  }

  if (['require', 'prefer', 'verify-ca', 'verify-full', 'on', 'true', 'yes'].includes(explicitMode)) {
    return { rejectUnauthorized: false };
  }

  const explicitFlag = String(process.env.DATABASE_SSL || '').trim().toLowerCase();

  if (['false', '0', 'no', 'off'].includes(explicitFlag)) {
    return false;
  }

  if (['true', '1', 'yes', 'on'].includes(explicitFlag)) {
    return { rejectUnauthorized: false };
  }

  if (!databaseUrl) {
    return false;
  }

  try {
    const parsedUrl = new URL(databaseUrl);
    const host = String(parsedUrl.hostname || '').trim().toLowerCase();
    const isLocalHost = ['127.0.0.1', 'localhost'].includes(host);

    return isLocalHost ? false : { rejectUnauthorized: false };
  } catch (_) {
    return process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false;
  }
}

module.exports = pool;
