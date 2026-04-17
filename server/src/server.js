const createApp = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { startBackgroundJobs } = require('./jobs/cron');
const runScripts = require('../scripts');

async function startServer() {
  await runScripts();

  const app = createApp();
  const server = app.listen(config.port, async () => {
    logger.info('Atlas Orchestrator started', {
      port: config.port,
      env: config.env,
      model: config.openAiModelId,
      ollamaModel: config.ollama.model,
    });

    await startBackgroundJobs();
  });

  return server;
}

if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Atlas Orchestrator failed to start', {
      error: error.message,
    });
    process.exit(1);
  });
}

module.exports = {
  startServer,
};
