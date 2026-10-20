'use strict';
// server/routes/requests.js
// Owner: Member A (Slice 1)
// Routes for creating, listing, cancelling blood/organ requests and inspecting matches.

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireRole, requireVerifiedHospital } = require('../middleware/auth');
const asyncHandler = require('../lib/asyncHandler');

// ── POST /api/requests ────────────────────────────────────────────────────────
// Roles: STAFF (verified hospital)
// Creates a blood or organ request.
// For CRITICAL BLOOD requests, the database trigger trg_critical_request automatically
// runs find_matching_donors, populates match_log, and sets status to MATCHED if donors are found.
router.post(
  '/',
  requireAuth,
  requireRole('STAFF'),
  requireVerifiedHospital,
  asyncHandler(async (req, res) => {
    const {
      request_type,
      blood_type_needed,
      organ_type_needed,
      urgency,
      patient_name,
      units_needed,
      radius_km,
    } = req.body;

    if (!request_type || !['BLOOD', 'ORGAN'].includes(request_type)) {
      return res.status(400).json({ error: 'request_type must be either BLOOD or ORGAN.' });
    }

    if (!urgency || !['CRITICAL', 'MODERATE', 'LOW'].includes(urgency)) {
      return res.status(400).json({ error: 'urgency must be CRITICAL, MODERATE, or LOW.' });
    }

    if (request_type === 'BLOOD' && !blood_type_needed) {
      return res.status(400).json({ error: 'blood_type_needed is required for BLOOD requests.' });
    }

    if (request_type === 'ORGAN' && !organ_type_needed) {
      return res.status(400).json({ error: 'organ_type_needed is required for ORGAN requests.' });
    }

    const units = units_needed !== undefined ? parseInt(units_needed, 10) : 1;
    if (isNaN(units) || units <= 0) {
      return res.status(400).json({ error: 'units_needed must be a positive integer.' });
    }

    const radius = radius_km !== undefined ? parseInt(radius_km, 10) : 50;
    if (isNaN(radius) || radius < 1 || radius > 500) {
      return res.status(400).json({ error: 'radius_km must be between 1 and 500.' });
    }

    const insertQuery = `
      INSERT INTO requests (
        hospital_id,
        staff_id,
        request_type,
        blood_type_needed,
        organ_type_needed,
        units_needed,
        urgency,
        radius_km,
        patient_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING request_id, status
    `;

    const values = [
      req.user.hospital_id,
      req.user.id,
      request_type,
      request_type === 'BLOOD' ? blood_type_needed : null,
      request_type === 'ORGAN' ? organ_type_needed : null,
      units,
      urgency,
      radius,
      patient_name ? patient_name.trim() : null,
    ];

    const { rows } = await pool.query(insertQuery, values);
    const created = rows[0];

    // Re-query the current status and match count
    // (the trigger may have updated status to MATCHED and populated match_log)
    const checkQuery = `
      SELECT
        r.status,
        COALESCE(m.cnt, 0)::int AS match_count
      FROM requests r
      LEFT JOIN (
        SELECT request_id, COUNT(*)::int AS cnt
        FROM match_log
        GROUP BY request_id
      ) m ON r.request_id = m.request_id
      WHERE r.request_id = $1
    `;
    const checkRes = await pool.query(checkQuery, [created.request_id]);
    const finalRow = checkRes.rows[0];

    res.status(201).json({
      request_id:  created.request_id,
      status:      finalRow.status,
      match_count: finalRow.match_count,
    });
  })
);

