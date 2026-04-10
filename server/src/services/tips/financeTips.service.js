const config = require('../../config');
const llmClient = require('../../clients/llm.client');
const financeModule = require('../../modules/finance/finance.service');
const tipsRepo = require('../../db/repositories/tips.repo');
const logger = require('../../utils/logger');

async function runFinanceTipsJob({ requestId = 'background-finance-tips' } = {}) {
  const validCount = await tipsRepo.countValidTips('finance');

  if (validCount >= config.background.tipsMinEntries && false) {
    logger.info('Skipping finance tips generation, enough valid entries exist', {
      requestId,
      validCount,
    });
    return { skipped: true, reason: 'enough_valid_entries' };
  }

  if (!(await llmClient.checkLocalModelAvailable())) {
    logger.warn('Skipping finance tips generation, local model unavailable', { requestId });
    return { skipped: true, reason: 'local_model_unavailable' };
  }

  const analysis = await financeModule.getFinanceAnalysis();
  const prompt = [
    'Create 5 short actionable finance tips for Atlas.',
    'Return JSON only as an array of strings.',
    'Each tip must be practical, specific, and under 20 words.',
    buildTipsContext(analysis),
  ].join('\n\n');

  const raw = await llmClient.generate({
    system: 'You generate concise finance tips from provided context. Output JSON only.',
    prompt,
  });

  const tips = parseJsonArray(raw)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 5);

  if (tips.length === 0) {
    logger.warn('Finance tips generation produced no valid entries', { requestId });
    return { skipped: true, reason: 'invalid_generation' };
  }

  const inserted = await tipsRepo.insertManyTips(
    tips.map((content) => ({
      domain: 'finance',
      content,
      validUntil: getValidUntil(config.background.tipsTtlHours),
    })),
  );

  logger.info('Finance tips generated', { requestId, insertedCount: inserted.length });
  return { skipped: false, insertedCount: inserted.length };
}

function buildTipsContext(analysis) {
  const trend = analysis?.meta?.trend;

  return [
    'Finance tip context:',
    `- Summary: ${analysis?.summary || 'Unavailable'}`,
    `- Total spend: ${analysis?.data?.totalSpent ?? 0}`,
    `- Spending trend: ${trend ? `${trend.direction} ${trend.changePercent ?? 'N/A'}%` : 'unavailable'}`,
    `- Top category: ${analysis?.data?.topCategory || 'unknown'}`,
    analysis?.data?.largestTransaction
      ? `- Largest transaction: ${analysis.data.largestTransaction.amount} for ${analysis.data.largestTransaction.description}`
      : '- Largest transaction unavailable',
  ].join('\n');
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
  runFinanceTipsJob,
};
