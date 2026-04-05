const cron = require('node-cron');

const { generateFinanceInsights } = require('../insights/financeInsights');
const logger = require('../../src/utils/logger');

let cronStarted = false;

function startCronJobs() {
  if (cronStarted) {
    logger.info('Scheduler already started, skipping duplicate registration');
    return;
  }

  const schedule = process.env.NODE_ENV === 'development' ? '* * * * *' : '0 9 * * 0';

  logger.info('Starting finance insights scheduler', { schedule });
  cronStarted = true;

  cron.schedule(schedule, async () => {
    logger.info('Running scheduled finance insights');

    try {
      await generateFinanceInsights();
      logger.info('Scheduled finance insights completed successfully');
    } catch (error) {
      logger.error('Scheduled finance insights failed', { error: error.message });
    }
  });
}

module.exports = {
  startCronJobs,
};
