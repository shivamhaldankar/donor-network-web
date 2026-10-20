'use strict';
// server/routes/donations.js
// Owner: Member A (Slice 1)
// Routes for logging blood and organ donations.

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../lib/asyncHandler');

// ── POST /api/donations ───────────────────────────────────────────────────────
// Roles: STAFF
// Logs a donation. Hospital ID is taken directly from the staff member's token.
// If request_id is supplied, it must belong to the same hospital (403 otherwise).
// The database trigger trg_check_donor_eligibility validates the 90-day cooldown;
// if ineligible, it raises P0001: DONOR_NOT_ELIGIBLE which bubbles to HTTP 409.
// The database trigger trg_after_donation updates last_donation_date, sets
// eligible_status = 'N', and fulfills the linked request automatically.
router.post(
  '/',
  requireAuth,
  requireRole('STAFF'),
  asyncHandler(async (req, res) => {
    const { donor_id, request_id, donation_type, units } = req.body;

    if (!donor_id) {
      return res.status(400).json({ error: 'donor_id is required.' });
    }

    if (!donation_type || !['BLOOD', 'ORGAN'].includes(donation_type)) {
      return res.status(400).json({ error: 'donation_type must be BLOOD or ORGAN.' });
    }

    const unitsNum = units !== undefined ? parseInt(units, 10) : 1;
    if (isNaN(unitsNum) || unitsNum <= 0) {
      return res.status(400).json({ error: 'units must be a positive integer.' });
    }

    // If linked to a request, ensure the request exists and belongs to this staff member's hospital
    if (request_id) {
      const reqRes = await pool.query(
        'SELECT hospital_id, status FROM requests WHERE request_id = $1',
        [request_id]
      );

      if (!reqRes.rows.length) {
        return res.status(404).json({ error: 'Linked request not found.' });
      }

      if (reqRes.rows[0].hospital_id !== req.user.hospital_id) {
        return res.status(403).json({
          error: "Access denied. The linked request belongs to a different hospital.",
        });
      }
    }

    // Insert donation. DB triggers handle eligibility validation and post-donation state updates.
    const insertQuery = `
      INSERT INTO donations (
        donor_id,
        request_id,
        hospital_id,
        donation_type,
        units,
        donated_on
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
      RETURNING donation_id
    `;

    const values = [
      donor_id,
      request_id || null,
      req.user.hospital_id,
      donation_type,
      unitsNum,
    ];

    const { rows } = await pool.query(insertQuery, values);
    res.status(201).json({ donation_id: rows[0].donation_id });
  })
);

module.exports = router;
