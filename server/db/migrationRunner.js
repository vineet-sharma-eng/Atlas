const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const MIGRATIONS_DIR = path.join(__dirname, 'sql-migrations');

let runtimeMigrationPromise;

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));
}

async function runMigrations({ client: providedClient = null } = {}) {
  const client = providedClient || await pool.connect();
  const ownsClient = !providedClient;

  try {
    await ensureMigrationTable(client);

    const appliedResult = await client.query('SELECT name FROM schema_migrations');
    const appliedNames = new Set(appliedResult.rows.map((row) => row.name));

    for (const fileName of listMigrationFiles()) {
      if (appliedNames.has(fileName)) {
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, fileName), 'utf8');

      await client.query('BEGIN');

      try {
        await client.query(sql);
        await client.query(
          `
            INSERT INTO schema_migrations (name)
            VALUES ($1)
          `,
          [fileName],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    if (ownsClient) {
      client.release();
    }
  }
}

async function runMigrationsOnce() {
  if (!runtimeMigrationPromise) {
    runtimeMigrationPromise = runMigrations().catch((error) => {
      runtimeMigrationPromise = null;
      throw error;
    });
  }

  return runtimeMigrationPromise;
}

module.exports = {
  runMigrations,
  runMigrationsOnce,
};
