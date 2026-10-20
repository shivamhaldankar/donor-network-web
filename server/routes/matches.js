'use strict';
// server/routes/matches.js
// Owner: Member A (Slice 1)
// Routes for managing donor match responses.

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../lib/asyncHandler');

// ── POST /api/matches/:id/respond ─────────────────────────────────────────────
// Roles: DONOR (own match)
// Donor accepts or declines an availability match request.
// Sets contacted_status to ACCEPTED or DECLINED and records responded_on.
router.post(
  '/:id/respond',
  requireAuth,
  requireRole('DONOR'),
  asyncHandler(async (req, res) => {
    const matchId = parseInt(req.params.id, 10);
    if (isNaN(matchId)) {
      return res.status(400).json({ error: 'Invalid match ID.' });
    }

    const { response } = req.body;
    if (!['ACCEPTED', 'DECLINED'].includes(response)) {
      return res.status(400).json({
        error: 'Response must be either ACCEPTED or DECLINED.',
      });
    }

    // Look up the match and the linked request
    const findQuery = `
      SELECT
        m.match_id,
        m.donor_id,
        m.contacted_status,
        r.status AS request_status
      FROM match_log m
      JOIN requests r ON m.request_id = r.request_id
      WHERE m.match_id = $1
    `;
    const { rows } = await pool.query(findQuery, [matchId]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Match record not found.' });
    }

    const match = rows[0];

    // Ensure the match belongs to the authenticated donor
    if (match.donor_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You can only respond to your own matches.' });
    }

    // Check if the match has already been accepted or declined
    if (!['PENDING', 'CONTACTED'].includes(match.contacted_status)) {
      return res.status(409).json({
        error: `Match has already been responded to (${match.contacted_status}).`,
        code:  'MATCH_ALREADY_RESPONDED',
      });
    }

    // Check if the linked request is already closed (fulfilled or cancelled)
    if (['FULFILLED', 'CANCELLED'].includes(match.request_status)) {
      return res.status(409).json({
        error: `The linked request has already been ${match.request_status.toLowerCase()}.`,
        code:  'REQUEST_CLOSED',
      });
    }

    // Update match record
    const updateQuery = `
      UPDATE match_log
      SET contacted_status = $1,
          responded_on     = NOW()
      WHERE match_id = $2
      RETURNING match_id, contacted_status, responded_on
    `;
    const updated = await pool.query(updateQuery, [response, matchId]);
    const row = updated.rows[0];

    res.json({
      match_id:         row.match_id,
      contacted_status: row.contacted_status,
      responded_on:     row.responded_on,
    });
  })
);

module.exports = router;
