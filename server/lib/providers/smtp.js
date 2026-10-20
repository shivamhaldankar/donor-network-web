'use strict';
// lib/providers/smtp.js
// Notification provider: sends email using Nodemailer.
// Used when NOTIFY_PROVIDER=smtp in .env.
//
// Set up a free Mailtrap account (https://mailtrap.io) for testing:
//   SMTP_HOST=sandbox.smtp.mailtrap.io
//   SMTP_PORT=587
//   SMTP_USER=<from Mailtrap inbox SMTP settings>
//   SMTP_PASS=<from Mailtrap inbox SMTP settings>
//
// Or use Ethereal (https://ethereal.email) for a one-off test account.

const nodemailer = require('nodemailer');

// Create the transporter once (module-level) so the connection is reused.
// Nodemailer handles pooling internally.
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465, // TLS on port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

/**
 * Send a notification via SMTP email.
 * @param {object} notif  A row from the notifications table.
 * @throws {Error} if Nodemailer cannot send the message (caller will retry).
 */
const send = async (notif) => {
  // We need the donor's email address.  The notifier passes the full DB row
  // which includes a `donor_email` field joined from donors.
  const to = notif.donor_email;
  if (!to) {
    throw new Error(`No email address for donor_id=${notif.donor_id}`);
  }

  await getTransporter().sendMail({
    from:    `"Pulse Donor Network" <${process.env.SMTP_USER}>`,
    to,
    subject: notif.subject || 'Pulse Notification',
    text:    notif.message,
  });

  console.log(`[notify:smtp] Sent email to ${to} | donor_id=${notif.donor_id}`);
};

module.exports = { send };
