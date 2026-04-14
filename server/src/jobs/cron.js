const cron = require('node-cron');

const config = require('../config');
const logger = require('../utils/logger');
const insightsRepo = require('../db/repositories/insights.repo');
const tipsRepo = require('../db/repositories/tips.repo');
const motivationRepo = require('../db/repositories/motivation.repo');
const { runFinanceInsightsJob } = require('../services/insights/financeInsights.service');
const { runGymInsightsJob } = require('../services/insights/gymInsights.service');
const { runFinanceTipsJob } = require('../services/tips/financeTips.service');
const { runGymTipsJob } = require('../services/tips/tips.service');
const { runMotivationJob } = require('../services/motivation/motivation.service');

let started = false;

async function startBackgroundJobs() {
  if (started) {
    logger.info('Background jobs already started, skipping duplicate registration');
    return;
  }

  await Promise.all([
    insightsRepo.ensureInsightsTable(),
    tipsRepo.ensureTipsTable(),
    motivationRepo.ensureMotivationTable(),
  ]);

  started = true;
  registerJob('finance-insights', config.background.financeInsightsSchedule, runFinanceInsightsJob);
  registerJob('gym-insights', config.background.gymInsightsSchedule, runGymInsightsJob);
  registerJob('finance-tips', config.background.financeTipsSchedule, runFinanceTipsJob);
  registerJob('gym-tips', config.background.gymTipsSchedule, runGymTipsJob);
  registerJob('motivation', config.background.motivationSchedule, runMotivationJob);

  await runAllJobsOnce();
}

function registerJob(name, schedule, jobFn) {
  logger.info('Registering background job', { name, schedule });

  cron.schedule(schedule, async () => {
    try {
      await jobFn({ requestId: `cron-${name}` });
    } catch (error) {
      logger.error('Background job failed', {
        name,
        error: error.message,
      });
    }
  });
}

async function runAllJobsOnce() {
  const jobs = [
    ['finance-insights', runFinanceInsightsJob],
    ['gym-insights', runGymInsightsJob],
    ['finance-tips', runFinanceTipsJob],
    ['gym-tips', runGymTipsJob],
    ['motivation', runMotivationJob],
  ];

  for (const [name, jobFn] of jobs) {
    try {
      await jobFn({ requestId: `startup-${name}` });
    } catch (error) {
      logger.error('Startup background job failed', {
        name,
        error: error.message,
      });
    }
  }
}

module.exports = {
  startBackgroundJobs,
};
