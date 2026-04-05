const insightService = require('../services/insight.service');
const { AppError } = require('../utils/errorHandler');

async function getInsight(req, res, next) {
  try {
    const insightId = Number.parseInt(String(req.params.id || ''), 10);

    if (!Number.isInteger(insightId) || insightId <= 0) {
      throw new AppError('Insight id must be a positive integer', 400);
    }

    const insight = await insightService.getInsightById(insightId);

    if (!insight) {
      throw new AppError('Insight not found', 404);
    }

    return res.status(200).json(insight);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getInsight,
};
