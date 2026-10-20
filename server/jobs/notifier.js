'use strict';
// jobs/notifier.js
// Background worker that sends queued notifications.
// Exported as { start } so server.js auto-loads it after listen().
//
// Design decisions worth explaining in a viva:
//
// WHY A QUEUE?
//   Notifications are queued by a DB trigger (trg_after_match) so that request
//   creation succeeds immediately. If we sent the email synchronously inside the
//   trigger or the HTTP handler, a slow or broken SMTP server would delay — or fail —
//   every blood request. The queue decouples request creation from notification delivery.
//
// WHY FOR UPDATE SKIP LOCKED?
//   SKIP LOCKED lets two workers (if we ever ran two Node processes) each pick a
//   different set of PENDING rows without waiting for each other's transaction to
//   commit. Without it one worker would block waiting on the other's lock. In our
//   single-worker setup it still prevents the same row being processed twice if
//   the previous tick hasn't committed yet.
//
// WHY RETRIES?
//   SMTP and Twilio can fail temporarily (network glitch, rate limit). We retry up
//   to 3 times before marking FAILED, so a transient error doesn't permanently lose
//   a notification. After 3 attempts we mark FAILED and an admin can see it in the
//   queue-health page.
//
// WHY 30 SECONDS?
//   Fast enough to deliver notifications promptly in a demo; not so fast that it
//   hammers the database. In production you'd tune this based on volume.

const cron = require('node-cron');
const pool = require('../config/db');

// Load the provider based on NOTIFY_PROVIDER env var.
// Defaults to 'console' so the demo works without any external accounts.
const getProvider = () => {
  const name = (process.env.NOTIFY_PROVIDER || 'console').toLowerCase();
  if (name === 'smtp')   return require('../lib/providers/smtp');
  if (name === 'twilio') return require('../lib/providers/twilio');
  return require('../lib/providers/console'); // default
};

const BATCH_SIZE  = 20; // process up to 20 notifications per tick
const MAX_ATTEMPTS = 3;  // mark FAILED after this many consecutive errors

/**
 * Process one batch of PENDING notifications.
 * Runs inside a transaction so every status update is atomic.
 */
const processBatch = async () => {
  const provider = getProvider();
  const client = await pool.connect(); // grab a dedicated client for the transaction

  try {
    await client.query('BEGIN');

    // Select up to BATCH_SIZE PENDING notifications and lock them.
    // FOR UPDATE SKIP LOCKED: skip any rows already locked by another transaction.
    // We JOIN donors to get email and phone for the actual sending.
    const { rows: notifications } = await client.query(
      `SELECT
         n.notification_id,
         n.donor_id,
         n.request_id,
         n.type,
         n.channel,
         n.subject,
         n.message,
         n.attempts,
         d.email  AS donor_email,
         d.phone  AS donor_phone
       FROM notifications n
       JOIN donors d ON d.donor_id = n.donor_id
       WHERE n.status = 'PENDING'
       ORDER BY n.created_at
       LIMIT $1
       FOR UPDATE OF n SKIP LOCKED`,
      [BATCH_SIZE]
    );

    if (notifications.length === 0) {
      await client.query('ROLLBACK'); // nothing to do; release cleanly
      return;
    }

    console.log(`[notifier] Processing ${notifications.length} notification(s)…`);

    for (const notif of notifications) {
      try {
        // Attempt to send via the chosen provider.
        await provider.send(notif);

        // Success: mark SENT with the timestamp.
        await client.query(
          `UPDATE notifications
           SET status = 'SENT', sent_at = now()
           WHERE notification_id = $1`,
          [notif.notification_id]
        );
      } catch (sendErr) {
        // The provider threw — increment attempts.
        const newAttempts = notif.attempts + 1;
        // After MAX_ATTEMPTS failures, mark FAILED permanently.
        const newStatus = newAttempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING';

        console.error(
          `[notifier] Failed to send notification_id=${notif.notification_id}: ${sendErr.message}`,
          `(attempt ${newAttempts}/${MAX_ATTEMPTS} → ${newStatus})`
        );

        await client.query(
          `UPDATE notifications
           SET attempts = $1, status = $2
           WHERE notification_id = $3`,
          [newAttempts, newStatus, notif.notification_id]
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    // Something went wrong outside of individual send() calls — roll back the whole batch.
    await client.query('ROLLBACK');
    console.error('[notifier] Batch error (rolled back):', err.message);
  } finally {
    client.release(); // always return the connection to the pool
  }
};

/**
 * Start the notifier worker.
 * Called automatically by server.js after the HTTP server starts listening.
 */
const start = () => {
  const provider = process.env.NOTIFY_PROVIDER || 'console';
  console.log(`[notifier] Starting — provider: ${provider}, interval: every 30 seconds`);

  // node-cron expression "*/30 * * * * *" = every 30 seconds.
  // The 6-field format (with seconds) is needed for sub-minute intervals.
  cron.schedule('*/30 * * * * *', async () => {
    try {
      await processBatch();
    } catch (err) {
      // Top-level catch: prevents an unhandled promise rejection from crashing the server.
      console.error('[notifier] Unexpected error in processBatch:', err.message);
    }
  });
};

module.exports = { start };
