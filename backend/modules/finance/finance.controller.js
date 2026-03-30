const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const { getTransactionAnalysisData, insertTransactions } = require('../../db/transactions');
const { getLatestInsights } = require('../../db/insights');
const { generate } = require('../../services/ai/ollama');
const { generateFinanceInsights } = require('../../services/insights/financeInsights');
const { parseGooglePayTransactions } = require('../../services/parser/googlePayTransactionParser');
const { extractPdfText } = require('../../services/parser/pdfExtractor');
const { parseMultipartFormData } = require('../../utils/multipart');

const SOURCE_NAME = 'google-pay-pdf';

async function importPdf(req, res, next) {
  let tempFilePath;
  let tempDirPath;

  try {
    const upload = await parseMultipartFormData(req, {
      fieldName: 'file',
      maxFileSizeBytes: 10 * 1024 * 1024,
    });

    if (!upload.file) {
      return res.status(400).json({ error: 'Missing file field in multipart form data' });
    }

    if (!isPdfUpload(upload.file)) {
      return res.status(400).json({ error: 'Only PDF files are supported' });
    }

    tempDirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-finance-'));
    tempFilePath = path.join(tempDirPath, upload.file.filename);
    await fs.writeFile(tempFilePath, upload.file.buffer);

    const extractedText = await extractPdfText(tempFilePath);

    if (!extractedText) {
      return res.status(422).json({ error: 'PDF text extraction returned no content' });
    }

    const transactions = parseGooglePayTransactions(extractedText);

    if (transactions.length === 0) {
      return res.status(422).json({
        error: 'Failed to parse any transactions from the PDF',
        extractedTextPreview: extractedText.slice(0, 1000),
      });
    }

    const { inserted, duplicates } = await insertTransactions(transactions, SOURCE_NAME);

    return res.status(200).json({
      source: SOURCE_NAME,
      filename: upload.file.originalName,
      extractedCharacters: extractedText.length,
      parsedCount: transactions.length,
      insertedCount: inserted.length,
      duplicateCount: duplicates.length,
      duplicates,
      transactions,
    });
  } catch (error) {
    if (error.code === 'INVALID_MULTIPART') {
      return res.status(400).json({ error: error.message });
    }

    if (error.code === 'FILE_TOO_LARGE') {
      return res.status(413).json({ error: error.message });
    }

    if (error.name === 'InvalidPDFException' || error.name === 'FormatError') {
      return res.status(400).json({ error: 'Invalid or unreadable PDF file' });
    }

    return next(error);
  } finally {
    if (tempFilePath) {
      await fs.rm(tempFilePath, { force: true }).catch(() => {});
    }

    if (tempDirPath) {
      await fs.rm(tempDirPath, { recursive: true, force: true }).catch(() => {});
    }
  }
}

function isPdfUpload(file) {
  const contentTypeLooksValid = /application\/pdf/i.test(file.contentType || '');
  const nameLooksValid = /\.pdf$/i.test(file.originalName || '');
  const signatureLooksValid = file.buffer.subarray(0, 4).toString('utf8') === '%PDF';

  return signatureLooksValid || contentTypeLooksValid || nameLooksValid;
}

async function getAnalysis(req, res, next) {
  try {
    const days = parseDays(req.query.days);
    const analysisData = await getTransactionAnalysisData(days);

    if (analysisData.stats.transactionCount === 0) {
      return res.status(200).json({
        summary: 'No transactions found for the selected period.',
        insights: 'There is not enough finance data yet to analyze.',
        meta: {
          total_spent: 0,
          top_categories: [],
          top_category: null,
          largest_transaction: null,
          anomaly_threshold: 0,
          anomalies: [],
          transfer_count: analysisData.transferCount || 0,
          comparison: analysisData.comparison,
          category_trends: [],
          days,
        },
      });
    }

    const anomalies = findAnomalies(
      analysisData.recentTransactions,
      analysisData.stats.averageAmount
    );
    const topCategory = analysisData.categoryBreakdown[0] || null;
    const prompt = buildFinanceAnalysisPrompt({
      days,
      totalSpent: analysisData.totalSpent,
      categoryBreakdown: analysisData.categoryBreakdown,
      recentTransactions: analysisData.recentTransactions,
      largestTransaction: analysisData.largestTransaction,
      averageAmount: analysisData.stats.averageAmount,
      anomalies,
      transferCount: analysisData.transferCount,
      comparison: analysisData.comparison,
      categoryTrends: analysisData.categoryTrends,
    });
    const insights = await generate(prompt);
    const summary = buildSummary(
      analysisData.totalSpent,
      topCategory,
      analysisData.largestTransaction,
      anomalies,
      analysisData.comparison
    );

    return res.status(200).json({
      summary,
      insights,
      meta: {
        total_spent: analysisData.totalSpent,
        top_categories: analysisData.categoryBreakdown.slice(0, 5),
        top_category: topCategory,
        largest_transaction: analysisData.largestTransaction,
        anomaly_threshold: toCurrencyValue(analysisData.stats.averageAmount * 2),
        anomalies,
        transfer_count: analysisData.transferCount,
        comparison: analysisData.comparison,
        category_trends: analysisData.categoryTrends.slice(0, 10),
        days,
      },
    });
  } catch (error) {
    return next(error);
  }
}

