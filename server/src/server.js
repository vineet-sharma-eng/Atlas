const createApp = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { startCronJobs } = require('../services/scheduler/cron');

function startServer() {
  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info('Atlas Orchestrator started', {
      port: config.port,
      env: config.env,
      model: config.openAiModelId,
      ollamaModel: config.ollama.model,
    });
    startCronJobs();
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
};
