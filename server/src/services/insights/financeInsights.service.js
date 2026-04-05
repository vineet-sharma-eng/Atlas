const config = require('../../config');
const llmClient = require('../../clients/llm.client');
const financeModule = require('../../modules/finance/finance.service');
const insightsRepo = require('../../db/repositories/insights.repo');
const logger = require('../../utils/logger');

async function runFinanceInsightsJob({ requestId = 'background-finance' } = {}) {
  const validCount = await insightsRepo.countValidInsights('finance');

  if (validCount >= config.background.financeInsightsMinEntries) {
    logger.info('Skipping finance insights generation, enough valid entries exist', {
      requestId,
      validCount,
    });
    return { skipped: true, reason: 'enough_valid_entries' };
  }

  if (!(await llmClient.checkLocalModelAvailable())) {
    logger.warn('Skipping finance insights generation, local model unavailable', { requestId });
    return { skipped: true, reason: 'local_model_unavailable' };
  }

  const analysis = await financeModule.getFinanceAnalysis();
  const prompt = [
    'Create 3 finance insights for Atlas.',
    'Return JSON only as an array of objects.',
    'Each object must contain title, content, and priority.',
    'priority must be high, medium, or low.',
    'Keep each content practical, concise, and grounded in the context.',
    buildFinanceContext(analysis),
  ].join('\n\n');

  const raw = await llmClient.generate({
    system: 'You generate structured finance insights from provided context. Output JSON only.',
    prompt,
  });

  const insights = parseJsonArray(raw)
    .map((item) => normalizeInsight(item, 'finance'))
    .filter(Boolean)
    .slice(0, config.background.financeInsightsMinEntries);

  if (insights.length === 0) {
    logger.warn('Finance insights generation produced no valid entries', { requestId });
    return { skipped: true, reason: 'invalid_generation' };
  }

  const inserted = await insightsRepo.insertManyInsights(
    insights.map((item) => ({
      ...item,
      validUntil: getValidUntil(config.background.financeInsightsTtlHours),
    })),
  );

  logger.info('Finance insights generated', { requestId, insertedCount: inserted.length });
  return { skipped: false, insertedCount: inserted.length };
}

function buildFinanceContext(analysis) {
  const trend = analysis?.meta?.trend;
  const categoryLines = Array.isArray(analysis?.data?.categoryBreakdown)
    ? analysis.data.categoryBreakdown.slice(0, 3).map((item) => `- ${item.category}: ${item.total}`).join('\n')
    : '- No category data';

  return [
    'Finance context:',
    `- Summary: ${analysis?.summary || 'Unavailable'}`,
    `- Total spend: ${analysis?.data?.totalSpent ?? 0}`,
    `- Spending trend: ${trend ? `${trend.direction} ${trend.changePercent ?? 'N/A'}%` : 'unavailable'}`,
    `- Top category: ${analysis?.data?.topCategory || 'unknown'}`,
    analysis?.data?.largestTransaction
      ? `- Largest transaction: ${analysis.data.largestTransaction.amount} for ${analysis.data.largestTransaction.description}`
      : '- Largest transaction unavailable',
    '- Category breakdown:',
    categoryLines,
    `- Data completeness: ${trend ? 'moderate, spending covered but income and savings missing' : 'limited'}`,
  ].join('\n');
}

function normalizeInsight(candidate, type) {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const title = String(candidate.title || '').trim();
  const content = String(candidate.content || '').trim();
  const priority = String(candidate.priority || 'medium').trim().toLowerCase();
  const subtype = String(candidate.subtype || '').trim().toLowerCase();

  if (!title || !content || !['high', 'medium', 'low'].includes(priority)) {
    return null;
  }

  return { domain: type, subtype: subtype || null, title, content, priority };
}

function parseJsonArray(raw) {
  try {
    const parsed = JSON.parse(String(raw || '').trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function getValidUntil(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

module.exports = {
  runFinanceInsightsJob,
};
