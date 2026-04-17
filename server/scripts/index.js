async function runScripts() {
  // Keep startup scripts opt-in so local dev doesn't exhaust limited DB connections.
  if (process.env.APP_BASE_URL == "http://127.0.0.1:5001") {
    const runDbBackup = require('./db_backup.script');
    await runDbBackup();
  }
}

module.exports = runScripts;
