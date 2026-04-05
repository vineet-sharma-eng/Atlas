const pool = require('../../../db/pool');

let schemaReadyPromise;

async function ensureTipsTable() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureTipsTableInternal();
  }

  return schemaReadyPromise;
}

async function ensureTipsTableInternal() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tips (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      valid_until TIMESTAMPTZ
    );
  `);

  await pool.query(`ALTER TABLE tips ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tips_type_valid_until ON tips(type, valid_until DESC);`);
}

async function insertManyTips(entries) {
  await ensureTipsTable();

  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const inserted = [];

  for (const entry of entries) {
    const result = await pool.query(
      `
        INSERT INTO tips (type, content, valid_until)
        VALUES ($1, $2, $3)
        RETURNING id, type, content, created_at, valid_until
      `,
      [entry.type, entry.content, entry.validUntil],
    );

    inserted.push(result.rows[0]);
  }

  return inserted;
}

async function countValidTips(type) {
  await ensureTipsTable();
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM tips
      WHERE type = $1
        AND (valid_until IS NULL OR valid_until > NOW())
    `,
    [type],
  );

  return Number(result.rows[0]?.count || 0);
}

async function listValidTips(type, limit = 10) {
  await ensureTipsTable();
  const result = await pool.query(
    `
      SELECT id, type, content, created_at, valid_until
      FROM tips
      WHERE type = $1
        AND (valid_until IS NULL OR valid_until > NOW())
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [type, limit],
  );

  return result.rows;
}

module.exports = {
  ensureTipsTable,
  insertManyTips,
  countValidTips,
  listValidTips,
};
