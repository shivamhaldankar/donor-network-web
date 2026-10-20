'use strict';
// lib/providers/twilio.js
// Notification provider: sends SMS via Twilio REST API.
// Used when NOTIFY_PROVIDER=twilio in .env.
//
// Twilio is lazy-required (loaded only when this provider is actually selected)
// because it's a large package that loads slowly.
//
// To use this provider, sign up at https://twilio.com, get a trial number,
// and set in .env:
//   TWILIO_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   TWILIO_TOKEN=your_auth_token
//   TWILIO_FROM=+1234567890
//
// Note: Twilio trial accounts can only send SMS to verified numbers.
// For a lab demo, use NOTIFY_PROVIDER=console instead.

let twilioClient = null;

const getClient = () => {
  if (twilioClient) return twilioClient;

  // Lazy require — twilio is only loaded when this provider is used.
  // This prevents the Twilio SDK from warming up when the demo uses console.
  // eslint-disable-next-line global-require
  const twilio = require('twilio');
  twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  return twilioClient;
};

/**
 * Send a notification via Twilio SMS.
 * @param {object} notif  A row from the notifications table (with donor_phone joined in).
 * @throws {Error} if Twilio rejects the request (caller will retry).
 */
const send = async (notif) => {
  const to = notif.donor_phone;
  if (!to) {
    throw new Error(`No phone number for donor_id=${notif.donor_id}`);
  }

  await getClient().messages.create({
    from: process.env.TWILIO_FROM,
    to,
    body: notif.message,
  });

  console.log(`[notify:twilio] Sent SMS to ${to} | donor_id=${notif.donor_id}`);
};

module.exports = { send };
