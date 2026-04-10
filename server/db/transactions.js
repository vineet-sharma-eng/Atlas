const crypto = require('crypto');
const pool = require('./pool');

let schemaReadyPromise;

async function ensureTransactionsTable() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureTransactionsSchema();
  }

  return schemaReadyPromise;
}

async function ensureTransactionsSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      category TEXT,
      type TEXT,
      description TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS hash TEXT;
  `);

  await pool.query(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS type TEXT;
  `);

  await pool.query(`
    UPDATE transactions
    SET type = CASE
      WHEN amount < 0 THEN 'debit'
      WHEN amount > 0 AND (
        LOWER(description) ~ '(received from|receivedfrom|credited by|creditedby|cashback|refund|reward|deposit|added to bank|salary|interest|received)'
        OR LOWER(category) = 'income'
      ) THEN 'credit'
      ELSE 'debit'
    END
    WHERE type IS NULL;
  `);

  await pool.query(`
    UPDATE transactions
    SET amount = -ABS(amount)
    WHERE COALESCE(type, CASE WHEN amount < 0 THEN 'debit' ELSE 'credit' END) = 'debit'
      AND amount > 0;
  `);

  await pool.query(`
    UPDATE transactions
    SET amount = ABS(amount)
    WHERE COALESCE(type, CASE WHEN amount < 0 THEN 'debit' ELSE 'credit' END) = 'credit'
      AND amount < 0;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'unique_hash'
      ) THEN
        ALTER TABLE transactions
        ADD CONSTRAINT unique_hash UNIQUE (hash);
      END IF;
    END
    $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'transactions_date_amount_description_key'
      ) THEN
        ALTER TABLE transactions
        ADD CONSTRAINT transactions_date_amount_description_key
        UNIQUE (date, amount, description);
      END IF;
    END
    $$;
  `);
}

async function insertTransactions(transactions, source) {
  await ensureTransactionsTable();

  const inserted = [];
  const duplicates = [];

  for (const transaction of transactions) {
    const normalizedType = normalizeTransactionType(transaction.type);
    const signedAmount = normalizeStoredAmount(transaction.amount, normalizedType);
    const hash = generateTransactionHash(
      transaction.date,
      signedAmount,
      transaction.description
    );

    const insertResult = await pool.query(
      `
        INSERT INTO transactions (date, amount, category, type, description, source, hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT ON CONSTRAINT transactions_date_amount_description_key DO NOTHING
        RETURNING id, date, amount, category, type, description, source, hash, created_at
      `,
      [
        transaction.date,
        signedAmount,
        transaction.category || null,
        normalizedType,
        transaction.description,
        source,
        hash,
      ]
    );

    if (insertResult.rowCount === 0) {
      duplicates.push(transaction);
      continue;
    }

    inserted.push(insertResult.rows[0]);
  }

  return {
    inserted,
    duplicates,
  };
}

function generateTransactionHash(date, amount, description) {
  const normalizedDescription = String(description || '').toLowerCase().trim();

  return crypto
    .createHash('sha256')
    .update(`${date}-${amount}-${normalizedDescription}`)
    .digest('hex');
}

