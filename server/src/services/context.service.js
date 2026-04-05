function buildContext({ intent, financeAnalysis, gymAnalysis }) {
  switch (intent) {
    case 'finance':
      return buildFinanceContext(financeAnalysis);
    case 'gym':
      return buildGymContext(gymAnalysis);
    default:
      return buildGeneralContext({ financeAnalysis, gymAnalysis });
  }
}

function buildFinanceContext(analysis) {
  if (!analysis || !analysis.data) {
    return [
      '- Finance data is currently unavailable.',
    ].join('\n');
  }

  const breakdown = Array.isArray(analysis.data.categoryBreakdown)
    ? analysis.data.categoryBreakdown.map((item) => `- ${item.category}: ${formatNumber(item.total)}`)
    : [];
  const trends = [];

  if (analysis.meta?.periodDays) {
    trends.push(`- Analysis window: last ${analysis.meta.periodDays} days`);
  }

  if (analysis.meta?.transactionCount !== undefined) {
    trends.push(`- Transactions analyzed: ${analysis.meta.transactionCount}`);
  }

  if (analysis.meta?.trend) {
    const changePercent = analysis.meta.trend.changePercent === null
      ? 'N/A'
      : `${Number(analysis.meta.trend.changePercent).toFixed(1)}%`;
    trends.push(
      `- Spending trend: ${analysis.meta.trend.direction} ${changePercent} versus previous period (change ${formatNumber(analysis.meta.trend.changeAmount)})`,
    );
  }

  return [
    'Finance context:',
    `- Summary: ${analysis.summary || 'No finance summary available.'}`,
    `- Total spend: ${formatNumber(analysis.data.totalSpent)}`,
    `- Top category: ${analysis.data.topCategory || 'unknown'}`,
    analysis.data.largestTransaction
      ? `- Largest transaction: ${formatNumber(analysis.data.largestTransaction.amount)} for ${analysis.data.largestTransaction.description} on ${analysis.data.largestTransaction.date}`
      : '- Largest transaction: unavailable',
    '- Category breakdown:',
    ...(breakdown.length > 0 ? breakdown : ['- No category breakdown available']),
    '- Trends:',
    ...(trends.length > 0 ? trends : ['- No finance trends available']),
  ].join('\n');
}

function buildGymContext(analysis) {
  if (!analysis || !analysis.data) {
    return [
      '- Gym data is currently unavailable.',
    ].join('\n');
  }

  const topExercises = Array.isArray(analysis.data.topExercises)
    ? analysis.data.topExercises.map(
        (item) => `- ${item.exercise}: ${item.sessions} sessions, ${item.sets} sets, best weight ${formatNullable(item.bestWeight)}`,
      )
    : [];
  const progressIndicators = Array.isArray(analysis.data.progressIndicators)
    ? analysis.data.progressIndicators.map((item) => `- ${item.exercise}: ${item.trend}`)
    : [];
  const recentWorkouts = Array.isArray(analysis.data.recentWorkouts)
    ? analysis.data.recentWorkouts.map(
        (item) => `- ${item.date}: ${item.workout}, ${item.exercises} exercises, ${item.sets} sets, volume ${formatNumber(item.totalVolume)}`,
      )
    : [];

  return [
    'Gym context:',
    `- Summary: ${analysis.summary || 'No gym summary available.'}`,
    analysis.meta?.periodDays ? `- Analysis window: last ${analysis.meta.periodDays} days` : '- Analysis window: unavailable',
    analysis.meta?.workoutCount !== undefined ? `- Workout frequency: ${analysis.meta.workoutCount} workouts` : '- Workout frequency: unavailable',
    '- Exercise progress:',
    ...(progressIndicators.length > 0 ? progressIndicators : ['- No exercise progress signals available']),
    '- Potential plateaus:',
    ...(progressIndicators.length === 0 ? ['- No recent strength increases detected in the available window'] : ['- No clear plateaus detected among improving exercises']),
    '- Top exercises:',
    ...(topExercises.length > 0 ? topExercises : ['- No exercise frequency data available']),
    '- Recent workouts:',
    ...(recentWorkouts.length > 0 ? recentWorkouts : ['- No recent workout summaries available']),
  ].join('\n');
}

function buildGeneralContext({ financeAnalysis, gymAnalysis }) {
  return [
    buildFinanceContext(financeAnalysis),
    '',
    buildGymContext(gymAnalysis),
  ].join('\n');
}

function formatNumber(value) {
  return Number(value || 0).toFixed(2);
}

function formatNullable(value) {
  return value === null || value === undefined ? 'N/A' : formatNumber(value);
}

module.exports = {
  buildContext,
};