function parseDays(value) {
  if (value === undefined) {
    return null;
  }

  const days = Number.parseInt(value, 10);

  if (!Number.isInteger(days) || days <= 0) {
    const error = new Error('days must be a positive integer');
    error.statusCode = 400;
    throw error;
  }

  return days;
}

function buildFinanceAnalysisPrompt({
  days,
  totalSpent,
  categoryBreakdown,
  recentTransactions,
  largestTransaction,
  averageAmount,
  anomalies,
  transferCount,
  comparison,
  categoryTrends,
}) {
  const periodLabel = days ? `last ${days} days` : 'all available transaction history';
  const topCategories = categoryBreakdown
    .slice(0, 5)
    .map((item) => `- ${item.category}: ${toCurrencyValue(item.total)}`)
    .join('\n');
  const recentItems = recentTransactions
    .slice(0, 10)
    .map(
      (item) =>
        `- ${item.date}: ${item.description} (${toCurrencyValue(item.amount)})`
    )
    .join('\n');
  const anomalyItems = anomalies.length
    ? anomalies
        .map(
          (item) =>
            `- ${item.date}: ${item.description} (${toCurrencyValue(item.amount)})`
        )
        .join('\n')
    : '- No obvious high-value anomalies detected';
  const trendText = comparison
    ? `Current period spend: ${toCurrencyValue(totalSpent)}
Previous comparable period spend: ${toCurrencyValue(comparison.previousTotalSpent)}
Change: ${formatSignedAmount(comparison.changeAmount)} (${formatPercentage(
        comparison.changePercent
      )})`
    : '- No period-over-period comparison available';
  const categoryTrendText = categoryTrends.length
    ? categoryTrends
        .slice(0, 10)
        .map(
          (item) =>
            `- ${item.category}: ${toCurrencyValue(item.currentTotal)} vs ${toCurrencyValue(
              item.previousTotal
            )} (${formatSignedAmount(item.changeAmount)}, ${formatPercentage(
              item.changePercent
            )})`
        )
        .join('\n')
    : '- No category trend data available';

  return [
    'You are analyzing personal finance data for Atlas.',
    `Use only the structured information below for the ${periodLabel}.`,
    'Ignore transfers; only analyze real expenses.',
    `Excluded transfers from analysis: ${transferCount || 0}.`,
    'Explain trends clearly using numbers. Focus on what changed week-over-week.',
    '',
    `Total spend: ${toCurrencyValue(totalSpent)}`,
    `Average transaction amount: ${toCurrencyValue(averageAmount)}`,
    '',
    'Trend comparison:',
    trendText,
    '',
    'Top categories:',
    topCategories || '- No category data',
    '',
    'Category trends:',
    categoryTrendText,
    '',
    'Recent transactions:',
    recentItems || '- No recent transactions',
    '',
    'Largest transaction:',
    largestTransaction
      ? `- ${largestTransaction.date}: ${largestTransaction.description} (${toCurrencyValue(
          largestTransaction.amount
        )}) in ${largestTransaction.category || 'uncategorized'}`
      : '- No transaction found',
    '',
    'Potential anomalies:',
    anomalyItems,
    '',
    'Provide:',
    '1. Spending patterns',
    '2. Category insights',
    '3. Unusual behavior',
    '4. Actionable suggestions',
    '',
    'Keep the analysis concise but useful.',
  ].join('\n');
}

function buildSummary(
  totalSpent,
  topCategory,
  largestTransaction,
  anomalies,
  comparison
) {
  const parts = [`Total spend is ${toCurrencyValue(totalSpent)}`];

  if (topCategory) {
    parts.push(
      `top category is ${topCategory.category} at ${toCurrencyValue(topCategory.total)}`
    );
  }

  if (largestTransaction) {
    parts.push(
      `largest transaction is ${toCurrencyValue(largestTransaction.amount)} for ${largestTransaction.description}`
    );
  }

  if (anomalies.length > 0) {
    parts.push(`${anomalies.length} high-value transaction(s) stand out`);
  }

  if (comparison) {
    parts.push(
      `period-over-period change is ${formatSignedAmount(
        comparison.changeAmount
      )} (${formatPercentage(comparison.changePercent)})`
    );
  }

  return `${parts.join(', ')}.`;
}

function findAnomalies(transactions, averageAmount) {
  const threshold = averageAmount * 2;

  if (threshold <= 0) {
    return [];
  }

  return transactions
    .filter((transaction) => transaction.amount >= threshold)
    .slice(0, 5);
}

function toCurrencyValue(value) {
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

  return `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`;
}

async function triggerInsights(req, res, next) {
  try {
    const insight = await generateFinanceInsights();

    return res.status(200).json({
      message: 'Finance insights generated successfully.',
      insight,
    });
  } catch (error) {
    return next(error);
  }
}

async function listInsights(req, res, next) {
  try {
    const insights = await getLatestInsights(10);
    return res.status(200).json(insights);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  importPdf,
  getAnalysis,
  triggerInsights,
  listInsights,
};
