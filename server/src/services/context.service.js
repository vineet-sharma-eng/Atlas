function buildContext({ intents, queryType, financeAnalysis, gymAnalysis, message }) {
  if (queryType === 'greeting' || queryType === 'smalltalk' || queryType === 'question') {
    return '';
  }

  const sections = [];

  if (intents.includes('finance')) {
    sections.push(buildFinanceContext(financeAnalysis, message));
  }

  if (intents.includes('gym')) {
    sections.push(buildGymContext(gymAnalysis, message));
  }

  return sections.filter(Boolean).join('\n\n');
}

function buildFinanceContext(analysis, message) {
  if (!analysis || !analysis.data) {
    return 'Finance context unavailable.';
  }

  const normalizedMessage = String(message || '').toLowerCase();
  const sections = ['Finance context:'];
  const derivedSignals = buildFinanceSignals(analysis);

  sections.push(`- Summary: ${analysis.summary || 'No finance summary available.'}`);
  sections.push(`- Total spend: ${formatNumber(analysis.data.totalSpent)}`);
  sections.push(`- Spending trend classification: ${derivedSignals.trendClassification}`);
  sections.push(`- Data completeness: ${derivedSignals.dataCompleteness}`);

  if (wantsCategoryDetails(normalizedMessage)) {
    sections.push(`- Top category: ${analysis.data.topCategory || 'unknown'}`);
    sections.push('- Category signals:');
    const breakdown = Array.isArray(analysis.data.categoryBreakdown)
      ? analysis.data.categoryBreakdown.slice(0, 3).map((item) => `- ${item.category}: ${formatNumber(item.total)}`)
      : [];
    sections.push(...(breakdown.length > 0 ? breakdown : ['- No category breakdown available']));
  }

  if (wantsTrends(normalizedMessage) && analysis.meta?.trend) {
    const changePercent = analysis.meta.trend.changePercent === null
      ? 'N/A'
      : `${Number(analysis.meta.trend.changePercent).toFixed(1)}%`;
    sections.push(`- Trend: ${analysis.meta.trend.direction} ${changePercent} versus the previous period`);
  }

  if (wantsAnomalies(normalizedMessage)) {
    sections.push(
      analysis.data.largestTransaction
        ? `- Notable transaction: ${formatNumber(analysis.data.largestTransaction.amount)} for ${analysis.data.largestTransaction.description} on ${analysis.data.largestTransaction.date}`
        : '- No notable transaction available',
    );
  }

  return dedupeLines(sections).join('\n');
}

function buildGymContext(analysis, message) {
  if (!analysis || !analysis.data) {
    return 'Gym context unavailable.';
  }

  const normalizedMessage = String(message || '').toLowerCase();
  const sections = ['Gym context:'];
  const derivedSignals = buildGymSignals(analysis);
  sections.push(`- Summary: ${analysis.summary || 'No gym summary available.'}`);
  sections.push(`- Consistency level: ${derivedSignals.consistencyLevel}`);
  sections.push(`- Progression signal: ${derivedSignals.progressionSignal}`);

  if (wantsProgress(normalizedMessage)) {
    const progressIndicators = Array.isArray(analysis.data.progressIndicators)
      ? analysis.data.progressIndicators.slice(0, 3).map((item) => `- ${item.exercise}: ${item.trend}`)
      : [];
    sections.push('- Progress signals:');
    sections.push(...(progressIndicators.length > 0 ? progressIndicators : ['- No exercise progress signals available']));
  }

  if (wantsPlateaus(normalizedMessage)) {
    sections.push('- Plateau signals:');
    sections.push(`- ${derivedSignals.plateauSignal}`);
  }

  if (wantsFrequency(normalizedMessage)) {
    sections.push(
      analysis.meta?.workoutCount !== undefined
        ? `- Workout frequency: ${analysis.meta.workoutCount} workouts in the last ${analysis.meta.periodDays || 'tracked'} days`
        : '- Workout frequency unavailable',
    );
  }

  return dedupeLines(sections).join('\n');
}

function formatNumber(value) {
  return Number(value || 0).toFixed(2);
}

function buildFinanceSignals(analysis) {
  const trend = analysis.meta?.trend || null;
  let trendClassification = 'stable or unavailable';

  if (trend?.direction === 'up') {
    trendClassification = 'spending increasing';
  } else if (trend?.direction === 'down') {
    trendClassification = 'spending decreasing';
  } else if (trend?.direction === 'flat') {
    trendClassification = 'spending flat';
  }

  const hasTrendData = Boolean(trend);
  const hasCategoryData = Array.isArray(analysis.data?.categoryBreakdown) && analysis.data.categoryBreakdown.length > 0;
  const hasTransactionData = Number(analysis.meta?.transactionCount || 0) > 0;
  const dataCompleteness = hasTrendData && hasCategoryData && hasTransactionData
    ? 'moderate, with spending and category coverage but no income or savings data'
    : 'limited, missing some supporting finance signals';

  return {
    trendClassification,
    dataCompleteness,
  };
}

function buildGymSignals(analysis) {
  const workoutCount = Number(analysis.meta?.workoutCount || 0);
  const progressCount = Array.isArray(analysis.data?.progressIndicators) ? analysis.data.progressIndicators.length : 0;

  let consistencyLevel = 'low';
  if (workoutCount >= 6) {
    consistencyLevel = 'high';
  } else if (workoutCount >= 3) {
    consistencyLevel = 'moderate';
  }

  const progressionSignal = progressCount > 0
    ? 'recent strength progression is present'
    : 'recent progression signal is weak';
  const plateauSignal = progressCount > 0
    ? 'Some lifts are still moving up, so no strong plateau is visible right now.'
    : 'Lack of recent progression suggests a possible plateau or insufficient training signal.';

  return {
    consistencyLevel,
    progressionSignal,
    plateauSignal,
  };
}

function wantsCategoryDetails(message) {
  return /\b(category|categories|breakdown|where|spent on)\b/.test(message) || wantsTrends(message);
}

function wantsTrends(message) {
  return /\b(trend|trends|change|changes|increase|decrease|spending|spend|budget|summary|analy[sz]e)\b/.test(message);
}

function wantsAnomalies(message) {
  return /\b(anomal|unusual|weird|largest|biggest|transaction|transactions|expense|expenses|spend|spent)\b/.test(message) || !message;
}

function wantsProgress(message) {
  return /\b(progress|improv|strong|strength|lift|lifting|performance|gym|workout|exercise)\b/.test(message) || !message;
}

function wantsPlateaus(message) {
  return /\b(plateau|stuck|stall|not improving|slow progress|progress)\b/.test(message);
}

function wantsFrequency(message) {
  return /\b(frequency|often|consisten|routine|how much|how often)\b/.test(message);
}

function dedupeLines(lines) {
  return lines.filter((line, index) => lines.indexOf(line) === index);
}

module.exports = {
  buildContext,
};
