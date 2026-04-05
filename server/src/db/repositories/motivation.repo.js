const pool = require('../../../db/pool');

let schemaReadyPromise;

async function ensureMotivationTable() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureMotivationTableInternal();
  }

  return schemaReadyPromise;
}

async function ensureMotivationTableInternal() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS motivation (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'fallback',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      valid_until TIMESTAMPTZ
    );
  `);

  await pool.query(`ALTER TABLE motivation ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'fallback';`);
  await pool.query(`ALTER TABLE motivation ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_motivation_valid_until ON motivation(valid_until DESC);`);
}

async function insertManyMotivation(entries) {
  await ensureMotivationTable();

  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const inserted = [];

  for (const entry of entries) {
    const result = await pool.query(
      `
        INSERT INTO motivation (content, source, valid_until)
        VALUES ($1, $2, $3)
        RETURNING id, content, source, created_at, valid_until
      `,
      [entry.content, entry.source, entry.validUntil],
    );

    inserted.push(result.rows[0]);
  }

  return inserted;
}

async function countValidMotivation() {
  await ensureMotivationTable();
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM motivation
      WHERE valid_until IS NULL OR valid_until > NOW()
    `,
  );

  return Number(result.rows[0]?.count || 0);
}

async function listValidMotivation(limit = 20) {
  await ensureMotivationTable();
  const result = await pool.query(
    `
      SELECT id, content, source, created_at, valid_until
      FROM motivation
      WHERE valid_until IS NULL OR valid_until > NOW()
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows;
}

async function getRandomValidMotivation() {
  await ensureMotivationTable();
  const result = await pool.query(
    `
      SELECT id, content, source, created_at, valid_until
      FROM motivation
      WHERE valid_until IS NULL OR valid_until > NOW()
      ORDER BY RANDOM()
      LIMIT 1
    `,
  );

  return result.rows[0] || null;
}

module.exports = {
  ensureMotivationTable,
  insertManyMotivation,
  countValidMotivation,
  listValidMotivation,
  getRandomValidMotivation,
};
