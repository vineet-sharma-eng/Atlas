const config = require('../../config');
const llmClient = require('../../clients/llm.client');
const gymModule = require('../../modules/gym/gym.service');
const tipsRepo = require('../../db/repositories/tips.repo');
const logger = require('../../utils/logger');

async function runGymTipsJob({ requestId = 'background-gym-tips' } = {}) {
  const validCount = await tipsRepo.countValidTips('gym');

  if (validCount >= config.background.tipsMinEntries) {
    logger.info('Skipping gym tips generation, enough valid entries exist', {
      requestId,
      validCount,
    });
    return { skipped: true, reason: 'enough_valid_entries' };
  }

  if (!(await llmClient.checkLocalModelAvailable())) {
    logger.warn('Skipping gym tips generation, local model unavailable', { requestId });
    return { skipped: true, reason: 'local_model_unavailable' };
  }

  const analysis = await gymModule.getGymAnalysis();
  const prompt = [
    'Create 5 short actionable gym tips for Atlas.',
    'Return JSON only as an array of strings.',
    'Each tip must be practical, specific, and under 20 words.',
    buildTipsContext(analysis),
  ].join('\n\n');

  const raw = await llmClient.generate({
    system: 'You generate concise gym tips from provided context. Output JSON only.',
    prompt,
  });

  const tips = parseJsonArray(raw)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 5);

  if (tips.length === 0) {
    logger.warn('Gym tips generation produced no valid entries', { requestId });
    return { skipped: true, reason: 'invalid_generation' };
  }

  const inserted = await tipsRepo.insertManyTips(
    tips.map((content) => ({
      type: 'gym',
      content,
      validUntil: getValidUntil(config.background.tipsTtlHours),
    })),
  );

  logger.info('Gym tips generated', { requestId, insertedCount: inserted.length });
  return { skipped: false, insertedCount: inserted.length };
}

function buildTipsContext(analysis) {
  return [
    'Gym tip context:',
    `- Summary: ${analysis?.summary || 'Unavailable'}`,
    `- Workout frequency: ${analysis?.meta?.workoutCount ?? 0}`,
    `- Consistency level: ${deriveConsistencyLevel(analysis?.meta?.workoutCount || 0)}`,
    `- Plateau signal: ${analysis?.data?.progressIndicators?.length ? 'progress exists' : 'possible plateau'}`,
  ].join('\n');
}

function deriveConsistencyLevel(workoutCount) {
  if (workoutCount >= 6) return 'high';
  if (workoutCount >= 3) return 'moderate';
  return 'low';
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
  runGymTipsJob,
};
