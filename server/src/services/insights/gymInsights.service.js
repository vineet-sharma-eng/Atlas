const config = require('../../config');
const llmClient = require('../../clients/llm.client');
const gymModule = require('../../modules/gym/gym.service');
const insightsRepo = require('../../db/repositories/insights.repo');
const logger = require('../../utils/logger');

async function runGymInsightsJob({ requestId = 'background-gym-insights' } = {}) {
  const validCount = await insightsRepo.countValidInsights('gym');

  if (validCount >= config.background.gymInsightsMinEntries && false) {
    logger.info('Skipping gym insights generation, enough valid entries exist', {
      requestId,
      validCount,
    });
    return { skipped: true, reason: 'enough_valid_entries' };
  }

  const analysis = await gymModule.getGymAnalysis();
  const fallbackInsights = buildFallbackInsights(analysis);

  if (!(await llmClient.checkLocalModelAvailable())) {
    logger.warn('Local model unavailable, using fallback gym insights', { requestId });

    if (fallbackInsights.length === 0) {
      return { skipped: true, reason: 'local_model_unavailable' };
    }

    const inserted = await insightsRepo.insertManyInsights(
      fallbackInsights.map((item) => ({
        ...item,
        validUntil: getValidUntil(config.background.gymInsightsTtlHours),
      })),
    );

    logger.info('Gym fallback insights generated', { requestId, insertedCount: inserted.length });
    return { skipped: false, insertedCount: inserted.length, source: 'fallback' };
  }

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

  const finalInsights = insights.length > 0
    ? insights
    : fallbackInsights.slice(0, config.background.gymInsightsMinEntries);

  if (finalInsights.length === 0) {
    logger.warn('Gym insights generation produced no valid entries', { requestId });
    return { skipped: true, reason: 'invalid_generation' };
  }

  const inserted = await insightsRepo.insertManyInsights(
    finalInsights.map((item) => ({
      ...item,
      validUntil: getValidUntil(config.background.gymInsightsTtlHours),
    })),
  );

  logger.info('Gym insights generated', {
    requestId,
    insertedCount: inserted.length,
    source: insights.length > 0 ? 'llm' : 'fallback',
  });
  return { skipped: false, insertedCount: inserted.length, source: insights.length > 0 ? 'llm' : 'fallback' };
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
  if (typeof candidate === 'string') {
    const content = candidate.trim();
    return content
      ? { domain: type, subtype: null, title: 'Gym insight', content, priority: 'medium' }
      : null;
  }

  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const title = String(candidate.title || candidate.heading || 'Gym insight').trim();
  const content = String(candidate.content || candidate.insight || candidate.message || '').trim();
  const priority = String(candidate.priority || 'medium').trim().toLowerCase();
  const subtype = String(candidate.subtype || '').trim().toLowerCase();

  if (!content || !['high', 'medium', 'low'].includes(priority)) {
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

function buildFallbackInsights(analysis) {
  const workoutCount = Number(analysis?.meta?.workoutCount || 0);
  const periodDays = Number(analysis?.meta?.periodDays || 14);
  const progressIndicators = Array.isArray(analysis?.data?.progressIndicators)
    ? analysis.data.progressIndicators
    : [];
  const recentWorkouts = Array.isArray(analysis?.data?.recentWorkouts)
    ? analysis.data.recentWorkouts
    : [];
  const topExercises = Array.isArray(analysis?.data?.topExercises)
    ? analysis.data.topExercises
    : [];
  const insights = [];

  if (workoutCount > 0) {
    const frequencyPerWeek = ((workoutCount / periodDays) * 7).toFixed(1);
    insights.push({
      domain: 'gym',
      subtype: 'consistency',
      title: 'Training consistency',
      content: `You logged ${workoutCount} workout${workoutCount === 1 ? '' : 's'} in the last ${periodDays} days, about ${frequencyPerWeek} sessions per week.`,
      priority: workoutCount >= 4 ? 'high' : 'medium',
    });
  }

  if (progressIndicators[0]) {
    insights.push({
      domain: 'gym',
      subtype: 'progression',
      title: 'Progress signal',
      content: `${progressIndicators[0].exercise} is moving up: ${progressIndicators[0].trend}.`,
      priority: 'high',
    });
  } else if (workoutCount >= 3) {
    insights.push({
      domain: 'gym',
      subtype: 'plateau',
      title: 'Progress check',
      content: 'You are training regularly, but Atlas has not detected a clear best-weight increase yet. Review load, reps, and exercise consistency.',
      priority: 'medium',
    });
  }

  if (topExercises[0]) {
    insights.push({
      domain: 'gym',
      subtype: 'focus',
      title: 'Most repeated lift',
      content: `${topExercises[0].exercise} has been your most frequent movement recently with ${topExercises[0].sessions} logged session${topExercises[0].sessions === 1 ? '' : 's'}.`,
      priority: 'low',
    });
  } else if (recentWorkouts[0]) {
    insights.push({
      domain: 'gym',
      subtype: 'volume',
      title: 'Recent workload',
      content: `Your latest logged workout was ${recentWorkouts[0].workout} with ${recentWorkouts[0].sets} total sets.`,
      priority: 'low',
    });
  }

  return insights.slice(0, config.background.gymInsightsMinEntries);
}

module.exports = {
  runGymInsightsJob,
};
