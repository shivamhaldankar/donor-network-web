'use strict';
// server/jobs/eligibility.js
// Owner: Member A (Slice 1)
// Automated background worker that runs restore_donor_eligibility() daily at midnight.
// Uses node-cron when ELIGIBILITY_SCHEDULER=node (default on Windows/dev).

const cron = require('node-cron');
const pool = require('../config/db');

/**
 * Runs a single pass of eligibility restoration against the database.
 * @returns {Promise<number>} Count of donors restored
 */
async function runOnce() {
  try {
    const { rows } = await pool.query('SELECT restore_donor_eligibility() AS restored_count');
    const count = rows[0]?.restored_count || 0;
    if (count > 0) {
      console.log(`[eligibility-job] Restored eligibility for ${count} donor(s).`);
    }
    return count;
  } catch (err) {
    console.error('[eligibility-job] Error restoring donor eligibility:', err.message);
    throw err;
  }
}

/**
 * Starts the scheduled eligibility restore job.
 * Called automatically by server.js on startup.
 */
function start() {
  const schedulerMode = (process.env.ELIGIBILITY_SCHEDULER || 'node').toLowerCase();

  if (schedulerMode !== 'node') {
    console.log(`[eligibility-job] Node scheduler disabled (ELIGIBILITY_SCHEDULER=${schedulerMode}). Assuming DB handles it.`);
    return;
  }

  // Schedule daily at midnight: 0 0 * * *
  cron.schedule('0 0 * * *', async () => {
    console.log('[eligibility-job] Midnight trigger: running restore_donor_eligibility()...');
    try {
      await runOnce();
    } catch (err) {
      // Error is already logged in runOnce()
    }
  });

  console.log('[eligibility-job] Scheduled daily at midnight (node-cron)');
}

module.exports = { start, runOnce };
