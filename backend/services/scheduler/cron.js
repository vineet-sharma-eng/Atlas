const cron = require('node-cron');

const { generateFinanceInsights } = require('../insights/financeInsights');

let cronStarted = false;

function startCronJobs() {
  if (cronStarted) {
    console.log('[cron] Scheduler already started. Skipping duplicate registration.');
    return;
  }

  const schedule = process.env.NODE_ENV === 'development' ? '* * * * *' : '0 9 * * 0';

  console.log(`[cron] Starting finance insights scheduler with schedule: ${schedule}`);
  cronStarted = true;

  cron.schedule(schedule, async () => {
    console.log('[cron] Running weekly finance insights...');

    try {
      await generateFinanceInsights();
      console.log('[cron] Weekly finance insights generated successfully.');
    } catch (error) {
      console.error('[cron] Weekly finance insights failed:', error);
    }
  });
}

module.exports = {
  startCronJobs,
};
