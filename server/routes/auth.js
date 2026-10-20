'use strict';
// routes/auth.js
// Handles public sign-up, login, and token verification.
// Mounted at /api/auth by server.js auto-loading.
//
// Security decisions worth explaining in a viva:
//   - bcrypt 10 rounds: slow enough to resist brute-force, fast enough for a web app.
//   - Same 401 message for unknown email and wrong password: don't reveal which failed
//     (an attacker shouldn't be able to enumerate valid emails).
//   - JWT payload contains only non-sensitive identifiers; no password, no hash.
//   - password_hash is never included in any response.

const express    = require('express');
const bcrypt     = require('bcrypt');
const jwt        = require('jsonwebtoken');
const pool       = require('../config/db');
const asyncHandler      = require('../lib/asyncHandler');
const { requireAuth }   = require('../middleware/auth');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Hash a plain-text password with bcrypt (10 salt rounds as per contract §4). */
const hashPassword = (plain) => bcrypt.hash(plain, 10);

/** Sign a JWT with the standard payload shape; expires in 7 days. */
const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

/** Minimal password validation: at least 6 characters. */
const validatePassword = (p) => typeof p === 'string' && p.length >= 6;

// ── POST /auth/signup ─────────────────────────────────────────────────────────
// Creates a DONOR or STAFF account and returns a JWT immediately (no separate login step).
// 409 if email already exists (handled by the central error handler via code 23505).
router.post('/signup', asyncHandler(async (req, res) => {
  const { role, name, email, password } = req.body;

  // Validate fields common to both roles.
  if (!role || !name || !email || !password) {
    return res.status(400).json({ error: 'role, name, email, and password are required.' });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const hash = await hashPassword(password);

  if (role === 'DONOR') {
    const { phone, blood_type, city, latitude, longitude } = req.body;

    if (!phone || !blood_type) {
      return res.status(400).json({ error: 'phone and blood_type are required for donors.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO donors
         (name, email, password_hash, phone, blood_type, city, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING donor_id, name, email`,
      [name, email, hash, phone, blood_type, city || null, latitude || null, longitude || null]
    );

    const donor = rows[0];
    const token = signToken({ id: donor.donor_id, role: 'DONOR', name: donor.name });
    return res.status(201).json({ token, user: { id: donor.donor_id, role: 'DONOR', name: donor.name } });
  }

  if (role === 'STAFF') {
    const { hospital_id, staff_role } = req.body;

    if (!hospital_id) {
      return res.status(400).json({ error: 'hospital_id is required for staff.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO hospital_staff
         (name, email, password_hash, hospital_id, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING staff_id, name, email, hospital_id`,
      [name, email, hash, hospital_id, staff_role || null]
    );

    const staff = rows[0];
    const token = signToken({
      id: staff.staff_id,
      role: 'STAFF',
      name: staff.name,
      hospital_id: staff.hospital_id,
    });
    return res.status(201).json({
      token,
      user: { id: staff.staff_id, role: 'STAFF', name: staff.name, hospital_id: staff.hospital_id },
    });
  }

  // Admin accounts are created only by npm run seed:admin — never via sign-up.
  return res.status(400).json({ error: 'role must be DONOR or STAFF. Admin accounts cannot be created via sign-up.' });
}));

// ── POST /auth/login ──────────────────────────────────────────────────────────
// Authenticates a DONOR, STAFF, or ADMIN with email + password.
// Security: unknown email and wrong password produce the *same* 401 message.
router.post('/login', asyncHandler(async (req, res) => {
  const { role, email, password } = req.body;

  if (!role || !email || !password) {
    return res.status(400).json({ error: 'role, email, and password are required.' });
  }

  // ── Look up the user by role + email ──────────────────────────────────────
  let user = null;

  if (role === 'DONOR') {
    const { rows } = await pool.query(
      'SELECT donor_id AS id, name, email, password_hash, is_active, NULL::int AS hospital_id FROM donors WHERE email = $1',
      [email]
    );
    user = rows[0] || null;
  } else if (role === 'STAFF') {
    const { rows } = await pool.query(
      'SELECT staff_id AS id, name, email, password_hash, is_active, hospital_id FROM hospital_staff WHERE email = $1',
      [email]
    );
    user = rows[0] || null;
  } else if (role === 'ADMIN') {
    const { rows } = await pool.query(
      'SELECT admin_id AS id, name, email, password_hash, is_active, NULL::int AS hospital_id FROM admins WHERE email = $1',
      [email]
    );
    user = rows[0] || null;
  } else {
    return res.status(400).json({ error: 'role must be DONOR, STAFF, or ADMIN.' });
  }

  // ── Constant-time password check ──────────────────────────────────────────
  // If the user doesn't exist we still call bcrypt.compare against a dummy hash.
  // This prevents timing attacks that could reveal whether an email is registered:
  // an attacker timing many login attempts could distinguish "user not found"
  // (fast) from "wrong password" (slow bcrypt) without this mitigation.
  const DUMMY_HASH = '$2b$10$invalidhashfortimingatk000000000000000000000000000000000';
  const hashToCheck = user ? user.password_hash : DUMMY_HASH;
  const passwordOk  = await bcrypt.compare(password, hashToCheck);

  if (!user || !passwordOk) {
    // Same message for both cases — don't reveal which failed.
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // ── Active check ──────────────────────────────────────────────────────────
  // Deactivated users can't sign in — return 403 (Forbidden), not 401.
  if (!user.is_active) {
    return res.status(403).json({ error: 'This account has been deactivated. Contact an admin.' });
  }

  // ── Issue token ───────────────────────────────────────────────────────────
  const payload = {
    id:   user.id,
    role,
    name: user.name,
    ...(user.hospital_id ? { hospital_id: user.hospital_id } : {}),
  };
  const token = signToken(payload);

  return res.json({
    token,
    user: { id: user.id, role, name: user.name, ...(user.hospital_id ? { hospital_id: user.hospital_id } : {}) },
  });
}));

// ── GET /auth/me ──────────────────────────────────────────────────────────────
// Returns the user embedded in the current token.
// The front end calls this on page load to restore the session without a full login.
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
