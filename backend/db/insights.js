const pool = require('./pool');

let schemaReadyPromise;

async function ensureInsightsTable() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS insights (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  return schemaReadyPromise;
}

async function insertInsight(type, content) {
  await ensureInsightsTable();

  const result = await pool.query(
    `
      INSERT INTO insights (type, content)
      VALUES ($1, $2)
      RETURNING id, type, content, created_at
    `,
    [type, content]
  );

  return result.rows[0];
}

async function getLatestInsights(limit = 10) {
  await ensureInsightsTable();

  const result = await pool.query(
    `
      SELECT id, type, content, created_at
      FROM insights
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

module.exports = {
  ensureInsightsTable,
  insertInsight,
  getLatestInsights,
};