async function getTransactionAnalysisData(days) {
  await ensureTransactionsTable();

  const values = [];
  const whereClause = buildExpenseWhereClause(days, values);

  const totalSpentResult = await pool.query(
    `
      SELECT COALESCE(SUM(ABS(amount)), 0) AS total_spent
      FROM transactions
      ${whereClause}
    `,
    values
  );

  const categoryBreakdownResult = await pool.query(
    `
      SELECT COALESCE(category, 'uncategorized') AS category, SUM(ABS(amount)) AS total
      FROM transactions
      ${whereClause}
      GROUP BY COALESCE(category, 'uncategorized')
      ORDER BY total DESC
    `,
    values
  );

  const recentTransactionsResult = await pool.query(
    `
      SELECT date, ABS(amount) AS amount, description
      FROM transactions
      ${whereClause}
      ORDER BY date DESC, created_at DESC
      LIMIT 20
    `,
    values
  );

  const largestTransactionResult = await pool.query(
    `
      SELECT date, amount, description, category
      FROM transactions
      ${whereClause}
      ORDER BY amount ASC, date DESC
      LIMIT 1
    `,
    values
  );

  const statsResult = await pool.query(
    `
      SELECT
        COUNT(*) AS transaction_count,
        COALESCE(AVG(ABS(amount)), 0) AS average_amount,
        COALESCE(MAX(ABS(amount)), 0) AS max_amount
      FROM transactions
      ${whereClause}
    `,
    values
  );

  const transferCountValues = [];
  const transferWhereClause = buildTransferWhereClause(days, transferCountValues);
  const transferCountResult = await pool.query(
    `
      SELECT COUNT(*) AS transfer_count
      FROM transactions
      ${transferWhereClause}
    `,
    transferCountValues
  );

  let comparison = null;
  let categoryTrends = [];

  if (Number.isInteger(days) && days > 0) {
    const previousValues = [];
    const previousWhereClause = buildPreviousExpenseWhereClause(days, previousValues);
    const previousTotalSpentResult = await pool.query(
      `
        SELECT COALESCE(SUM(ABS(amount)), 0) AS total_spent
        FROM transactions
        ${previousWhereClause}
      `,
      previousValues
    );

    const previousCategoryBreakdownResult = await pool.query(
      `
        SELECT COALESCE(category, 'uncategorized') AS category, SUM(ABS(amount)) AS total
        FROM transactions
        ${previousWhereClause}
        GROUP BY COALESCE(category, 'uncategorized')
        ORDER BY total DESC
      `,
      previousValues
    );

    const previousTotalSpent = Number(
      previousTotalSpentResult.rows[0].total_spent || 0
    );

    comparison = {
      previousTotalSpent,
      changeAmount: Number(totalSpentResult.rows[0].total_spent || 0) - previousTotalSpent,
      changePercent:
        previousTotalSpent > 0
          ? ((Number(totalSpentResult.rows[0].total_spent || 0) - previousTotalSpent) /
              previousTotalSpent) *
            100
          : null,
    };

    categoryTrends = calculateCategoryTrends(
      categoryBreakdownResult.rows.map((row) => ({
        category: row.category,
        total: Number(row.total || 0),
      })),
      previousCategoryBreakdownResult.rows.map((row) => ({
        category: row.category,
        total: Number(row.total || 0),
      }))
    );
  }

  return {
    totalSpent: Number(totalSpentResult.rows[0].total_spent || 0),
    categoryBreakdown: categoryBreakdownResult.rows.map((row) => ({
      category: row.category,
      total: Number(row.total || 0),
    })),
    recentTransactions: recentTransactionsResult.rows.map((row) => ({
      date: row.date,
      amount: Number(row.amount || 0),
      description: row.description,
    })),
    largestTransaction: largestTransactionResult.rows[0]
      ? {
          date: largestTransactionResult.rows[0].date,
          amount: Math.abs(Number(largestTransactionResult.rows[0].amount || 0)),
          description: largestTransactionResult.rows[0].description,
          category: largestTransactionResult.rows[0].category || 'uncategorized',
        }
      : null,
    stats: {
      transactionCount: Number(statsResult.rows[0].transaction_count || 0),
      averageAmount: Number(statsResult.rows[0].average_amount || 0),
      maxAmount: Number(statsResult.rows[0].max_amount || 0),
    },
    transferCount: Number(transferCountResult.rows[0].transfer_count || 0),
    comparison,
    categoryTrends,
  };
}

async function listTransactions(options = {}) {
  await ensureTransactionsTable();

  const limit = normalizePositiveInteger(options.limit, 50, 200);
  const days = normalizeOptionalPositiveInteger(options.days);
  const values = [];
  const conditions = [];

  if (Number.isInteger(days) && days > 0) {
    values.push(days);
    conditions.push(`date >= NOW() - ($${values.length}::text || ' days')::interval`);
  }

  values.push(limit);

  const whereClause = conditions.length
    ? `WHERE ${conditions.join('\n      AND ')}`
    : '';

  const result = await pool.query(
    `
      SELECT id, date, ABS(amount) AS amount, category, description, source, created_at
      , COALESCE(type, CASE WHEN amount < 0 THEN 'debit' ELSE 'credit' END) AS type
      FROM transactions
      ${whereClause}
      ORDER BY date DESC, created_at DESC
      LIMIT $${values.length}
    `,
    values
  );

  return result.rows.map((row) => ({
    id: row.id,
    date: row.date,
    amount: Number(row.amount || 0),
    category: row.category || 'uncategorized',
    type: row.type,
    description: row.description,
    source: row.source,
    createdAt: row.created_at,
  }));
}

