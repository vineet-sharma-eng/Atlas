const insightsRepo = require('../repositories/insights.repo');

async function getInsightById(id) {
  const insight = await insightsRepo.findInsightById(id);

  if (!insight) {
    return null;
  }

  return {
    id: String(insight.id),
    domain: insight.domain,
    subtype: insight.subtype,
    priority: insight.priority,
    title: insight.title,
    content: insight.content,
    createdAt: insight.createdAt,
    validUntil: insight.validUntil,
  };
}

module.exports = {
  getInsightById,
};
