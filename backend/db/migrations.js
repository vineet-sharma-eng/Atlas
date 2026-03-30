const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();

  try {
    console.log('Connected');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const seedPath = path.join(__dirname, 'seed.sql');

    const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');
    const seedSQL = fs.readFileSync(seedPath, 'utf-8');

    console.log('Running schema...');
    await client.query(schemaSQL);

    console.log('Running seed...');
    await client.query(seedSQL);

    console.log('✅ Done');
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    client.release();
    process.exit();
  }
}

run();