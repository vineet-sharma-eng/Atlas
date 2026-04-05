const config = require('../../config');
const llmClient = require('../../clients/llm.client');
const gymModule = require('../../modules/gym/gym.service');
const insightsRepo = require('../../db/repositories/insights.repo');
const logger = require('../../utils/logger');

async function runGymInsightsJob({ requestId = 'background-gym-insights' } = {}) {
  const validCount = await insightsRepo.countValidInsights('gym');

  if (validCount >= config.background.gymInsightsMinEntries) {
    logger.info('Skipping gym insights generation, enough valid entries exist', {
      requestId,
      validCount,
    });
    return { skipped: true, reason: 'enough_valid_entries' };
  }

  if (!(await llmClient.checkLocalModelAvailable())) {
    logger.warn('Skipping gym insights generation, local model unavailable', { requestId });
    return { skipped: true, reason: 'local_model_unavailable' };
  }

  const analysis = await gymModule.getGymAnalysis();
  const prompt = [
    'Create 3 gym insights for Atlas.',
    'Return JSON only as an array of objects.',
    'Each object must contain title, content, and priority.',
    'priority must be high, medium, or low.',
    'Focus on consistency, progression, and plateaus.',
    buildGymContext(analysis),
  ].join('\n\n');

  const raw = await llmClient.generate({
    system: 'You generate structured gym insights from provided context. Output JSON only.',
    prompt,
  });

  const insights = parseJsonArray(raw)
    .map((item) => normalizeInsight(item, 'gym'))
    .filter(Boolean)
    .slice(0, config.background.gymInsightsMinEntries);

  if (insights.length === 0) {
    logger.warn('Gym insights generation produced no valid entries', { requestId });
    return { skipped: true, reason: 'invalid_generation' };
  }

  const inserted = await insightsRepo.insertManyInsights(
    insights.map((item) => ({
      ...item,
      validUntil: getValidUntil(config.background.gymInsightsTtlHours),
    })),
  );

  logger.info('Gym insights generated', { requestId, insertedCount: inserted.length });
  return { skipped: false, insertedCount: inserted.length };
}

function buildGymContext(analysis) {
  const progressLines = Array.isArray(analysis?.data?.progressIndicators)
    ? analysis.data.progressIndicators.slice(0, 3).map((item) => `- ${item.exercise}: ${item.trend}`).join('\n')
    : '- No progression data';

  return [
    'Gym context:',
    `- Summary: ${analysis?.summary || 'Unavailable'}`,
    `- Workout frequency: ${analysis?.meta?.workoutCount ?? 0} workouts over ${analysis?.meta?.periodDays ?? 0} days`,
    `- Consistency level: ${deriveConsistencyLevel(analysis?.meta?.workoutCount || 0)}`,
    `- Plateau signal: ${analysis?.data?.progressIndicators?.length ? 'some progression is present' : 'possible plateau or weak progression'}`,
    '- Progress indicators:',
    progressLines,
  ].join('\n');
}

function deriveConsistencyLevel(workoutCount) {
  if (workoutCount >= 6) return 'high';
  if (workoutCount >= 3) return 'moderate';
  return 'low';
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
  runGymInsightsJob,
};
