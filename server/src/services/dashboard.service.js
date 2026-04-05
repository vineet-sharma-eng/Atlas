const insightsRepo = require('../db/repositories/insights.repo');
const tipsRepo = require('../db/repositories/tips.repo');
const motivationService = require('./motivation/motivation.service');

async function getGymDashboard() {
  const [insights, tips, motivation] = await Promise.all([
    insightsRepo.listValidInsights('gym', 3),
    tipsRepo.listValidTips('gym', 5),
    motivationService.getMotivationQuote(),
  ]);

  return {
    insights,
    tips,
    motivation,
  };
}

module.exports = {
  getGymDashboard,
};
