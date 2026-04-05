const apiClient = require('../../clients/api.client');

async function getFinanceAnalysis() {
  return apiClient.request('/finance/analysis');
}

module.exports = {
  getFinanceAnalysis,
};