async function updateTransactionCategory(id, category) {
  await ensureTransactionsTable();

  const normalizedId = Number.parseInt(String(id || ''), 10);

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    const error = new Error('transaction id must be a positive integer');
    error.statusCode = 400;
    throw error;
  }

  const normalizedCategory = normalizeCategory(category);

  const result = await pool.query(
    `
      UPDATE transactions
      SET category = $2
      WHERE id = $1
      RETURNING
        id,
        date,
        ABS(amount) AS amount,
        COALESCE(category, 'uncategorized') AS category,
        COALESCE(type, CASE WHEN amount < 0 THEN 'debit' ELSE 'credit' END) AS type,
        description,
        source,
        created_at
    `,
    [normalizedId, normalizedCategory]
  );

  if (result.rowCount === 0) {
    const error = new Error('Transaction not found');
    error.statusCode = 404;
    throw error;
  }

  const row = result.rows[0];

  return {
    id: row.id,
    date: row.date,
    amount: Number(row.amount || 0),
    category: row.category || 'uncategorized',
    type: row.type,
    description: row.description,
    source: row.source,
    createdAt: row.created_at,
  };
}

function buildExpenseWhereClause(days, values) {
  const conditions = [
    debitPredicate(),
    "LOWER(description) NOT LIKE '%transfer%'",
    "LOWER(description) NOT LIKE '%self%'",
    "LOWER(description) NOT LIKE '%wallet%'",
  ];

  if (Number.isInteger(days) && days > 0) {
    values.push(days);
    conditions.push(`date >= NOW() - ($${values.length}::text || ' days')::interval`);
  }

  return `WHERE ${conditions.join('\n      AND ')}`;
}

function buildPreviousExpenseWhereClause(days, values) {
  values.push(days);
  const startIndex = values.length;
  values.push(days * 2);

  return `
    WHERE ${debitPredicate()}
      AND date < NOW() - ($${startIndex}::text || ' days')::interval
      AND date >= NOW() - ($${values.length}::text || ' days')::interval
      AND LOWER(description) NOT LIKE '%transfer%'
      AND LOWER(description) NOT LIKE '%self%'
      AND LOWER(description) NOT LIKE '%wallet%'
  `;
}

function buildTransferWhereClause(days, values) {
  const conditions = [
    "(",
    "LOWER(description) LIKE '%transfer%'",
    "OR LOWER(description) LIKE '%self%'",
    "OR LOWER(description) LIKE '%wallet%'",
    ")",
  ];

  if (Number.isInteger(days) && days > 0) {
    values.push(days);
    conditions.push(`AND date >= NOW() - ($${values.length}::text || ' days')::interval`);
  }

  return `WHERE ${conditions.join('\n      ')}`;
}

function debitPredicate() {
  return `(COALESCE(type, CASE WHEN amount < 0 THEN 'debit' ELSE 'credit' END) = 'debit')`;
}

function normalizeTransactionType(type) {
  return String(type || '').toLowerCase() === 'credit' ? 'credit' : 'debit';
}

function normalizeStoredAmount(amount, type) {
  const numericAmount = Number(amount || 0);
  const absoluteAmount = Math.abs(numericAmount);

  return type === 'credit' ? absoluteAmount : -absoluteAmount;
}

function calculateCategoryTrends(currentCategories, previousCategories) {
  const previousMap = new Map(
    previousCategories.map((item) => [item.category, item.total])
  );
  const currentMap = new Map(
    currentCategories.map((item) => [item.category, item.total])
  );
  const categories = new Set([
    ...currentCategories.map((item) => item.category),
    ...previousCategories.map((item) => item.category),
  ]);

  return Array.from(categories)
    .map((category) => {
      const currentTotal = currentMap.get(category) || 0;
      const previousTotal = previousMap.get(category) || 0;
      const changeAmount = currentTotal - previousTotal;
      const changePercent =
        previousTotal > 0 ? (changeAmount / previousTotal) * 100 : null;

      return {
        category,
        currentTotal,
        previousTotal,
        changeAmount,
        changePercent,
      };
    })
    .sort((left, right) => right.currentTotal - left.currentTotal);
}

function normalizePositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function normalizeOptionalPositiveInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeCategory(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized || normalized === 'uncategorized') {
    return null;
  }

  return normalized;
}

module.exports = {
  ensureTransactionsTable,
  insertTransactions,
  getTransactionAnalysisData,
  listTransactions,
  updateTransactionCategory,
};
