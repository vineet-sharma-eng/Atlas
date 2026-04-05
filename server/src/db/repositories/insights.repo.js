const pool = require('../../../db/pool');

let schemaReadyPromise;

async function ensureInsightsTable() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureInsightsTableInternal();
  }

  return schemaReadyPromise;
}

async function ensureInsightsTableInternal() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS insights (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      valid_until TIMESTAMPTZ
    );
  `);

  await pool.query(`ALTER TABLE insights ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';`);
  await pool.query(`ALTER TABLE insights ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE insights ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_insights_type_valid_until ON insights(type, valid_until DESC);`);
}

async function insertManyInsights(entries) {
  await ensureInsightsTable();

  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const inserted = [];

  for (const entry of entries) {
    const result = await pool.query(
      `
        INSERT INTO insights (type, priority, title, content, valid_until)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, type, priority, title, content, created_at, valid_until
      `,
      [entry.type, entry.priority, entry.title, entry.content, entry.validUntil],
    );

    inserted.push(result.rows[0]);
  }

  return inserted;
}

async function countValidInsights(type) {
  await ensureInsightsTable();
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM insights
      WHERE type = $1
        AND (valid_until IS NULL OR valid_until > NOW())
    `,
    [type],
  );

  return Number(result.rows[0]?.count || 0);
}

async function listValidInsights(type, limit = 10) {
  await ensureInsightsTable();
  const result = await pool.query(
    `
      SELECT id, type, priority, title, content, created_at, valid_until
      FROM insights
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
  ensureInsightsTable,
  insertManyInsights,
  countValidInsights,
  listValidInsights,
};
