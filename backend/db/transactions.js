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
    const hash = generateTransactionHash(
      transaction.date,
      transaction.amount,
      transaction.description
    );

    const insertResult = await pool.query(
      `
        INSERT INTO transactions (date, amount, category, description, source, hash)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (hash) DO NOTHING
        RETURNING id, date, amount, category, description, source, hash, created_at
      `,
      [
        transaction.date,
        transaction.amount,
        transaction.category || null,
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

function buildExpenseWhereClause(days, values) {
  const conditions = [
    'amount < 0',
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
    WHERE amount < 0
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

module.exports = {
  ensureTransactionsTable,
  insertTransactions,
  getTransactionAnalysisData,
};
