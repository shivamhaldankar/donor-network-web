'use strict';
// scripts/initDb.js
// Executes all database SQL scripts in order to set up tables, views, triggers, and initial seed data.
// Usage: node scripts/initDb.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const sqlFiles = [
  '01_schema.sql',
  '02_seed.sql',
  '10_blood_matching.sql',
  '11_scheduler.sql',
  '20_audit_notifications.sql',
  '30_organ_matching.sql',
];

(async () => {
  const dbDir = path.join(__dirname, '../../database');
  console.log('[initDb] Starting database initialization...');

  try {
    for (const file of sqlFiles) {
      const filePath = path.join(dbDir, file);
      if (!fs.existsSync(filePath)) {
        console.warn(`[initDb] Warning: File not found: ${file}`);
        continue;
      }
      console.log(`[initDb] Executing ${file}...`);
      const sql = fs.readFileSync(filePath, 'utf8');
      await pool.query(sql);
      console.log(`[initDb] Completed ${file}`);
    }

    console.log('[initDb] All SQL migration scripts executed successfully!');
  } catch (err) {
    console.error('[initDb] Error during database initialization:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
