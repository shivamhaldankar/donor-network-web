'use strict';
// lib/asyncHandler.js
// Wraps an async Express route handler so that any thrown error (or rejected
// Promise) is automatically forwarded to Express's next() error handler.
//
// Without this wrapper, you'd need a try/catch in every async route:
//   router.get('/x', async (req, res, next) => { try { … } catch(e) { next(e); } })
//
// With asyncHandler you write:
//   router.get('/x', asyncHandler(async (req, res) => { … }))
// and any throw automatically calls next(err).
//
// This is a standard Express pattern — the contract specifies this exact signature.
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