// ── GET /api/requests/critical ────────────────────────────────────────────────
// Roles: STAFF (own hospital), ADMIN (all)
// Returns open and matched critical requests from vw_critical_open_requests.
router.get(
  '/critical',
  requireAuth,
  requireRole('STAFF', 'ADMIN'),
  asyncHandler(async (req, res) => {
    let query = `
      SELECT
        request_id,
        hospital_id,
        hospital,
        blood_type_needed,
        organ_type_needed,
        patient_name,
        requested_on,
        days_open
      FROM vw_critical_open_requests
    `;
    const params = [];

    if (req.user.role === 'STAFF') {
      query += ' WHERE hospital_id = $1';
      params.push(req.user.hospital_id);
    }

    query += ' ORDER BY requested_on DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  })
);

// ── GET /api/requests ─────────────────────────────────────────────────────────
// Roles: STAFF (own hospital), ADMIN (all)
// Lists requests with optional ?status= query filter and match counts.
router.get(
  '/',
  requireAuth,
  requireRole('STAFF', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (req.user.role === 'STAFF') {
      conditions.push(`r.hospital_id = $${idx++}`);
      params.push(req.user.hospital_id);
    }

    if (status) {
      conditions.push(`r.status = $${idx++}`);
      params.push(status.toUpperCase());
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        r.request_id,
        r.hospital_id,
        h.name AS hospital_name,
        r.request_type,
        r.blood_type_needed,
        r.organ_type_needed,
        r.urgency,
        r.radius_km,
        r.patient_name,
        r.requested_on,
        r.status,
        COALESCE(m.cnt, 0)::int AS match_count
      FROM requests r
      JOIN hospitals h ON r.hospital_id = h.hospital_id
      LEFT JOIN (
        SELECT request_id, COUNT(*)::int AS cnt
        FROM match_log
        GROUP BY request_id
      ) m ON r.request_id = m.request_id
      ${whereClause}
      ORDER BY r.requested_on DESC
    `;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  })
);

// ── GET /api/requests/:id/matches ─────────────────────────────────────────────
// Roles: STAFF (own hospital), ADMIN (all)
// Returns matched donors for this request ordered nearest first.
// Donor phone is exposed here so hospital staff can contact the donor.
router.get(
  '/:id/matches',
  requireAuth,
  requireRole('STAFF', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const requestId = parseInt(req.params.id, 10);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID.' });
    }

    // Check request exists and ownership for STAFF
    const reqRes = await pool.query(
      'SELECT request_id, hospital_id FROM requests WHERE request_id = $1',
      [requestId]
    );

    if (!reqRes.rows.length) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const reqRow = reqRes.rows[0];
    if (req.user.role === 'STAFF' && reqRow.hospital_id !== req.user.hospital_id) {
      return res.status(403).json({ error: "Access denied. Not your hospital's request." });
    }

    const query = `
      SELECT
        m.match_id,
        m.donor_id,
        d.name,
        d.phone,
        d.blood_type,
        m.distance_km,
        m.contacted_status,
        m.matched_on
      FROM match_log m
      JOIN donors d ON m.donor_id = d.donor_id
      WHERE m.request_id = $1
      ORDER BY m.distance_km ASC NULLS LAST, m.matched_on ASC
    `;

    const { rows } = await pool.query(query, [requestId]);
    res.json(rows);
  })
);

// ── PATCH /api/requests/:id/cancel ───────────────────────────────────────────
// Roles: STAFF (own hospital), ADMIN (all)
// Cancels a request. Only OPEN or MATCHED requests may be cancelled.
router.patch(
  '/:id/cancel',
  requireAuth,
  requireRole('STAFF', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const requestId = parseInt(req.params.id, 10);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID.' });
    }

    const findRes = await pool.query(
      'SELECT request_id, hospital_id, status FROM requests WHERE request_id = $1',
      [requestId]
    );

    if (!findRes.rows.length) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const reqRow = findRes.rows[0];
    if (req.user.role === 'STAFF' && reqRow.hospital_id !== req.user.hospital_id) {
      return res.status(403).json({ error: "Access denied. Not your hospital's request." });
    }

    if (!['OPEN', 'MATCHED'].includes(reqRow.status)) {
      return res.status(409).json({
        error: `Only OPEN or MATCHED requests can be cancelled (current status: ${reqRow.status}).`,
        code:  'REQUEST_NOT_CANCELLABLE',
      });
    }

    const updateRes = await pool.query(
      'UPDATE requests SET status = $1 WHERE request_id = $2 RETURNING request_id, status',
      ['CANCELLED', requestId]
    );

    res.json(updateRes.rows[0]);
  })
);

module.exports = router;
