'use strict';
// lib/providers/console.js
// Default notification provider: prints to the terminal.
// No SMTP or Twilio account needed — perfect for local demos and CI.
//
// Interface: send(notification) → Promise<void>
// Throws on hard failure so the notifier worker can record it.
// (This provider never throws — it always "succeeds" by printing.)

/**
 * Send a notification by printing it to the terminal.
 * @param {object} notif  A row from the notifications table.
 * @param {string} notif.channel   'EMAIL' or 'SMS'
 * @param {string} notif.subject   Subject line (used for EMAIL)
 * @param {string} notif.message   Body text
 * @param {number} notif.donor_id  For logging
 */
const send = async (notif) => {
  const timestamp = new Date().toISOString();
  console.log(
    `[notify:console] ${timestamp} | ${notif.channel} | donor_id=${notif.donor_id}\n` +
    `  Subject: ${notif.subject || '(none)'}\n` +
    `  Message: ${notif.message}`
  );
  // Resolves successfully — the notifier will mark this row SENT.
};

module.exports = { send };
