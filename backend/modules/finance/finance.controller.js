const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const { getTransactionAnalysisData, insertTransactions } = require('../../db/transactions');
const { getLatestInsights } = require('../../db/insights');
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
    const days = parseDays(req.query.days, 7);
    const analysisData = await getTransactionAnalysisData(days);
    const topCategory = analysisData.categoryBreakdown[0] || null;

    if (analysisData.stats.transactionCount === 0) {
      return res.status(200).json({
        summary: `No spending found in the last ${days} days.`,
        data: {
          totalSpent: 0,
          topCategory: null,
          categoryBreakdown: [],
          largestTransaction: null,
        },
        meta: {
          periodDays: days,
          transactionCount: 0,
        },
      });
    }

    const summary = buildFinanceSummary({
      days,
      totalSpent: analysisData.totalSpent,
      topCategory,
      comparison: analysisData.comparison,
      largestTransaction: analysisData.largestTransaction,
    });

    return res.status(200).json({
      summary,
      data: {
        totalSpent: roundCurrency(analysisData.totalSpent),
        topCategory: topCategory ? topCategory.category : null,
        categoryBreakdown: analysisData.categoryBreakdown.slice(0, 5).map((item) => ({
          category: item.category,
          total: roundCurrency(item.total),
        })),
        largestTransaction: analysisData.largestTransaction
          ? {
              amount: roundCurrency(analysisData.largestTransaction.amount),
              description: analysisData.largestTransaction.description,
              date: analysisData.largestTransaction.date,
            }
          : null,
      },
      meta: {
        periodDays: days,
        transactionCount: analysisData.stats.transactionCount,
      },
    });
  } catch (error) {
    return next(error);
  }
}

function parseDays(value, defaultDays) {
  if (value === undefined) {
    return defaultDays;
  }

  const days = Number.parseInt(value, 10);

  if (!Number.isInteger(days) || days <= 0) {
    const error = new Error('days must be a positive integer');
    error.statusCode = 400;
    throw error;
  }

  return days;
}

function buildFinanceSummary({
  days,
  totalSpent,
  topCategory,
  comparison,
  largestTransaction,
}) {
  const parts = [`Spent ${formatCurrency(totalSpent)} in the last ${days} days`];

  if (topCategory) {
    parts.push(`top category was ${topCategory.category} (${formatCurrency(topCategory.total)})`);
  }

  if (comparison && comparison.changePercent !== null) {
    const direction = comparison.changeAmount > 0 ? 'up' : comparison.changeAmount < 0 ? 'down' : 'flat';
    parts.push(`${direction} ${formatPercentage(Math.abs(comparison.changePercent))} versus the previous period`);
  }

  if (largestTransaction) {
    parts.push(`largest expense was ${formatCurrency(largestTransaction.amount)} for ${largestTransaction.description}`);
  }

  return `${parts.join(', ')}.`;
}

function roundCurrency(value) {
  return Number(Number(value || 0).toFixed(2));
}

function formatCurrency(value) {
  return roundCurrency(value).toFixed(2);
}

function formatPercentage(value) {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  return `${Number(value).toFixed(1)}%`;
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
