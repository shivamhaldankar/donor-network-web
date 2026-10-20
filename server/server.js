'use strict';
// server.js
// Main Express application entry point.
// Responsibilities:
//   1. Load env vars from .env
//   2. Configure middleware (CORS, JSON body parser)
//   3. Health-check route
//   4. Auto-mount every routes/*.js at /api/<filename>  (no manual registration needed)
//   5. Start listening, then auto-start every jobs/*.js worker
//   6. Central error handler that maps PostgreSQL error codes → HTTP status codes

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
require('dotenv').config();

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
// CORS: allow requests from the Vite dev server (port 5173) and any other origin
// in development.  Tighten the origin list before deploying to production.
app.use(cors());
app.use(express.json()); // parse application/json request bodies

// ── Health check ──────────────────────────────────────────────────────────────
// A simple ping that teammates and CI can use to verify the server is up.
// No auth required.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Auto-mount routes ─────────────────────────────────────────────────────────
// Reads every .js file in routes/ and mounts it at /api/<filename-without-.js>.
// Convention: routes/auth.js → /api/auth, routes/admin.js → /api/admin, etc.
// Adding a new feature: just create routes/myfeature.js — nothing here changes.
const routesDir = path.join(__dirname, 'routes');
if (fs.existsSync(routesDir)) {
  fs.readdirSync(routesDir)
    .filter((f) => f.endsWith('.js'))
    .forEach((file) => {
      const name   = file.replace('.js', '');          // e.g. "auth"
      const router = require(path.join(routesDir, file));
      app.use(`/api/${name}`, router);
      console.log(`[routes] Mounted /api/${name}`);
    });
}

// ── Central error handler ─────────────────────────────────────────────────────
// Express calls this when a route calls next(err) or asyncHandler catches a throw.
// We map PostgreSQL error codes to meaningful HTTP responses so routes can stay thin
// (they just insert/update and let errors bubble up).
//
// PostgreSQL error codes we handle:
//   P0001 — RAISE EXCEPTION from PL/pgSQL (our business rules).
//            Convention: 'CODE: human message' — we parse and return { error, code }.
//   23505 — unique_violation (duplicate email, duplicate match, etc.) → 409
//   23503 — foreign_key_violation (bad hospital_id, etc.)             → 400
//   23514 — check_violation (bad blood_type, urgency out of range…)   → 400
//   22P02 — invalid_text_representation (e.g. passing text where int expected) → 400
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const code = err.code; // PostgreSQL error code (a 5-char string)

  if (code === 'P0001') {
    // Business-rule exception raised by a PL/pgSQL trigger or function.
    // Format agreed in the contract: 'SOME_CODE: Human-readable message'
    const raw     = err.message || '';
    const colonAt = raw.indexOf(': ');
    if (colonAt !== -1) {
      const errCode = raw.slice(0, colonAt).trim();
      const errMsg  = raw.slice(colonAt + 2).trim();
      return res.status(409).json({ error: errMsg, code: errCode });
    }
    // Fallback if the message doesn't follow the convention.
    return res.status(409).json({ error: raw });
  }

  if (code === '23505') {
    // Unique constraint violation — most commonly a duplicate email on sign-up.
    return res.status(409).json({ error: 'A record with that value already exists.' });
  }

  if (['23503', '23514', '22P02'].includes(code)) {
    // Foreign key, CHECK constraint, or type mismatch — always a client mistake.
    return res.status(400).json({ error: err.detail || err.message });
  }

  // Everything else is an unexpected server error. Log it (for the terminal) but
  // don't leak stack traces to the client.
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start server and launch background jobs ───────────────────────────────────
const PORT = parseInt(process.env.PORT || '5000', 10);

app.listen(PORT, () => {
  console.log(`[server] Pulse API listening on http://localhost:${PORT}`);

  // Auto-start every jobs/*.js that exports a start() function.
  // Convention: jobs/notifier.js → notifier.start(), jobs/eligibility.js → eligibility.start()
  // Adding a job: just create jobs/myjob.js with module.exports = { start } — nothing here changes.
  const jobsDir = path.join(__dirname, 'jobs');
  if (fs.existsSync(jobsDir)) {
    fs.readdirSync(jobsDir)
      .filter((f) => f.endsWith('.js'))
      .forEach((file) => {
        const job = require(path.join(jobsDir, file));
        if (typeof job.start === 'function') {
          job.start();
          console.log(`[jobs] Started ${file.replace('.js', '')}`);
        }
      });
  }
});

module.exports = app; // exported for potential test usage
