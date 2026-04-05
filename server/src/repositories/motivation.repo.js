const pool = require('../../db/pool');

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
      domain TEXT NOT NULL DEFAULT 'general',
      content TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'fallback',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      valid_until TIMESTAMPTZ
    );
  `);

  await pool.query(`ALTER TABLE motivation ADD COLUMN IF NOT EXISTS domain TEXT NOT NULL DEFAULT 'general';`);
  await pool.query(`ALTER TABLE motivation ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'fallback';`);
  await pool.query(`ALTER TABLE motivation ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;`);
  await pool.query(`UPDATE motivation SET domain = 'general' WHERE domain IS NULL OR domain = '';`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_motivation_domain_valid_until ON motivation(domain, valid_until DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_motivation_valid_until ON motivation(valid_until DESC);`);
}

async function insertManyMotivation(entries) {
  await ensureMotivationTable();

  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const inserted = [];

  for (const entry of entries) {
    const domain = normalizeDomain(entry.domain);
    const content = String(entry.content || '').trim();
    const source = normalizeSource(entry.source);

    if (!content) {
      continue;
    }

    const result = await pool.query(
      `
        INSERT INTO motivation (domain, content, source, valid_until)
        VALUES ($1, $2, $3, $4)
        RETURNING id, domain, content, source, created_at, valid_until
      `,
      [domain, content, source, entry.validUntil || null],
    );

    inserted.push(mapMotivationRow(result.rows[0]));
  }

  return inserted;
}

async function countValidMotivation(domain = null) {
  await ensureMotivationTable();

  if (domain) {
    const normalizedDomain = normalizeDomain(domain);
    const result = await pool.query(
      `
        SELECT COUNT(*)::int AS count
        FROM motivation
        WHERE domain = $1
          AND (valid_until IS NULL OR valid_until > NOW())
      `,
      [normalizedDomain],
    );

    return Number(result.rows[0]?.count || 0);
  }

  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM motivation
      WHERE valid_until IS NULL OR valid_until > NOW()
    `,
  );

  return Number(result.rows[0]?.count || 0);
}

async function listValidMotivation(limit = 20, domain = null) {
  await ensureMotivationTable();

  if (domain) {
    const normalizedDomain = normalizeDomain(domain);
    const result = await pool.query(
      `
        SELECT id, domain, content, source, created_at, valid_until
        FROM motivation
        WHERE domain = $1
          AND (valid_until IS NULL OR valid_until > NOW())
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [normalizedDomain, limit],
    );

    return result.rows.map(mapMotivationRow);
  }

  const result = await pool.query(
    `
      SELECT id, domain, content, source, created_at, valid_until
      FROM motivation
      WHERE valid_until IS NULL OR valid_until > NOW()
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map(mapMotivationRow);
}

async function getRandomValidMotivation(domain = null) {
  await ensureMotivationTable();

  if (domain) {
    const normalizedDomain = normalizeDomain(domain);
    const result = await pool.query(
      `
        SELECT id, domain, content, source, created_at, valid_until
        FROM motivation
        WHERE domain = $1
          AND (valid_until IS NULL OR valid_until > NOW())
        ORDER BY RANDOM()
        LIMIT 1
      `,
      [normalizedDomain],
    );

    return result.rows[0] ? mapMotivationRow(result.rows[0]) : null;
  }

  const result = await pool.query(
    `
      SELECT id, domain, content, source, created_at, valid_until
      FROM motivation
      WHERE valid_until IS NULL OR valid_until > NOW()
      ORDER BY RANDOM()
      LIMIT 1
    `,
  );

  return result.rows[0] ? mapMotivationRow(result.rows[0]) : null;
}

function mapMotivationRow(row) {
  return {
    id: row.id,
    domain: row.domain,
    content: row.content,
    source: row.source,
    createdAt: row.created_at,
    validUntil: row.valid_until,
  };
}

function normalizeDomain(value) {
  const normalized = String(value || 'general').trim().toLowerCase();
  return ['general', 'gym'].includes(normalized) ? normalized : 'general';
}

function normalizeSource(value) {
  const normalized = String(value || 'fallback').trim().toLowerCase();
  return ['cloud', 'fallback', 'local'].includes(normalized) ? normalized : 'fallback';
}

module.exports = {
  ensureMotivationTable,
  insertManyMotivation,
  countValidMotivation,
  listValidMotivation,
  getRandomValidMotivation,
};
