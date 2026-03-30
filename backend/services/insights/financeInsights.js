const pool = require('../../db/pool');
const { insertInsight } = require('../../db/insights');
const { ensureTransactionsTable } = require('../../db/transactions');
const { generate } = require('../ai/ollama');

const INSIGHT_TYPE = 'finance_weekly';
const CURRENT_WEEK_EXPENSE_FILTER = `
  amount < 0
  AND date >= NOW() - INTERVAL '7 days'
  AND LOWER(description) NOT LIKE '%transfer%'
  AND LOWER(description) NOT LIKE '%self%'
  AND LOWER(description) NOT LIKE '%wallet%'
`;
const PREVIOUS_WEEK_EXPENSE_FILTER = `
  amount < 0
  AND date < NOW() - INTERVAL '7 days'
  AND date >= NOW() - INTERVAL '14 days'
  AND LOWER(description) NOT LIKE '%transfer%'
  AND LOWER(description) NOT LIKE '%self%'
  AND LOWER(description) NOT LIKE '%wallet%'
`;

async function generateFinanceInsights() {
  await ensureTransactionsTable();

  const categoryBreakdownResult = await pool.query(`
    SELECT COALESCE(category, 'uncategorized') AS category, SUM(ABS(amount)) AS total
    FROM transactions
    WHERE ${CURRENT_WEEK_EXPENSE_FILTER}
    GROUP BY COALESCE(category, 'uncategorized')
    ORDER BY total DESC
  `);

  const previousCategoryBreakdownResult = await pool.query(`
    SELECT COALESCE(category, 'uncategorized') AS category, SUM(ABS(amount)) AS total
    FROM transactions
    WHERE ${PREVIOUS_WEEK_EXPENSE_FILTER}
    GROUP BY COALESCE(category, 'uncategorized')
    ORDER BY total DESC
  `);

  const totalSpentResult = await pool.query(`
    SELECT COALESCE(SUM(ABS(amount)), 0) AS total_spent
    FROM transactions
    WHERE ${CURRENT_WEEK_EXPENSE_FILTER}
  `);

  const previousTotalSpentResult = await pool.query(`
    SELECT COALESCE(SUM(ABS(amount)), 0) AS total_spent
    FROM transactions
    WHERE ${PREVIOUS_WEEK_EXPENSE_FILTER}
  `);

  const largestTransactionResult = await pool.query(`
    SELECT date, amount, description, COALESCE(category, 'uncategorized') AS category
    FROM transactions
    WHERE ${CURRENT_WEEK_EXPENSE_FILTER}
    ORDER BY amount ASC, date DESC
    LIMIT 1
  `);

  const statsResult = await pool.query(`
    SELECT COALESCE(AVG(ABS(amount)), 0) AS average_amount
    FROM transactions
    WHERE ${CURRENT_WEEK_EXPENSE_FILTER}
  `);

  const transferCountResult = await pool.query(`
    SELECT COUNT(*) AS transfer_count
    FROM transactions
    WHERE date >= NOW() - INTERVAL '7 days'
      AND (
        LOWER(description) LIKE '%transfer%'
        OR LOWER(description) LIKE '%self%'
        OR LOWER(description) LIKE '%wallet%'
      )
  `);

  const totalSpent = Number(totalSpentResult.rows[0].total_spent || 0);
  const previousTotalSpent = Number(previousTotalSpentResult.rows[0].total_spent || 0);
  const categoryBreakdown = categoryBreakdownResult.rows.map((row) => ({
    category: row.category,
    total: Number(row.total || 0),
  }));
  const previousCategoryBreakdown = previousCategoryBreakdownResult.rows.map((row) => ({
    category: row.category,
    total: Number(row.total || 0),
  }));
  const topCategory = categoryBreakdown[0] || null;
  const largestTransaction = largestTransactionResult.rows[0]
    ? {
        date: largestTransactionResult.rows[0].date,
        amount: Math.abs(Number(largestTransactionResult.rows[0].amount || 0)),
        description: largestTransactionResult.rows[0].description,
        category: largestTransactionResult.rows[0].category,
      }
      : null;
  const averageAmount = Number(statsResult.rows[0].average_amount || 0);
  const transferCount = Number(transferCountResult.rows[0].transfer_count || 0);
  const spendTrend = calculateTrend(totalSpent, previousTotalSpent);
  const categoryTrends = calculateCategoryTrends(
    categoryBreakdown,
    previousCategoryBreakdown
  );

  const prompt = buildFinanceInsightsPrompt(
    totalSpent,
    previousTotalSpent,
    spendTrend,
    categoryBreakdown,
    categoryTrends,
    topCategory,
    largestTransaction,
    averageAmount,
    transferCount
  );

  const content =
    totalSpent > 0 || categoryBreakdown.length > 0
      ? await generate(prompt)
      : 'No spending data was available in the last 7 days to generate finance insights.';

  return insertInsight(INSIGHT_TYPE, content);
}

