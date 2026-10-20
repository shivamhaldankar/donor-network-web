'use strict';
// ============================================================
// Pulse Organ Module Routes
// Owner: Member C (Slice 3: Organ Matching & Dashboards)
// Contract §6: Organs and staff stats (C)
// Mounted at: /api/organs
// ============================================================

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireRole, requireVerifiedHospital } = require('../middleware/auth');
const asyncHandler = require('../lib/asyncHandler');

const VALID_ORGAN_TYPES = ['Kidney', 'Liver', 'Cornea', 'Heart', 'Lung', 'Pancreas'];
const VALID_BLOOD_GROUPS = ['A', 'B', 'AB', 'O'];

// ── 1. POST /api/organs/pledges ──────────────────────────────
// Roles: DONOR
// Body: { organ_type } → 201 { organ_id, organ_type, status }
router.post(
  '/pledges',
  requireAuth,
  requireRole('DONOR'),
  asyncHandler(async (req, res) => {
    const { organ_type } = req.body;

    if (!organ_type || !VALID_ORGAN_TYPES.includes(organ_type)) {
      return res.status(400).json({
        error: `Invalid organ type. Must be one of: ${VALID_ORGAN_TYPES.join(', ')}`,
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO organ_registry (donor_id, organ_type, status)
       VALUES ($1, $2, 'AVAILABLE')
       RETURNING organ_id, organ_type, status`,
      [req.user.id, organ_type]
    );

    return res.status(201).json(rows[0]);
  })
);

// ── 2. GET /api/organs/pledges ───────────────────────────────
// Roles: DONOR
// Response: own pledges [ { organ_id, organ_type, status, registered_on } ]
router.get(
  '/pledges',
  requireAuth,
  requireRole('DONOR'),
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT organ_id, organ_type, status, registered_on
       FROM organ_registry
       WHERE donor_id = $1
       ORDER BY registered_on DESC, organ_id DESC`,
      [req.user.id]
    );

    return res.json(rows);
  })
);

// ── 3. DELETE /api/organs/pledges/:id ────────────────────────
// Roles: DONOR (own pledge only)
// Sets status WITHDRAWN → { organ_id, status }
// 409 PLEDGE_ALREADY_MATCHED (via trg_pledge_withdrawn)
router.delete(
  '/pledges/:id',
  requireAuth,
  requireRole('DONOR'),
  asyncHandler(async (req, res) => {
    const organId = parseInt(req.params.id, 10);
    if (isNaN(organId)) {
      return res.status(400).json({ error: 'Invalid pledge ID' });
    }

    // Verify ownership
    const check = await pool.query(
      `SELECT donor_id, status FROM organ_registry WHERE organ_id = $1`,
      [organId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Organ pledge not found' });
    }

    if (check.rows[0].donor_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied: You may only withdraw your own organ pledges' });
    }

    // Trigger trg_pledge_withdrawn validates if already MATCHED (raises PLEDGE_ALREADY_MATCHED)
    const { rows } = await pool.query(
      `UPDATE organ_registry
       SET status = 'WITHDRAWN'
       WHERE organ_id = $1
       RETURNING organ_id, status`,
      [organId]
    );

    return res.json(rows[0]);
  })
);

// ── 4. GET /api/organs/pledges/available ─────────────────────
// Roles: STAFF, ADMIN
// Response: [ { organ_id, organ_type, donor_blood_group, city, registered_on } ]
// PRIVACY RULE: Never expose donor name or contact details
router.get(
  '/pledges/available',
  requireAuth,
  requireRole('STAFF', 'ADMIN'),
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT
         r.organ_id,
         r.organ_type,
         RTRIM(d.blood_type::text, '+-') AS donor_blood_group,
         d.city,
         r.registered_on
       FROM organ_registry r
       JOIN donors d ON d.donor_id = r.donor_id
       WHERE r.status = 'AVAILABLE'
       ORDER BY r.registered_on ASC, r.organ_id ASC`
    );

    return res.json(rows);
  })
);

// ── 5. POST /api/organs/waitlist ─────────────────────────────
// Roles: STAFF (verified hospital)
// Body: { patient_name, organ_type, blood_group, urgency_score } → 201 { waitlist_id }
router.post(
  '/waitlist',
  requireAuth,
  requireRole('STAFF'),
  requireVerifiedHospital,
  asyncHandler(async (req, res) => {
    const { patient_name, organ_type, blood_group, urgency_score } = req.body;

    if (!patient_name || typeof patient_name !== 'string' || !patient_name.trim()) {
      return res.status(400).json({ error: 'Patient name is required' });
    }

    if (!organ_type || !VALID_ORGAN_TYPES.includes(organ_type)) {
      return res.status(400).json({
        error: `Invalid organ type. Must be one of: ${VALID_ORGAN_TYPES.join(', ')}`,
      });
    }

    if (!blood_group || !VALID_BLOOD_GROUPS.includes(blood_group)) {
      return res.status(400).json({
        error: `Invalid blood group. Must be one of: ${VALID_BLOOD_GROUPS.join(', ')}`,
      });
    }

    const urgency = parseInt(urgency_score, 10);
    if (isNaN(urgency) || urgency < 1 || urgency > 10) {
      return res.status(400).json({ error: 'Urgency score must be an integer between 1 and 10' });
    }

    const hospitalId = req.user.hospital_id;
    const staffId = req.user.id;

    const { rows } = await pool.query(
      `INSERT INTO organ_waitlist (hospital_id, staff_id, patient_name, organ_type, blood_group, urgency_score)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING waitlist_id`,
      [hospitalId, staffId, patient_name.trim(), organ_type, blood_group, urgency]
    );

    return res.status(201).json(rows[0]);
  })
);

// ── 6. GET /api/organs/waitlist ──────────────────────────────
// Roles: STAFF (own hospital), ADMIN (all)
// Response: rows of vw_waitlist_ranked
router.get(
  '/waitlist',
  requireAuth,
  requireRole('STAFF', 'ADMIN'),
  asyncHandler(async (req, res) => {
    if (req.user.role === 'STAFF') {
      const { rows } = await pool.query(
        `SELECT * FROM vw_waitlist_ranked WHERE hospital_id = $1`,
        [req.user.hospital_id]
      );
      return res.json(rows);
    }

    // ADMIN sees all hospitals
    const { rows } = await pool.query(`SELECT * FROM vw_waitlist_ranked`);
    return res.json(rows);
  })
);

// ── 7. PATCH /api/organs/waitlist/:id/remove ─────────────────
// Roles: STAFF (own hospital), ADMIN
// Response: { waitlist_id, status }
router.patch(
  '/waitlist/:id/remove',
  requireAuth,
  requireRole('STAFF', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const waitlistId = parseInt(req.params.id, 10);
    if (isNaN(waitlistId)) {
      return res.status(400).json({ error: 'Invalid waitlist ID' });
    }

    const check = await pool.query(
      `SELECT hospital_id, status FROM organ_waitlist WHERE waitlist_id = $1`,
      [waitlistId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Waitlist entry not found' });
    }

    // Staff may only manage their own hospital's patients
    if (req.user.role === 'STAFF' && check.rows[0].hospital_id !== req.user.hospital_id) {
      return res.status(403).json({
        error: "Access denied: You may only manage your own hospital's waiting-list entries",
      });
    }

    const { rows } = await pool.query(
      `UPDATE organ_waitlist
       SET status = 'REMOVED'
       WHERE waitlist_id = $1
       RETURNING waitlist_id, status`,
      [waitlistId]
    );

    return res.json(rows[0]);
  })
);

// ── 8. POST /api/organs/pledges/:id/match ────────────────────
// Roles: STAFF, ADMIN
// Runs database function match_organ
// Response: [ { organ_match_id, rank_no, waitlist_id, patient_name, hospital_name, blood_group, urgency_score, days_waiting, distance_km, priority_score, status } ]
// PRIVACY RULE: Patients from other hospitals show patient_name as "Patient #<waitlist_id>"
router.post(
  '/pledges/:id/match',
  requireAuth,
  requireRole('STAFF', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const organId = parseInt(req.params.id, 10);
    if (isNaN(organId)) {
      return res.status(400).json({ error: 'Invalid organ pledge ID' });
    }

    // 1. Run database matching function
    await pool.query('SELECT match_organ($1::int)', [organId]);

    // 2. Fetch ranked proposals
    const { rows } = await pool.query(
      `SELECT
         m.organ_match_id,
         m.rank_no,
         m.waitlist_id,
         w.patient_name,
         h.name AS hospital_name,
         w.hospital_id,
         w.blood_group,
         w.urgency_score,
         (CURRENT_DATE - w.listed_on)::int AS days_waiting,
         m.distance_km,
         m.priority_score,
         m.status
       FROM organ_match_log m
       JOIN organ_waitlist w ON w.waitlist_id = m.waitlist_id
       JOIN hospitals h ON h.hospital_id = w.hospital_id
       WHERE m.organ_id = $1 AND m.status = 'PROPOSED'
       ORDER BY m.rank_no ASC`,
      [organId]
    );

    // 3. Mask other hospitals' patient names for staff
    const userHospitalId = req.user.hospital_id;
    const isStaff = req.user.role === 'STAFF';

    const result = rows.map((row) => {
      const isOtherHospital = isStaff && row.hospital_id !== userHospitalId;
      return {
        organ_match_id: row.organ_match_id,
        rank_no: row.rank_no,
        waitlist_id: row.waitlist_id,
        patient_name: isOtherHospital ? `Patient #${row.waitlist_id}` : row.patient_name,
        hospital_name: row.hospital_name,
        blood_group: row.blood_group,
        urgency_score: row.urgency_score,
        days_waiting: row.days_waiting,
        distance_km: row.distance_km,
        priority_score: row.priority_score,
        status: row.status,
      };
    });

    return res.json(result);
  })
);

// ── 9. POST /api/organs/matches/:id/confirm ──────────────────
// Roles: STAFF (recipient's hospital), ADMIN
// Runs confirm_organ_match → { ok: true }
router.post(
  '/matches/:id/confirm',
  requireAuth,
  requireRole('STAFF', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const matchId = parseInt(req.params.id, 10);
    if (isNaN(matchId)) {
      return res.status(400).json({ error: 'Invalid match proposal ID' });
    }

    // Verify hospital ownership for staff
    const check = await pool.query(
      `SELECT m.organ_match_id, w.hospital_id, m.status AS proposal_status
       FROM organ_match_log m
       JOIN organ_waitlist w ON w.waitlist_id = m.waitlist_id
       WHERE m.organ_match_id = $1`,
      [matchId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Organ match proposal not found' });
    }

    if (req.user.role === 'STAFF' && check.rows[0].hospital_id !== req.user.hospital_id) {
      return res.status(403).json({
        error: "Access denied: You may only confirm organ matches for your own hospital's patients",
      });
    }

    // Calls database function which updates pledge, patient, proposal, and triggers audit
    await pool.query('SELECT confirm_organ_match($1::int)', [matchId]);

    return res.json({ ok: true });
  })
);

module.exports = router;
