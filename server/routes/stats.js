'use strict';
// ============================================================
// Pulse Stats Routes
// Owner: Member C (Slice 3: Organ Matching & Dashboards)
// Contract §6:
//   GET /stats/staff | STAFF | → { open_critical_requests, eligible_donors, waitlist_size }
//   (own hospital for the first and last)
// Mounted at: /api/stats
// ============================================================

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../lib/asyncHandler');

// ── GET /api/stats/staff ─────────────────────────────────────
// Roles: STAFF
// Returns: { open_critical_requests, eligible_donors, waitlist_size }
router.get(
  '/staff',
  requireAuth,
  requireRole('STAFF'),
  asyncHandler(async (req, res) => {
    const hospitalId = req.user.hospital_id;

    // 1. Open critical requests for own hospital (status OPEN or MATCHED per contract §8)
    const critReqQuery = pool.query(
      `SELECT COUNT(*)::int AS count
       FROM requests
       WHERE hospital_id = $1
         AND urgency = 'CRITICAL'
         AND status IN ('OPEN', 'MATCHED')`,
      [hospitalId]
    );

    // 2. Active eligible donors across region (single eligibility definition per contract §1)
    const donorsQuery = pool.query(
      `SELECT COUNT(*)::int AS count
       FROM donors
       WHERE is_active = TRUE
         AND (last_donation_date IS NULL OR last_donation_date <= CURRENT_DATE - 90)`
    );

    // 3. Active organ waitlist size for own hospital
    const waitlistQuery = pool.query(
      `SELECT COUNT(*)::int AS count
       FROM organ_waitlist
       WHERE hospital_id = $1
         AND status = 'WAITING'`,
      [hospitalId]
    );

    const [critRes, donorsRes, waitlistRes] = await Promise.all([
      critReqQuery,
      donorsQuery,
      waitlistQuery,
    ]);

    return res.json({
      open_critical_requests: critRes.rows[0].count,
      eligible_donors: donorsRes.rows[0].count,
      waitlist_size: waitlistRes.rows[0].count,
    });
  })
);

module.exports = router;