function buildFinanceInsightsPrompt(
  totalSpent,
  previousTotalSpent,
  spendTrend,
  categoryBreakdown,
  categoryTrends,
  topCategory,
  largestTransaction,
  averageAmount,
  transferCount
) {
  const categoriesText = categoryBreakdown.length
    ? categoryBreakdown
        .map((item) => `- ${item.category}: ${formatAmount(item.total)}`)
        .join('\n')
    : '- No spending categories recorded';

  const unusualThreshold = averageAmount > 0 ? averageAmount * 2 : 0;
  const categoryTrendText = categoryTrends.length
    ? categoryTrends
        .map(
          (item) =>
            `- ${item.category}: ${formatAmount(item.currentTotal)} vs ${formatAmount(
              item.previousTotal
            )} (${formatSignedAmount(item.changeAmount)}, ${formatPercentage(
              item.changePercent
            )})`
        )
        .join('\n')
    : '- No category trend data available';

  return [
    'You are generating a weekly finance insight for Atlas.',
    'Use only the structured aggregated data below. Do not assume missing data.',
    'Ignore transfers; only analyze real expenses.',
    'Explain trends clearly using numbers. Focus on what changed week-over-week.',
    '',
    `Total spent in the last 7 days: ${formatAmount(totalSpent)}`,
    `Total spent in the previous 7 days: ${formatAmount(previousTotalSpent)}`,
    `Week-over-week change: ${formatSignedAmount(spendTrend.changeAmount)} (${formatPercentage(
      spendTrend.changePercent
    )})`,
    `Excluded transfers in the last 7 days: ${transferCount}`,
    '',
    'Category breakdown:',
    categoriesText,
    '',
    'Category trends:',
    categoryTrendText,
    '',
    'Biggest expense category:',
    topCategory
      ? `- ${topCategory.category}: ${formatAmount(topCategory.total)}`
      : '- No dominant category available',
    '',
    'Largest transaction in the last 7 days:',
    largestTransaction
      ? `- ${largestTransaction.date}: ${largestTransaction.description} (${formatAmount(
          largestTransaction.amount
        )}) in ${largestTransaction.category}`
      : '- No transaction found',
    '',
    'Potential unusual spend threshold:',
    `- ${formatAmount(unusualThreshold)}`,
    '',
    'Please provide:',
    '1. Key spending patterns',
    '2. Biggest expense category',
    '3. Unusual spending behavior',
    '4. Actionable financial advice',
    '',
    'Keep it concise and practical.',
  ].join('\n');
}

function formatAmount(value) {
  return Number(value || 0).toFixed(2);
}

function formatSignedAmount(value) {
  const amount = Number(value || 0);
  return `${amount >= 0 ? '+' : '-'}${Math.abs(amount).toFixed(2)}`;
}

function formatPercentage(value) {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function calculateTrend(currentTotal, previousTotal) {
  const changeAmount = currentTotal - previousTotal;
  const changePercent =
    previousTotal > 0 ? (changeAmount / previousTotal) * 100 : null;

  return {
    changeAmount,
    changePercent,
  };
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
  generateFinanceInsights,
};
