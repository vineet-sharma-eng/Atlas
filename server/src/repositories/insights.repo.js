const pool = require('../../db/pool');

const PRIORITY_ORDER_SQL = `
  CASE COALESCE(NULLIF(priority, ''), 'medium')
    WHEN 'high' THEN 3
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 1
    ELSE 0
  END
`;

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
      domain TEXT,
      subtype TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      valid_until TIMESTAMPTZ
    );
  `);

  await pool.query(`ALTER TABLE insights ADD COLUMN IF NOT EXISTS domain TEXT;`);
  await pool.query(`ALTER TABLE insights ADD COLUMN IF NOT EXISTS subtype TEXT;`);
  await pool.query(`ALTER TABLE insights ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';`);
  await pool.query(`ALTER TABLE insights ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE insights ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;`);
  await pool.query(`
    UPDATE insights
    SET domain = type
    WHERE domain IS NULL AND type IN ('finance', 'gym');
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_insights_domain_valid_until ON insights(domain, valid_until DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_insights_type_valid_until ON insights(type, valid_until DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_insights_created_at ON insights(created_at DESC);`);
}

async function insertManyInsights(entries) {
  await ensureInsightsTable();

  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const inserted = [];

  for (const entry of entries) {
    const domain = normalizeDomain(entry.domain || entry.type);
    const subtype = normalizeOptionalString(entry.subtype);
    const priority = normalizePriority(entry.priority);
    const title = normalizeString(entry.title);
    const content = normalizeString(entry.content);

    if (!domain || !content) {
      continue;
    }

    const result = await pool.query(
      `
        INSERT INTO insights (type, domain, subtype, priority, title, content, valid_until)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          COALESCE(domain, type) AS domain,
          subtype,
          priority,
          title,
          content,
          created_at,
          valid_until
      `,
      [domain, domain, subtype, priority, title, content, entry.validUntil || null],
    );

    inserted.push(mapInsightRow(result.rows[0]));
  }

  return inserted;
}

async function countValidInsights(domain) {
  await ensureInsightsTable();
  const normalizedDomain = normalizeDomain(domain);
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM insights
      WHERE COALESCE(domain, type) = $1
        AND (valid_until IS NULL OR valid_until > NOW())
    `,
    [normalizedDomain],
  );

  return Number(result.rows[0]?.count || 0);
}

async function listValidInsights(domain, limit = 10) {
  await ensureInsightsTable();
  const normalizedDomain = normalizeDomain(domain);
  const result = await pool.query(
    `
      SELECT
        id,
        COALESCE(domain, type) AS domain,
        subtype,
        priority,
        title,
        content,
        created_at,
        valid_until
      FROM insights
      WHERE COALESCE(domain, type) = $1
        AND (valid_until IS NULL OR valid_until > NOW())
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [normalizedDomain, limit],
  );

  return result.rows.map(mapInsightRow);
}

async function getDashboardInsights({ topLimit = 1, supportingLimit = 3 } = {}) {
  await ensureInsightsTable();

  const result = await pool.query(
    `
      WITH valid_insights AS (
        SELECT
          id,
          COALESCE(domain, type) AS domain,
          subtype,
          priority,
          title,
          content,
          created_at,
          valid_until
        FROM insights
        WHERE valid_until IS NULL OR valid_until > NOW()
      ),
      top_insight AS (
        SELECT *, 1 AS sort_order
        FROM valid_insights
        ORDER BY ${PRIORITY_ORDER_SQL} DESC, created_at DESC
        LIMIT $1
      ),
      supporting_insights AS (
        SELECT *, 2 AS sort_order
        FROM valid_insights
        WHERE id NOT IN (SELECT id FROM top_insight)
        ORDER BY created_at DESC
        LIMIT $2
      )
      SELECT 'top' AS section, id, domain, subtype, priority, title, content, created_at, valid_until, sort_order
      FROM top_insight
      UNION ALL
      SELECT 'supporting' AS section, id, domain, subtype, priority, title, content, created_at, valid_until, sort_order
      FROM supporting_insights
      ORDER BY sort_order ASC, created_at DESC
    `,
    [topLimit, supportingLimit],
  );

  return result.rows.map((row) => ({
    section: row.section,
    ...mapInsightRow(row),
  }));
}

async function findInsightById(id) {
  await ensureInsightsTable();
  const result = await pool.query(
    `
      SELECT
        id,
        COALESCE(domain, type) AS domain,
        subtype,
        priority,
        title,
        content,
        created_at,
        valid_until
      FROM insights
      WHERE id = $1
        AND (valid_until IS NULL OR valid_until > NOW())
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] ? mapInsightRow(result.rows[0]) : null;
}

function mapInsightRow(row) {
  return {
    id: row.id,
    domain: row.domain,
    subtype: row.subtype || null,
    priority: row.priority,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    validUntil: row.valid_until,
  };
}

function normalizeDomain(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['finance', 'gym'].includes(normalized) ? normalized : null;
}

function normalizePriority(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['high', 'medium', 'low'].includes(normalized) ? normalized : 'medium';
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeOptionalString(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

module.exports = {
  ensureInsightsTable,
  insertManyInsights,
  countValidInsights,
  listValidInsights,
  getDashboardInsights,
  findInsightById,
};
