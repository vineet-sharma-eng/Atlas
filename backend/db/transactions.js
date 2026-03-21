const pool = require('./pool');

let schemaReadyPromise;

async function ensureTransactionsTable() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = pool.query(`
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
  }

  return schemaReadyPromise;
}

async function insertTransactions(transactions, source) {
  await ensureTransactionsTable();

  const inserted = [];
  const duplicates = [];

  for (const transaction of transactions) {
    const duplicateResult = await pool.query(
      `
        SELECT id
        FROM transactions
        WHERE date = $1
          AND amount = $2
          AND description = $3
          AND source = $4
        LIMIT 1
      `,
      [
        transaction.date,
        transaction.amount,
        transaction.description,
        source,
      ]
    );

    if (duplicateResult.rowCount > 0) {
      duplicates.push(transaction);
      continue;
    }

    const insertResult = await pool.query(
      `
        INSERT INTO transactions (date, amount, category, description, source)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, date, amount, category, description, source, created_at
      `,
      [
        transaction.date,
        transaction.amount,
        transaction.category || null,
        transaction.description,
        source,
      ]
    );

    inserted.push(insertResult.rows[0]);
  }

  return {
    inserted,
    duplicates,
  };
}

async function getTransactionAnalysisData(days) {
  await ensureTransactionsTable();

  const values = [];
  const whereClause = buildDaysWhereClause(days, values);

  const totalSpentResult = await pool.query(
    `
      SELECT COALESCE(SUM(amount), 0) AS total_spent
      FROM transactions
      ${whereClause}
    `,
    values
  );

  const categoryBreakdownResult = await pool.query(
    `
      SELECT COALESCE(category, 'uncategorized') AS category, SUM(amount) AS total
      FROM transactions
      ${whereClause}
      GROUP BY COALESCE(category, 'uncategorized')
      ORDER BY total DESC
    `,
    values
  );

  const recentTransactionsResult = await pool.query(
    `
      SELECT date, amount, description
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
      ORDER BY amount DESC, date DESC
      LIMIT 1
    `,
    values
  );

  const statsResult = await pool.query(
    `
      SELECT
        COUNT(*) AS transaction_count,
        COALESCE(AVG(amount), 0) AS average_amount,
        COALESCE(MAX(amount), 0) AS max_amount
      FROM transactions
      ${whereClause}
    `,
    values
  );

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
          amount: Number(largestTransactionResult.rows[0].amount || 0),
          description: largestTransactionResult.rows[0].description,
          category: largestTransactionResult.rows[0].category || 'uncategorized',
        }
      : null,
    stats: {
      transactionCount: Number(statsResult.rows[0].transaction_count || 0),
      averageAmount: Number(statsResult.rows[0].average_amount || 0),
      maxAmount: Number(statsResult.rows[0].max_amount || 0),
    },
  };
}

function buildDaysWhereClause(days, values) {
  if (!Number.isInteger(days) || days <= 0) {
    return '';
  }

  values.push(days);
  return `WHERE date >= NOW() - ($1::text || ' days')::interval`;
}

module.exports = {
  ensureTransactionsTable,
  insertTransactions,
  getTransactionAnalysisData,
};
