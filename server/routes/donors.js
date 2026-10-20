'use strict';
// server/routes/donors.js
// Owner: Member A (Slice 1)
// Routes for donor profile, donation history, received matches, and public eligible directory.

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../lib/asyncHandler');

// ── GET /api/donors/me ────────────────────────────────────────────────────────
// Roles: DONOR
// Returns the signed-in donor's profile along with eligibility countdown metrics.
// Password hash is strictly excluded.
router.get(
  '/me',
  requireAuth,
  requireRole('DONOR'),
  asyncHandler(async (req, res) => {
    const query = `
      SELECT
        d.donor_id,
        d.name,
        d.email,
        d.phone,
        d.blood_type,
        d.city,
        d.latitude,
        d.longitude,
        d.notify_email,
        d.notify_sms,
        e.last_donation_date,
        e.is_eligible,
        e.next_eligible_date,
        e.days_remaining
      FROM donors d
      JOIN vw_donor_eligibility e ON d.donor_id = e.donor_id
      WHERE d.donor_id = $1
    `;
    const { rows } = await pool.query(query, [req.user.id]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Donor profile not found.' });
    }

    const donor = rows[0];
    res.json({
      donor_id:           donor.donor_id,
      name:               donor.name,
      email:              donor.email,
      phone:              donor.phone,
      blood_type:         donor.blood_type,
      city:               donor.city,
      latitude:           donor.latitude,
      longitude:          donor.longitude,
      notify_email:       donor.notify_email,
      notify_sms:         donor.notify_sms,
      last_donation_date: donor.last_donation_date,
      is_eligible:        donor.is_eligible,
      next_eligible_date: donor.next_eligible_date,
      days_remaining:     donor.days_remaining,
      total_days:         90,
    });
  })
);

// ── PUT /api/donors/me ────────────────────────────────────────────────────────
// Roles: DONOR
// Updates donor contact info, coordinates, and notification preferences.
// Returns the updated profile with the same shape as GET /me.
router.put(
  '/me',
  requireAuth,
  requireRole('DONOR'),
  asyncHandler(async (req, res) => {
    const { name, phone, city, latitude, longitude, notify_email, notify_sms } = req.body;

    // Validate coordinates if provided
    if (latitude !== undefined && latitude !== null) {
      const latNum = parseFloat(latitude);
      if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        return res.status(400).json({ error: 'Latitude must be between -90 and 90.' });
      }
    }

    if (longitude !== undefined && longitude !== null) {
      const lonNum = parseFloat(longitude);
      if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
        return res.status(400).json({ error: 'Longitude must be between -180 and 180.' });
      }
    }

    // Dynamic update builder
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(name);
    }
    if (phone !== undefined) {
      fields.push(`phone = $${idx++}`);
      values.push(phone);
    }
    if (city !== undefined) {
      fields.push(`city = $${idx++}`);
      values.push(city);
    }
    if (latitude !== undefined) {
      fields.push(`latitude = $${idx++}`);
      values.push(latitude === null ? null : parseFloat(latitude));
    }
    if (longitude !== undefined) {
      fields.push(`longitude = $${idx++}`);
      values.push(longitude === null ? null : parseFloat(longitude));
    }
    if (notify_email !== undefined) {
      fields.push(`notify_email = $${idx++}`);
      values.push(Boolean(notify_email));
    }
    if (notify_sms !== undefined) {
      fields.push(`notify_sms = $${idx++}`);
      values.push(Boolean(notify_sms));
    }

    if (fields.length > 0) {
      values.push(req.user.id);
      const updateQuery = `
        UPDATE donors
        SET ${fields.join(', ')}
        WHERE donor_id = $${idx}
      `;
      await pool.query(updateQuery, values);
    }

    // Return the updated profile
    const selectQuery = `
      SELECT
        d.donor_id,
        d.name,
        d.email,
        d.phone,
        d.blood_type,
        d.city,
        d.latitude,
        d.longitude,
        d.notify_email,
        d.notify_sms,
        e.last_donation_date,
        e.is_eligible,
        e.next_eligible_date,
        e.days_remaining
      FROM donors d
      JOIN vw_donor_eligibility e ON d.donor_id = e.donor_id
      WHERE d.donor_id = $1
    `;
    const { rows } = await pool.query(selectQuery, [req.user.id]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Donor profile not found.' });
    }

    const donor = rows[0];
    res.json({
      donor_id:           donor.donor_id,
      name:               donor.name,
      email:              donor.email,
      phone:              donor.phone,
      blood_type:         donor.blood_type,
      city:               donor.city,
      latitude:           donor.latitude,
      longitude:          donor.longitude,
      notify_email:       donor.notify_email,
      notify_sms:         donor.notify_sms,
      last_donation_date: donor.last_donation_date,
      is_eligible:        donor.is_eligible,
      next_eligible_date: donor.next_eligible_date,
      days_remaining:     donor.days_remaining,
      total_days:         90,
    });
  })
);

// ── GET /api/donors/me/donations ──────────────────────────────────────────────
// Roles: DONOR
// Returns donation history for the authenticated donor, newest first.
router.get(
  '/me/donations',
  requireAuth,
  requireRole('DONOR'),
  asyncHandler(async (req, res) => {
    const query = `
      SELECT
        d.donation_id,
        d.donation_type,
        d.units,
        d.donated_on,
        h.name AS hospital_name
      FROM donations d
      JOIN hospitals h ON d.hospital_id = h.hospital_id
      WHERE d.donor_id = $1
      ORDER BY d.donated_on DESC, d.donation_id DESC
    `;
    const { rows } = await pool.query(query, [req.user.id]);
    res.json(rows);
  })
);

// ── GET /api/donors/me/matches ────────────────────────────────────────────────
// Roles: DONOR
// Returns matches where the authenticated donor was contacted, newest first.
router.get(
  '/me/matches',
  requireAuth,
  requireRole('DONOR'),
  asyncHandler(async (req, res) => {
    const query = `
      SELECT
        m.match_id,
        m.request_id,
        h.name AS hospital_name,
        h.city AS hospital_city,
        r.blood_type_needed,
        r.urgency,
        m.distance_km,
        m.matched_on,
        m.contacted_status,
        m.responded_on
      FROM match_log m
      JOIN requests r ON m.request_id = r.request_id
      JOIN hospitals h ON r.hospital_id = h.hospital_id
      WHERE m.donor_id = $1
      ORDER BY m.matched_on DESC
    `;
    const { rows } = await pool.query(query, [req.user.id]);
    res.json(rows);
  })
);

// ── GET /api/donors/eligible ──────────────────────────────────────────────────
// Roles: STAFF, ADMIN
// Public directory of eligible donors for staff and admins.
// Privacy rule: phone and email are never exposed here.
router.get(
  '/eligible',
  requireAuth,
  requireRole('STAFF', 'ADMIN'),
  asyncHandler(async (_req, res) => {
    const query = `
      SELECT
        donor_id,
        name,
        blood_type,
        city,
        last_donation_date
      FROM vw_eligible_donors
      ORDER BY name ASC
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  })
);

module.exports = router;
