'use strict';
// middleware/auth.js
// Three exported middleware functions that every protected route imports.
// Contract §4 defines their exact names and signatures — do not rename them.

const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// ── requireAuth ───────────────────────────────────────────────────────────────
// Reads the "Authorization: Bearer <token>" header, verifies the JWT signature,
// and attaches the decoded payload to req.user so downstream handlers can read
// { id, role, name, hospital_id } without hitting the database again.
// Returns 401 if the header is missing, the token is expired, or the signature
// is wrong.  Does NOT check is_active here — login already guards that.
const requireAuth = (req, res, next) => {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  try {
    // jwt.verify throws if the token is expired or the secret doesn't match.
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id:          payload.id,
      role:        payload.role,
      name:        payload.name,
      hospital_id: payload.hospital_id ?? null,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please sign in again.' });
  }
};

// ── requireRole ───────────────────────────────────────────────────────────────
// Higher-order function: call it with one or more allowed role strings and it
// returns Express middleware.
// Usage:  router.get('/x', requireAuth, requireRole('STAFF', 'ADMIN'), handler)
// Must be placed AFTER requireAuth so req.user is already set.
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Access denied. Required role: ${roles.join(' or ')}.`,
    });
  }
  next();
};

// ── requireVerifiedHospital ───────────────────────────────────────────────────
// Extra guard for routes where staff create data (requests, donations, waitlist).
// Looks up the hospital's verified flag from the database — not from the JWT —
// because an admin could unverify a hospital after the staff member signed in.
// Returns 403 if the hospital is not yet verified by an admin.
const requireVerifiedHospital = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT verified FROM hospitals WHERE hospital_id = $1',
      [req.user.hospital_id]
    );

    if (!rows.length || !rows[0].verified) {
      return res.status(403).json({
        error: 'Your hospital has not been verified by an admin yet.',
        code:  'HOSPITAL_NOT_VERIFIED',
      });
    }

    next();
  } catch (err) {
    next(err); // pass DB errors to the central error handler
  }
};

module.exports = { requireAuth, requireRole, requireVerifiedHospital };
