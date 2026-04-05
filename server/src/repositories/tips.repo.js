const pool = require('../../db/pool');

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
      domain TEXT,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      valid_until TIMESTAMPTZ
    );
  `);

  await pool.query(`ALTER TABLE tips ADD COLUMN IF NOT EXISTS domain TEXT;`);
  await pool.query(`ALTER TABLE tips ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;`);
  await pool.query(`
    UPDATE tips
    SET domain = type
    WHERE domain IS NULL AND type IN ('finance', 'gym');
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tips_domain_valid_until ON tips(domain, valid_until DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tips_type_valid_until ON tips(type, valid_until DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tips_created_at ON tips(created_at DESC);`);
}

async function insertManyTips(entries) {
  await ensureTipsTable();

  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const inserted = [];

  for (const entry of entries) {
    const domain = normalizeDomain(entry.domain || entry.type);
    const content = String(entry.content || '').trim();

    if (!domain || !content) {
      continue;
    }

    const result = await pool.query(
      `
        INSERT INTO tips (type, domain, content, valid_until)
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          COALESCE(domain, type) AS domain,
          content,
          created_at,
          valid_until
      `,
      [domain, domain, content, entry.validUntil || null],
    );

    inserted.push(mapTipRow(result.rows[0]));
  }

  return inserted;
}

async function countValidTips(domain) {
  await ensureTipsTable();
  const normalizedDomain = normalizeDomain(domain);
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM tips
      WHERE COALESCE(domain, type) = $1
        AND (valid_until IS NULL OR valid_until > NOW())
    `,
    [normalizedDomain],
  );

  return Number(result.rows[0]?.count || 0);
}

async function listValidTips(domain, limit = 10) {
  await ensureTipsTable();
  const normalizedDomain = normalizeDomain(domain);
  const result = await pool.query(
    `
      SELECT
        id,
        COALESCE(domain, type) AS domain,
        content,
        created_at,
        valid_until
      FROM tips
      WHERE COALESCE(domain, type) = $1
        AND (valid_until IS NULL OR valid_until > NOW())
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [normalizedDomain, limit],
  );

  return result.rows.map(mapTipRow);
}

async function getDashboardTips(limit = 2) {
  await ensureTipsTable();
  const result = await pool.query(
    `
      SELECT
        id,
        COALESCE(domain, type) AS domain,
        content,
        created_at,
        valid_until
      FROM tips
      WHERE valid_until IS NULL OR valid_until > NOW()
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map(mapTipRow);
}

function mapTipRow(row) {
  return {
    id: row.id,
    domain: row.domain,
    content: row.content,
    createdAt: row.created_at,
    validUntil: row.valid_until,
  };
}

function normalizeDomain(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['finance', 'gym'].includes(normalized) ? normalized : null;
}

module.exports = {
  ensureTipsTable,
  insertManyTips,
  countValidTips,
  listValidTips,
  getDashboardTips,
};
