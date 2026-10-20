'use strict';
// routes/hospitals.js
// Public hospital list (for staff sign-up dropdown) and admin verify/unverify.
// Mounted at /api/hospitals by server.js auto-loading.

const express  = require('express');
const pool     = require('../config/db');
const asyncHandler            = require('../lib/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── GET /hospitals ─────────────────────────────────────────────────────────────
// Public — no auth required.
// Used by the sign-up page so a new staff member can pick their hospital from a list.
router.get('/', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT hospital_id, name, city, verified
     FROM hospitals
     ORDER BY name`
  );
  res.json(rows);
}));

// ── PATCH /hospitals/:id/verify ────────────────────────────────────────────────
// Admin only.
// Body: { verified: true | false }
// Updates the hospital's verified flag.
// The trg_audit_hospitals trigger (database/20_audit_notifications.sql) automatically
// writes HOSPITAL_VERIFIED or HOSPITAL_UNVERIFIED to audit_log — no manual audit call needed here.
router.patch('/:id/verify', requireAuth, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { id }       = req.params;
  const { verified } = req.body;

  if (typeof verified !== 'boolean') {
    return res.status(400).json({ error: '"verified" must be a boolean.' });
  }

  const { rows } = await pool.query(
    `UPDATE hospitals
     SET verified = $1
     WHERE hospital_id = $2
     RETURNING hospital_id, name, city, verified`,
    [verified, id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: 'Hospital not found.' });
  }

  res.json(rows[0]);
}));

module.exports = router;
