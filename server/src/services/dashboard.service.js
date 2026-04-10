const insightsRepo = require('../repositories/insights.repo');
const tipsRepo = require('../repositories/tips.repo');
const motivationRepo = require('../repositories/motivation.repo');
const fallbackMotivation = require('./motivation/fallback');

const DASHBOARD_LIMITS = {
  moduleInsights: 5,
  tips: 5,
  motivations: 5,
  minimumMotivations: 3,
};

const MODULES = ['finance', 'gym'];

async function getDashboard() {
  const [
    financeInsights,
    gymInsights,
    financeTips,
    gymTips,
    financeMotivations,
    gymMotivations,
    generalMotivations,
  ] = await Promise.all([
    insightsRepo.listValidInsights('finance', DASHBOARD_LIMITS.moduleInsights),
    insightsRepo.listValidInsights('gym', DASHBOARD_LIMITS.moduleInsights),
    tipsRepo.listValidTips('finance', DASHBOARD_LIMITS.tips),
    tipsRepo.listValidTips('gym', DASHBOARD_LIMITS.tips),
    motivationRepo.listValidMotivation(DASHBOARD_LIMITS.motivations, 'finance'),
    motivationRepo.listValidMotivation(DASHBOARD_LIMITS.motivations, 'gym'),
    motivationRepo.listValidMotivation(DASHBOARD_LIMITS.motivations, 'general'),
  ]);

  const modules = {
    finance: buildModuleSection({
      domain: 'finance',
      insights: financeInsights,
      tips: financeTips,
      motivations: buildMotivationDeck('finance', financeMotivations, generalMotivations),
    }),
    gym: buildModuleSection({
      domain: 'gym',
      insights: gymInsights,
      tips: gymTips,
      motivations: buildMotivationDeck('gym', gymMotivations, generalMotivations),
    }),
  };

  const topInsightRow = selectGlobalTopInsight(modules);
  const supportingRows = MODULES.flatMap((domain) =>
    modules[domain].insights.slice(modules[domain].topInsight ? 1 : 0, 3)
  ).slice(0, 5);
  const aggregatedTips = MODULES.flatMap((domain) => modules[domain].tips.slice(0, 3)).slice(0, 5);
  const dashboardMotivations = buildMotivationDeck('general', generalMotivations);

  return {
    topInsight: topInsightRow ? mapDashboardInsight(topInsightRow, true) : null,
    insights: supportingRows.map((row) => mapDashboardInsight(row, false)),
    tips: aggregatedTips.map(mapDashboardTip),
    motivation: dashboardMotivations[0] ? mapDashboardMotivation(dashboardMotivations[0]) : null,
    motivations: dashboardMotivations.map(mapDashboardMotivation),
    modules: Object.fromEntries(
      MODULES.map((domain) => [
        domain,
        {
          topInsight: modules[domain].topInsight
            ? mapDashboardInsight(modules[domain].topInsight, true)
            : null,
          insights: modules[domain].insights.map((row) => mapDashboardInsight(row, false)),
          tips: modules[domain].tips.map(mapDashboardTip),
          motivation: modules[domain].motivations[0]
            ? mapDashboardMotivation(modules[domain].motivations[0])
            : null,
          motivations: modules[domain].motivations.map(mapDashboardMotivation),
        },
      ]),
    ),
  };
}

function buildModuleSection({ domain, insights, tips, motivations }) {
  const orderedInsights = [...insights].sort(compareInsights);

  return {
    domain,
    topInsight: orderedInsights[0] || null,
    insights: orderedInsights.slice(0, DASHBOARD_LIMITS.moduleInsights),
    tips: [...tips].slice(0, DASHBOARD_LIMITS.tips),
    motivations: motivations.slice(0, DASHBOARD_LIMITS.motivations),
  };
}

function selectGlobalTopInsight(modules) {
  const candidates = MODULES
    .map((domain) => modules[domain].topInsight)
    .filter(Boolean)
    .sort(compareInsights);

  return candidates[0] || null;
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
    id: row.id ? String(row.id) : `${row.domain}-${row.content}`,
    domain: row.domain,
    content: row.content,
  };
}

function buildMotivationDeck(domain, domainRows, generalRows = []) {
  const combined = fillUniqueItems([
    ...domainRows,
    ...fallbackMotivation.getFallbackQuotes(domain).map((content, index) => ({
      id: `fallback-${domain}-${index}`,
      domain,
      content,
      source: 'fallback',
      createdAt: null,
      validUntil: null,
    })),
    ...generalRows
      .filter((row) => row.domain === 'general')
      .map((row) => ({ ...row, domain })),
  ]);

  return combined.slice(0, Math.max(DASHBOARD_LIMITS.minimumMotivations, Math.min(DASHBOARD_LIMITS.motivations, combined.length)));
}

function fillUniqueItems(rows) {
  const seen = new Set();
  const unique = [];

  for (const row of rows) {
    const key = `${row.domain}:${String(row.content || '').trim().toLowerCase()}`;

    if (!row?.content || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(row);
  }

  return unique;
}

function compareInsights(left, right) {
  const priorityScore = getPriorityScore(right.priority) - getPriorityScore(left.priority);

  if (priorityScore !== 0) {
    return priorityScore;
  }

  return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
}

function getPriorityScore(priority) {
  switch (String(priority || '').toLowerCase()) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

module.exports = {
  getDashboard,
};
