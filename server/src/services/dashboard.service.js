const insightsRepo = require('../repositories/insights.repo');
const tipsRepo = require('../repositories/tips.repo');
const motivationRepo = require('../repositories/motivation.repo');

const DASHBOARD_LIMITS = {
  topInsight: 1,
  supportingInsights: 3,
  tips: 2,
};

async function getDashboard() {
  const [insightRows, tipRows, motivation] = await Promise.all([
    insightsRepo.getDashboardInsights({
      topLimit: DASHBOARD_LIMITS.topInsight,
      supportingLimit: DASHBOARD_LIMITS.supportingInsights,
    }),
    tipsRepo.getDashboardTips(DASHBOARD_LIMITS.tips),
    motivationRepo.getRandomValidMotivation(),
  ]);

  const topInsightRow = insightRows.find((row) => row.section === 'top') || null;
  const supportingRows = insightRows
    .filter((row) => row.section === 'supporting')
    .slice(0, DASHBOARD_LIMITS.supportingInsights);

  return {
    topInsight: topInsightRow ? mapDashboardInsight(topInsightRow, true) : null,
    insights: supportingRows.map((row) => mapDashboardInsight(row, false)),
    tips: tipRows.map(mapDashboardTip),
    motivation: motivation ? mapDashboardMotivation(motivation) : null,
  };
}

function mapDashboardInsight(row, includePriority) {
  return {
    id: String(row.id),
    domain: row.domain,
    ...(includePriority ? { priority: row.priority } : {}),
    content: row.content,
  };
}

function mapDashboardTip(row) {
  return {
    id: String(row.id),
    domain: row.domain,
    content: row.content,
  };
}

function mapDashboardMotivation(row) {
  return {
    domain: row.domain,
    content: row.content,
  };
}

module.exports = {
  getDashboard,
};
