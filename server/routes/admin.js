'use strict';
// routes/admin.js
// All /admin/* routes — every one requires ADMIN role.
// Mounted at /api/admin by server.js auto-loading.
//
// Routes:
//   GET  /admin/stats                       Dashboard numbers
//   GET  /admin/users                       Donors + staff lists
//   PATCH /admin/users/:role/:id/active     Activate / deactivate a user
//   GET  /admin/audit                       Audit log (latest 100 by default)
//   GET  /admin/notifications               Pending/sent/failed counts + recent failures
//   POST /admin/jobs/restore-eligibility    Manually trigger eligibility restore

const express      = require('express');
const pool         = require('../config/db');
const asyncHandler = require('../lib/asyncHandler');
const { audit }    = require('../lib/audit');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Every route in this file requires ADMIN.
// We use router.use() so we don't have to repeat it on every endpoint.
router.use(requireAuth, requireRole('ADMIN'));

// ── GET /admin/stats ──────────────────────────────────────────────────────────
// Returns summary counts for the admin dashboard.
// Response shape matches contract §6 exactly.
router.get('/stats', asyncHandler(async (_req, res) => {
  // Run all count queries in parallel with Promise.all for speed.
  const [donors, staff, admins, hospitals, notifs, recentAudit] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS cnt FROM donors"),
    pool.query("SELECT COUNT(*)::int AS cnt FROM hospital_staff"),
    pool.query("SELECT COUNT(*)::int AS cnt FROM admins"),
    pool.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE NOT verified)::int AS unverified FROM hospitals"),
    pool.query("SELECT COUNT(*) FILTER (WHERE status='PENDING')::int AS pending, COUNT(*) FILTER (WHERE status='FAILED')::int AS failed FROM notifications"),
    pool.query(`SELECT log_id, actor_role, actor_id, action, entity, entity_id, created_at
                FROM audit_log ORDER BY created_at DESC LIMIT 5`),
  ]);

  res.json({
    users: {
      donors: donors.rows[0].cnt,
      staff:  staff.rows[0].cnt,
      admins: admins.rows[0].cnt,
    },
    hospitals: {
      total:      hospitals.rows[0].total,
      unverified: hospitals.rows[0].unverified,
    },
    notifications: {
      pending: notifs.rows[0].pending,
      failed:  notifs.rows[0].failed,
    },
    recent_audit: recentAudit.rows,
  });
}));

// ── GET /admin/users ──────────────────────────────────────────────────────────
// Returns all donors and all staff (never includes password_hash).
router.get('/users', asyncHandler(async (_req, res) => {
  const [donorRows, staffRows] = await Promise.all([
    pool.query(
      'SELECT donor_id, name, email, is_active FROM donors ORDER BY name'
    ),
    pool.query(
      `SELECT hs.staff_id, hs.name, hs.email, h.name AS hospital_name, hs.is_active
       FROM hospital_staff hs
       JOIN hospitals h ON h.hospital_id = hs.hospital_id
       ORDER BY hs.name`
    ),
  ]);

  res.json({ donors: donorRows.rows, staff: staffRows.rows });
}));

// ── PATCH /admin/users/:role/:id/active ───────────────────────────────────────
// Activate or deactivate a donor or staff member.
// :role must be "donor" or "staff" (lowercase in the URL, as per contract §6).
// Writes an audit row via lib/audit.js (no DB trigger for this action).
router.patch('/users/:role/:id/active', asyncHandler(async (req, res) => {
  const { role, id } = req.params;
  const { is_active } = req.body;

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: '"is_active" must be a boolean.' });
  }

  let table, pkCol;
  if (role === 'donor') {
    table = 'donors';
    pkCol = 'donor_id';
  } else if (role === 'staff') {
    table = 'hospital_staff';
    pkCol = 'staff_id';
  } else {
    return res.status(400).json({ error: ':role must be "donor" or "staff".' });
  }

  const { rows } = await pool.query(
    `UPDATE ${table} SET is_active = $1 WHERE ${pkCol} = $2 RETURNING ${pkCol} AS id, is_active`,
    [is_active, id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: `${role} not found.` });
  }

  // Write audit row — this action has no DB trigger, so we call lib/audit.js manually.
  await audit({
    actorRole: 'ADMIN',
    actorId:   req.user.id,
    action:    is_active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    entity:    table,
    entityId:  parseInt(id, 10),
  });

  res.json(rows[0]);
}));

// ── GET /admin/audit ──────────────────────────────────────────────────────────
// Returns the audit log, newest first.  Optional ?limit=N (default 100).
router.get('/audit', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);

  const { rows } = await pool.query(
    `SELECT log_id, actor_role, actor_id, action, entity, entity_id, created_at
     FROM audit_log
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );

  res.json(rows);
}));

// ── GET /admin/notifications ──────────────────────────────────────────────────
// Returns notification queue health: counts by status + recent failures.
router.get('/notifications', asyncHandler(async (_req, res) => {
  const [counts, failures] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'SENT')::int    AS sent,
         COUNT(*) FILTER (WHERE status = 'FAILED')::int  AS failed
       FROM notifications`
    ),
    pool.query(
      `SELECT notification_id, donor_id, type, channel, subject, attempts, created_at
       FROM notifications
       WHERE status = 'FAILED'
       ORDER BY created_at DESC
       LIMIT 20`
    ),
  ]);

  res.json({
    counts:          counts.rows[0],
    recent_failures: failures.rows,
  });
}));

// ── POST /admin/jobs/restore-eligibility ──────────────────────────────────────
// Manually triggers restore_donor_eligibility() (written by Member A).
// Returns the count of donors restored.
// Handle "function does not exist" gracefully — Member A may not have merged yet.
router.post('/jobs/restore-eligibility', asyncHandler(async (req, res) => {
  let result;

  try {
    const { rows } = await pool.query('SELECT restore_donor_eligibility() AS restored');
    result = rows[0].restored;
  } catch (err) {
    // Code 42883 = undefined_function in PostgreSQL.
    if (err.code === '42883') {
      return res.status(500).json({
        error: 'restore_donor_eligibility() does not exist yet. Member A needs to merge database/10_blood_matching.sql first.',
        code:  'FUNCTION_NOT_FOUND',
      });
    }
    throw err; // all other DB errors go to the central error handler
  }

  // Write an audit row for the manual job run.
  await audit({
    actorRole: 'ADMIN',
    actorId:   req.user.id,
    action:    'ELIGIBILITY_RESTORE_JOB',
    entity:    null,
    entityId:  null,
  });

  res.json({ restored: result });
}));

module.exports = router;
