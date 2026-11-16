'use strict';
// config/db.js
// Creates the shared PostgreSQL connection pool and configures type parsers.
// Every other file does:  const pool = require('../config/db');
//                         pool.query('SELECT …', [params])

const { Pool, types } = require('pg');
require('dotenv').config();

// ── Type parsers ──────────────────────────────────────────────────────────────
// By default the pg library returns some column types as strings, which causes
// subtle bugs (e.g. "18" instead of 18 for a BigSerial PK).  We fix all three
// problem types here, in one place, so every query in the whole app gets the
// right JavaScript type automatically.

// DATE (OID 1082): return as a plain "YYYY-MM-DD" string, not a JS Date object.
// JS Date objects shift the value by timezone offset, which garbles date-only columns.
types.setTypeParser(1082, (val) => val);

// NUMERIC / DECIMAL (OID 1700): return as a JS number, not a string.
// pg returns NUMERIC as strings to avoid float precision loss, but our values
// (distances, priority scores) are small enough that parseFloat is fine.
types.setTypeParser(1700, (val) => parseFloat(val));

// INT8 / BIGINT (OID 20): return as a JS number, not a string.
// BigSerial PKs (log_id in audit_log) come back as strings by default.
// Safe for our use: all IDs stay well within Number.MAX_SAFE_INTEGER.
types.setTypeParser(20, (val) => parseInt(val, 10));

// ── Connection pool ───────────────────────────────────────────────────────────
// A pool reuses connections instead of opening a new TCP connection per query.
// Supports both individual DB_* env vars (local dev) and DATABASE_URL (cloud deployments).
const connectionString = process.env.DATABASE_URL;
const useSsl = process.env.DB_SSL === 'true' || Boolean(connectionString && !connectionString.includes('localhost'));

const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432', 10),
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME     || 'donor_network',
        ssl:      useSsl ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
      }
);

// Log connection errors so they appear in the console instead of silently swallowing them.
pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

module.exports = pool;
