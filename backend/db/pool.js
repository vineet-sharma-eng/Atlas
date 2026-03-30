const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool(
  isProduction
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
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
