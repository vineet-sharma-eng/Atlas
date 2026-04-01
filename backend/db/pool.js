const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env'), override: false });

const hasDatabaseUrl = Boolean(String(process.env.DATABASE_URL || '').trim());

const pool = new Pool(
  hasDatabaseUrl
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
      }
    : {
        host: '127.0.0.1',
        user: 'postgres',
        password: 'postgres',
        database: 'atlas',
        port: 5432,
      }
);

module.exports = pool;
