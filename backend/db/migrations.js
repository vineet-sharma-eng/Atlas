const fs = require('fs');
const path = require('path');
const pool = require('./pool');
const { runMigrations } = require('./migrationRunner');

const shouldSeed = process.argv.includes('--seed') || process.env.DB_SETUP_SEED === 'true';
const MIGRATIONS_DIR = path.join(__dirname, 'sql-migrations');

async function run() {
  const client = await pool.connect();

  try {
    console.log('Connected');

    console.log('Running migrations...');
    await runMigrations({ client });

    if (shouldSeed) {
      const seedPath = path.join(__dirname, 'seed.sql');
      const seedSQL = fs.readFileSync(seedPath, 'utf-8');

      console.log('Running seed...');
      await client.query(seedSQL);

      // Seed inserts legacy exercise_name rows after schema migrations have
      // already been marked as applied. Re-run the SQL bodies without touching
      // schema_migrations so fresh databases get the same reconciliation and
      // exercise-id backfill as existing databases.
      console.log('Reconciling seeded data...');
      await rerunMigrationBodies(client);
    } else {
      console.log('Skipping seed (use --seed or DB_SETUP_SEED=true to include demo data).');
    }

    console.log('Done');
    process.exitCode = 0;
  } catch (error) {
    console.error('Error:', error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

async function rerunMigrationBodies(client) {
  const fileNames = fs.readdirSync(MIGRATIONS_DIR)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));

  for (const fileName of fileNames) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, fileName), 'utf8');
    await client.query(sql);
  }
}

run();
