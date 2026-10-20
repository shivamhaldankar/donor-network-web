# Pulse — Slice B Notes

Member B deliverable: server foundation, RBAC, admin routes, notification triggers, and notifier worker.

---

## 1. Authentication: how it works, and why

### Password hashing (bcrypt)

When a user signs up, their password is **never stored in plain text**. Instead:

1. We call `bcrypt.hash(password, 10)` — this runs the password through the bcrypt algorithm with 10 "cost rounds".
2. bcrypt automatically generates a random salt internally and embeds it in the hash string.
3. The resulting string (e.g. `$2b$10$...`) is stored in `password_hash`.

**Why 10 rounds?** Each extra round doubles the work. 10 rounds means ~100 ms on a modern CPU — fast enough for a login, but slow enough that brute-forcing millions of guesses is impractical.

**On login:** we call `bcrypt.compare(plainTextPassword, storedHash)`. This is constant-time: it doesn't reveal whether the email is registered. An attacker timing login requests cannot distinguish "email not found" (fast) from "wrong password" (also slow) — we call `bcrypt.compare` even for unknown emails (against a dummy hash) to prevent this timing attack.

### JSON Web Tokens (JWT)

After a successful login or signup, we sign a JWT with:
```
payload = { id, role, name, hospital_id? }
```
- **Signed** with `JWT_SECRET` using HMAC-SHA256 (`HS256`). The signature prevents tampering.
- **Expires in 7 days**. After that, the user must log in again.
- The **password hash is never in the token** and never in any HTTP response.

The front end stores the token (in localStorage) and sends it in every protected request as `Authorization: Bearer <token>`.

### Role and ownership checks

Three middleware functions enforce access:

| Middleware | What it does |
|---|---|
| `requireAuth` | Verifies the JWT signature; attaches `req.user = { id, role, name, hospital_id }` |
| `requireRole('STAFF', 'ADMIN')` | Returns 403 if `req.user.role` isn't in the allowed list |
| `requireVerifiedHospital` | Queries the DB for the hospital's `verified` flag; returns 403 if false |

`requireVerifiedHospital` reads live from the database (not from the JWT) because an admin could unverify a hospital after the staff member logged in. The JWT would still say "hospital 4" but the DB now says "unverified".

**Known limitations:** JWTs in browser localStorage are vulnerable to XSS attacks. httpOnly cookies with refresh tokens would be the production approach. There is also no rate limiting on the login endpoint.

---

## 2. Audit log and notification triggers

### Why triggers instead of application code?

The audit triggers fire **inside the database**, so they run whether the update comes from the Express API, psql, pgAdmin, or a direct DB connection. If the audit logic were in the Node.js route handler, a DBA running a direct query would bypass it. Triggers make the audit tamper-proof at the database level.

### `trg_audit_requests` (on `requests`)
- **INSERT** → writes `REQUEST_CREATED`. The actor is the `staff_id` on the row.
- **UPDATE where `status` changed** → writes `REQUEST_STATUS_CHANGED`. Uses `IS DISTINCT FROM` to avoid firing on updates where status didn't actually change.

### `trg_audit_donations` (on `donations`)
- **INSERT** → writes `DONATION_LOGGED`. Actor is `SYSTEM` (no user in a DB trigger context).

### `trg_audit_hospitals` (on `hospitals`)
- **UPDATE where `verified` changed** → writes `HOSPITAL_VERIFIED` or `HOSPITAL_UNVERIFIED`.

### `trg_audit_organ_match` (on `organ_match_log`)
- **UPDATE where `status` becomes `ACCEPTED`** → writes `ORGAN_MATCH_CONFIRMED`.

