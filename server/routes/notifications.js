'use strict';
// routes/notifications.js
// Donor notification list.
// Mounted at /api/notifications by server.js auto-loading.
//
// Route:
//   GET /notifications/me — returns the signed-in donor's latest 50 notifications.

const express      = require('express');
const pool         = require('../config/db');
const asyncHandler = require('../lib/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── GET /notifications/me ─────────────────────────────────────────────────────
// DONOR only — returns their own notifications, newest first.
// Response fields match contract §6.
router.get('/me', requireAuth, requireRole('DONOR'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT notification_id, type, channel, subject, message, status, created_at, sent_at
     FROM notifications
     WHERE donor_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [req.user.id]
  );

  res.json(rows);
}));

module.exports = router;
