const cron = require('node-cron');
const { runSignalScan } = require('../services/signalEngine');

/**
 * Schedule the signal engine to run once per day at 8am.
 * Cron syntax: minute hour day month weekday
 */
function startSignalCron() {
  cron.schedule('0 8 * * *', async () => {
    console.log('[cron] Running daily signal scan...');
    try {
      await runSignalScan();
    } catch (err) {
      console.error('[cron] Signal scan failed:', err.message);
    }
  });

  console.log('[cron] Signal scan scheduled for 8am daily.');
}

module.exports = { startSignalCron };