### `trg_after_match` (on `match_log`)
- **INSERT** (fired by Member A's `find_matching_donors()`) → inserts one `notifications` row per channel the donor has enabled.
- **Privacy rule:** the patient's name is **never** included in the notification. Only hospital name, city, blood type, and approximate distance.
- Checks `notify_email` for EMAIL; checks `notify_sms AND phone IS NOT NULL` for SMS (no point queuing an SMS with no phone number).

---

## 3. Notification queue: design decisions

### The queue pattern

Notifications are **inserted by a DB trigger** and **sent by a Node.js worker**. This decouples the two:
- A blood request succeeds immediately — the trigger just inserts rows; no SMTP call happens inline.
- If the email server is down, requests still work; notifications stay `PENDING` until the server recovers.
- This satisfies **T18**: "request creation while the notifier is stopped → request still succeeds".

### `FOR UPDATE SKIP LOCKED`

The worker picks up to 20 `PENDING` rows inside a transaction using `SELECT … FOR UPDATE SKIP LOCKED`:
- `FOR UPDATE` locks the selected rows so no other transaction can modify them.
- `SKIP LOCKED` skips rows already locked by another transaction, instead of waiting.

**Why?** If we ever ran two notifier workers (or the previous tick's transaction hadn't committed yet), two workers could try to send the same notification. `SKIP LOCKED` makes each worker take a non-overlapping set of rows. This is a standard PostgreSQL pattern for reliable job queues.

### Retry logic

| Attempt | Outcome |
|---|---|
| 1st | Provider throws → `attempts = 1`, status stays `PENDING` |
| 2nd | Provider throws → `attempts = 2`, status stays `PENDING` |
| 3rd | Provider throws → `attempts = 3`, status → `FAILED` |

After `FAILED`, an admin can see the row in the queue-health page and investigate the provider configuration.

---

## 2-minute viva talk track

> "Pulse's server side is an Express 4 app with CommonJS. I'm Member B — I built authentication, RBAC middleware, admin routes, database audit triggers, a notification trigger, and a background notifier worker.

> For authentication: donors and staff sign up with a password that is bcrypt-hashed at 10 rounds and stored as a hash — the plain text is discarded. On login, we call bcrypt.compare which is constant-time; both unknown email and wrong password return the same 401 to prevent user enumeration. A successful login returns a signed JWT with payload { id, role, name, hospital_id }. Every protected route passes through requireAuth to verify the JWT, then requireRole to check the role, and some routes additionally check requireVerifiedHospital which reads live from the database.

> For audit: I have four PostgreSQL triggers — one each on requests, donations, hospitals, and organ_match_log. Each writes a row to audit_log automatically, even if someone updates the table from psql. The fifth trigger, trg_after_match, fires after Member A inserts into match_log and queues notification rows per channel the donor enabled.

> The notifier worker runs every 30 seconds using node-cron. It picks up to 20 PENDING rows with FOR UPDATE SKIP LOCKED to prevent double-sends, calls the configured provider (console by default), and marks rows SENT or increments attempts up to a maximum of 3 before marking FAILED. This design means a broken SMTP server never blocks request creation."

---

## 5 likely examiner questions with short answers

**Q1: Why bcrypt and not SHA-256 for passwords?**  
SHA-256 is a fast hash — a GPU can compute billions per second. bcrypt is intentionally slow (configurable cost rounds). Password hashing needs to be slow to resist brute-force attacks.

**Q2: Why does login give the same error for wrong email and wrong password?**  
Security — if the error was different, an attacker could enumerate which email addresses are registered by trying logins and observing which error they get.

**Q3: What is FOR UPDATE SKIP LOCKED and why use it?**  
It locks the rows selected for processing and skips any already locked by another transaction. This prevents two notifier workers from sending the same notification. It's the standard PostgreSQL pattern for job queues.

**Q4: Why is trg_after_match in the database rather than the Express server?**  
The trigger fires inside the database transaction that inserts the match. If notification queueing were in Node.js, a crash between the match insert and the queue insert would lose the notification. Putting it in the database makes it atomic with the match.

**Q5: What would you change for production?**  
Store JWTs in httpOnly cookies (prevents XSS access), add rate limiting on the login endpoint, use refresh tokens with short-lived access tokens, and move secrets to a vault service instead of .env files.

---

## Known limitations (honest answers for the viva)

- JWTs stored in browser `localStorage` — accessible to JavaScript; XSS risk.
- No rate limiting on login — brute-force is possible.
- No token revocation — a deactivated user's existing token is valid until it expires (7 days). The `is_active` check only runs at login.
- SMS (Twilio) needs a paid account and DLT registration in India; demo runs in console mode.
- `NOTIFY_PROVIDER=console` is the only provider tested end-to-end without external accounts.
