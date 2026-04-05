const dashboardService = require('../services/dashboard.service');

async function getDashboard(req, res, next) {
  try {
    const dashboard = await dashboardService.getDashboard();
    return res.status(200).json(dashboard);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getDashboard,
};
