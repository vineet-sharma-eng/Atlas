const apiClient = require('../../clients/api.client');

async function getGymAnalysis() {
  return apiClient.request('/gym/analysis');
}

module.exports = {
  getGymAnalysis,
};
