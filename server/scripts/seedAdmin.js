'use strict';
// scripts/seedAdmin.js
// Creates the admin account so the application has at least one admin.
// Run with:  npm run seed:admin
//
// Why a script instead of the seed SQL?
//   The SQL seed (02_seed.sql) is for demo donors and staff — data that goes into
//   version control with demo passwords.  Admin credentials come from .env so they
//   never appear in any committed file.
//
// Safe to run multiple times: if the email already exists, it skips the insert.

require('dotenv').config();
const bcrypt = require('bcrypt');
const pool   = require('../config/db');

(async () => {
  const email    = process.env.ADMIN_EMAIL    || 'admin@pulse.test';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';
  const name     = 'System Admin';

  try {
    // Check if the admin account already exists.
    const { rows } = await pool.query(
      'SELECT admin_id FROM admins WHERE email = $1',
      [email]
    );

    if (rows.length) {
      console.log(`[seed:admin] Admin account already exists for ${email} — skipping.`);
      process.exit(0);
    }

    // Hash the password with 10 bcrypt rounds (same as user sign-up).
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3)',
      [name, email, hash]
    );

    console.log(`[seed:admin] Admin created: ${email}`);
    console.log(`[seed:admin] Use password: ${password}`);
    console.log('[seed:admin] Change ADMIN_PASSWORD in .env before using in production!');
  } catch (err) {
    console.error('[seed:admin] Error:', err.message);
    process.exit(1);
  } finally {
    // Close the pool so the script exits cleanly (otherwise Node waits for connections).
    await pool.end();
  }
})();
