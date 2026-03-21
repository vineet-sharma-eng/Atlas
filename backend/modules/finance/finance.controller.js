const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const { getTransactionAnalysisData, insertTransactions } = require('../../db/transactions');
const { generate } = require('../../services/ai/ollama');
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
    });
    const insights = await generate(prompt);
    const summary = buildSummary(
      analysisData.totalSpent,
      topCategory,
      analysisData.largestTransaction,
      anomalies
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

  return [
    'You are analyzing personal finance data for Atlas.',
    `Use only the structured information below for the ${periodLabel}.`,
    '',
    `Total spend: ${toCurrencyValue(totalSpent)}`,
    `Average transaction amount: ${toCurrencyValue(averageAmount)}`,
    '',
    'Top categories:',
    topCategories || '- No category data',
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

function buildSummary(totalSpent, topCategory, largestTransaction, anomalies) {
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

module.exports = {
  importPdf,
  getAnalysis,
};
