# Pulse — Shared Contract (v1)

The single source of truth for the three members. If this file and anything else disagree (including `requirements_and_design.md`), **this file wins**. To change it, open a PR that all three members approve.

---

## 1. Ground rules

- **Stack:** PostgreSQL 16+ (database `donor_network`) · Node 18+ with **CommonJS** and **Express 4** · React 19 + React Router 7 + Vite · **plain CSS** (no Tailwind) · `fetch` through the shared API client.
- **JSON keys** are `snake_case` and match column names.
- **Errors:** `{ "error": "message", "code": "OPTIONAL_CODE" }` with status 400 (validation), 401 (not signed in), 403 (wrong role or not your hospital), 404, 409 (conflict or business rule), 500.
- **Types:** DATE columns travel as `"YYYY-MM-DD"` strings, TIMESTAMPTZ as ISO strings, NUMERIC as JSON numbers. Cast counts with `::int`.
- **Auth:** header `Authorization: Bearer <jwt>`. JWT payload `{ id, role, name, hospital_id? }`, role is `DONOR`, `STAFF`, or `ADMIN`, expiry 7 days.
- **Passwords:** bcrypt, 10 rounds. Never return `password_hash`.
- **SQL** is always parameterised (`$1, $2`).
- **Business rules live in the database** (triggers, functions). The API stays thin: insert rows, read views, call functions.
- **Business-rule errors from the database:** `RAISE EXCEPTION 'CODE: human message' USING ERRCODE = 'P0001';` The server error handler turns this into HTTP 409 `{ "error": "human message", "code": "CODE" }`. Routes just `next(err)`.
- **Eligibility rule (one definition, used everywhere):** a donor is eligible when `is_active` and (`last_donation_date IS NULL` or `last_donation_date <= CURRENT_DATE - 90`). `eligible_status` is a stored cache for display; matching and views use the date rule.

---

## 2. Repository layout and file ownership

```
web/        React app            server/    Express API + jobs
database/   numbered SQL files   docs/      specs, notes, diagrams
```

| Path | Owner |
|---|---|
| `database/01_schema.sql`, `02_seed.sql`, `README.md` | shared (all-three PR) |
| `database/10–19_*.sql`, `database/tests/slice1_*` | **A** |
| `database/20–29_*.sql`, `database/tests/slice2_*` | **B** |
| `database/30–39_*.sql`, `database/tests/slice3_*` | **C** |
| `server/server.js`, `config/`, `middleware/`, `lib/`, `package.json`, `scripts/`, `.env.example` | **B** |
| `server/routes/auth.js`, `hospitals.js`, `admin.js`, `notifications.js`, `server/jobs/notifier.js` | **B** |
| `server/routes/requests.js`, `donations.js`, `donors.js`, `matches.js`, `server/jobs/eligibility.js` | **A** |
| `server/routes/organs.js`, `stats.js` | **C** |
| `web/package.json`, `src/App.jsx`, `main.jsx`, `routes.config.js`, `api/`, `auth/`, `components/`, `styles/`, `pages/Auth.jsx`, `pages/Dashboard.jsx` | **C** |
| `web/src/pages/Profile.jsx`, `Requests.jsx`, `Donations.jsx`, `Donors.jsx` (+ their CSS) | **A** |
| `web/src/pages/admin/*`, `pages/Notifications.jsx` (+ CSS) | **B** |
| `web/src/pages/organ/*` (+ CSS) | **C** |
| `docs/sliceA_notes.md`, `sliceB_notes.md`, `sliceC_notes.md` | each owner |

Need a new npm package? Ask the owner of that `package.json` (B for server, C for web). To avoid early churn, B installs these up front: `express@4 cors dotenv pg bcrypt jsonwebtoken nodemailer node-cron twilio`.

---

## 3. Database object specs

Each owner writes the objects below in their own numbered files. Names and signatures are fixed so other members can code against them before they exist.

### Owner A — `database/10_*.sql`, `11_scheduler.sql`

| Object | Spec |
|---|---|
| `haversine_km(lat1, lon1, lat2, lon2)` | Returns kilometres (`DOUBLE PRECISION`); `NULL` if any input is `NULL`. |
| `vw_eligible_donors` | `donor_id, name, blood_type, city, latitude, longitude, last_donation_date` for donors meeting the eligibility rule. |
| `vw_donor_eligibility` | `donor_id, last_donation_date, next_eligible_date, days_remaining, is_eligible`. `days_remaining` is never below 0. |
| `vw_critical_open_requests` | Requests with `urgency = 'CRITICAL'` and `status IN ('OPEN','MATCHED')`: `request_id, hospital_id, hospital, blood_type_needed, organ_type_needed, patient_name, requested_on, days_open`. |
| `find_matching_donors(p_request_id INT) RETURNS INT` | Eligible, active donors with the same `blood_type` as `blood_type_needed`. If both donor and hospital have coordinates, require `distance <= radius_km`; otherwise fall back to same city. Order by distance ascending (NULLs last), then oldest `last_donation_date` (NULLs first). Insert up to 10 rows into `match_log` with `distance_km` rounded to 1 decimal. Set the request to `MATCHED` **only if at least one donor matched**. Return the number matched. |
| `trg_critical_request` | AFTER INSERT on `requests`: urgency `CRITICAL` and type `BLOOD` → `find_matching_donors`. |
| `trg_check_donor_eligibility` | BEFORE INSERT on `donations` for `BLOOD`: if the donor is not eligible raise `DONOR_NOT_ELIGIBLE: …` (with the next eligible date). |
| `trg_after_donation` | AFTER INSERT on `donations` for `BLOOD`: set `last_donation_date`, `eligible_status = 'N'`; if `request_id` is set, mark that request `FULFILLED`. |
| `restore_donor_eligibility() RETURNS INT` | Set `eligible_status = 'Y'` for donors now meeting the rule; for each, queue an `ELIGIBLE_AGAIN` row in `notifications` for each enabled channel (email if `notify_email`, SMS if `notify_sms` and phone present). Returns count restored. |
| `11_scheduler.sql` | Schedules the function daily at midnight with `pg_cron` **if the extension is available**; otherwise prints a NOTICE and does nothing. |

### Owner B — `database/20_*.sql`

| Object | Spec |
|---|---|
| `trg_after_match` | AFTER INSERT on `match_log`: for the matched donor, queue one `MATCH` notification per enabled channel (EMAIL if `notify_email`; SMS if `notify_sms` and phone present). Subject: `Urgent: {blood_type} blood needed near you`. Message: hospital name, city, blood type, and approximate distance when known. **Never include the patient's name.** |
| `trg_audit_requests` | On `requests`: INSERT → `REQUEST_CREATED`; status change → `REQUEST_STATUS_CHANGED`. Actor = `STAFF` / `staff_id`. |
| `trg_audit_donations` | On `donations`: INSERT → `DONATION_LOGGED`. Actor `SYSTEM`. |
| `trg_audit_hospitals` | On `hospitals`: `verified` change → `HOSPITAL_VERIFIED` / `HOSPITAL_UNVERIFIED`. Actor `SYSTEM`. |
| `trg_audit_organ_match` | On `organ_match_log`: status becomes `ACCEPTED` → `ORGAN_MATCH_CONFIRMED`. Actor `SYSTEM`. |

Audit rows for **requests, donations, hospital verification, and organ confirmation come from these triggers**. A and C do not write audit rows for them. B's API writes the rest (user deactivation, manual jobs) through `lib/audit.js`.

### Owner C — `database/30_*.sql`

| Object | Spec |
|---|---|
| `organ_priority(p_urgency INT, p_days_waiting INT, p_distance_km NUMERIC) RETURNS NUMERIC` | `0.5·U + 0.3·W + 0.2·P` where `U = urgency × 10`, `W = LEAST(days_waiting, 365)/365 × 100`, `P = GREATEST(0, 100 − distance_km/5)`, and `P = 0` when distance is `NULL`. Weights are constants in this one function. |
| `match_organ(p_organ_id INT) RETURNS INT` | Organ must be `AVAILABLE` (else `ORGAN_NOT_AVAILABLE`). Candidates: `WAITING` patients needing that `organ_type` whose `blood_group` is allowed by `abo_compatibility` for the donor's ABO group (blood type without the `+`/`-`). Distance = donor coordinates to hospital coordinates (NULL if missing). Delete the organ's old `PROPOSED` rows, insert the top 5 with `rank_no` 1–5, return the count. |
| `confirm_organ_match(p_organ_match_id INT) RETURNS VOID` | Proposal must be `PROPOSED` (else `PROPOSAL_NOT_ACTIVE`) and patient `WAITING` (else `PATIENT_NOT_WAITING`). Set proposal `ACCEPTED`, pledge `MATCHED`, patient `MATCHED`; set the organ's other proposals `REJECTED`. |
| `trg_pledge_withdrawn` | BEFORE UPDATE on `organ_registry` when status becomes `WITHDRAWN`: if the old status was `MATCHED` raise `PLEDGE_ALREADY_MATCHED`; otherwise reject that pledge's `PROPOSED` rows. |
| `vw_waitlist_ranked` | `waitlist_id, hospital_id, hospital_name, patient_name, organ_type, blood_group, urgency_score, listed_on, days_waiting, status`, ordered by urgency desc then waiting desc. |

### Test files

Each owner writes `database/tests/sliceN_tests.sql`. Each test runs inside `BEGIN … ROLLBACK`, uses the seed data, and prints `RAISE NOTICE 'PASS Tnn …'` or `'FAIL Tnn …'`. Test numbers refer to the table in `requirements_and_design.md` §2.6.

---

## 4. Server conventions (`server/`, CommonJS)

**Auto-loading.** `server.js` mounts every `routes/<name>.js` (which exports an Express router) at `/api/<name>`, and calls `start()` on every `jobs/<name>.js` after the server is listening. So **adding a file is enough**; nobody edits `server.js`. It also provides `GET /api/health`, CORS, JSON parsing, and a final error handler (maps `P0001` → 409, `23505` → 409, `23503`/`23514`/`22P02` → 400).

**Interfaces B provides (use these exact names):**

```js
// config/db.js — also sets pg type parsers: DATE → string, NUMERIC → number, INT8 → number
module.exports = pool;                          // pg.Pool, use pool.query(text, params)

// middleware/auth.js
module.exports = { requireAuth, requireRole, requireVerifiedHospital };
//   router.post('/x', requireAuth, requireRole('STAFF'), requireVerifiedHospital, handler)
//   req.user = { id, role, name, hospital_id }     // hospital_id only for STAFF
//   requireVerifiedHospital reads hospitals.verified from the database, 403 if false

// lib/asyncHandler.js
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// lib/audit.js — only for actions without a DB trigger (see §3, Owner B)
module.exports = { audit };   // audit({ actorRole, actorId, action, entity, entityId }) → Promise<void>
```

**Jobs.** `jobs/<name>.js` exports `{ start }`. A's `eligibility.js` runs `SELECT restore_donor_eligibility()` daily at midnight with `node-cron`, **only when `ELIGIBILITY_SCHEDULER=node`** (default). Set `pgcron` to let the database do it.

**Environment variables** (`server/.env.example`, never commit `.env`): `PORT=5000`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=donor_network`, `JWT_SECRET`, `ELIGIBILITY_SCHEDULER=node`, `NOTIFY_PROVIDER=console` (`console` | `smtp` | `twilio`), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM`, `ADMIN_EMAIL=admin@pulse.test`, `ADMIN_PASSWORD=Admin@123`.

**npm scripts:** `start`, `dev`, `seed:admin`.

---

## 5. Web conventions (`web/`, React + plain CSS)

**Route registry.** `src/routes.config.js` lists every route with its roles and page file. Pages are loaded with `import.meta.glob('./pages/**/*.jsx')`, and a missing file shows a "Coming soon" placeholder. **To add a page, just create the file at the listed path with a default export**; nobody edits `App.jsx`.

| Path | Roles | Page file | Owner |
|---|---|---|---|
| `/auth` | signed-out | `pages/Auth.jsx` | C |
| `/` | DONOR, STAFF (ADMIN is redirected to `/admin`) | `pages/Dashboard.jsx` | C |
| `/profile` | DONOR | `pages/Profile.jsx` | A |
| `/notifications` | DONOR | `pages/Notifications.jsx` | B |
| `/organ-pledges` | DONOR | `pages/organ/Pledges.jsx` | C |
| `/requests` | STAFF, ADMIN (admin is read-only) | `pages/Requests.jsx` | A |
| `/donations` | STAFF | `pages/Donations.jsx` | A |
| `/donors` | STAFF, ADMIN | `pages/Donors.jsx` | A |
| `/organ-waitlist` | STAFF, ADMIN | `pages/organ/Waitlist.jsx` | C |
| `/organ-matching` | STAFF, ADMIN | `pages/organ/Matching.jsx` | C |
| `/admin` | ADMIN | `pages/admin/Dashboard.jsx` | B |
| `/admin/hospitals` | ADMIN | `pages/admin/Hospitals.jsx` | B |
| `/admin/users` | ADMIN | `pages/admin/Users.jsx` | B |
| `/admin/audit` | ADMIN | `pages/admin/Audit.jsx` | B |
| `/admin/notifications` | ADMIN | `pages/admin/Notifications.jsx` | B |

The sidebar is generated from this registry, per role.

**Interfaces C provides (use these exact names):**

```js
// src/api/client.js — adds the Bearer token, base URL from VITE_API_URL (default http://localhost:5000/api)
export const api = { get(path), post(path, body), put(path, body), patch(path, body), del(path) };
//   resolves to parsed JSON; on non-2xx throws Error with .status, .code and .message (server's error text)

// src/auth/AuthContext.jsx
export function useAuth()   // → { user, token, login({ token, user }), logout() }, user = { id, role, name, hospital_id? }

// src/components/ui.jsx
export { PageHeader, Card, Badge, Spinner, ErrorBox, EmptyState };
//   <PageHeader title subtitle />  <Card title>…</Card>  <Badge tone="ok|warn|critical|neutral">…</Badge>
//   <Spinner />  <ErrorBox message />  <EmptyState>text</EmptyState>

// src/components/LocationPicker.jsx
//   <LocationPicker value={{ latitude, longitude }} onChange={({ latitude, longitude }) => …} />
//   "Use my location" (browser Geolocation) plus manual fields
```

Every page: show `<Spinner />` while loading, `<ErrorBox />` on failure, and `<EmptyState />` for empty lists. Never let a failed request crash the page.

**Styling.** `src/styles/tokens.css` (C) defines CSS variables: `--ink #0B2B2C`, `--teal #0F6E56`, `--teal-light #EAF6F3`, `--coral #E0664A`, `--sand #F6F4EE`, `--border`, fonts Space Grotesk (headings) and Inter (body). **Coral is for critical/urgent states only.** Each page imports its own CSS file next to it and uses these variables.

**Dev shortcut.** `VITE_DEV_FAKE_AUTH=true` lets C's Auth page fake a login for a chosen role so screens can be built before the backend is ready. Never enabled in production.

---

## 6. API reference

Base URL `http://localhost:5000/api`. "own hospital" = `req.user.hospital_id` must match the row's hospital, else 403.

### Accounts and hospitals (B)

| Method · Route | Roles | Body → Response |
|---|---|---|
| `POST /auth/signup` | public | Donor: `{ role:"DONOR", name, email, password (≥6), phone, blood_type, city?, latitude?, longitude? }`. Staff: `{ role:"STAFF", name, email, password, hospital_id, staff_role? }`. → 201 `{ token, user:{ id, role, name, hospital_id? } }`. 409 duplicate email. |
| `POST /auth/login` | public | `{ role, email, password }` (role may be `ADMIN`) → 200 same shape. 401 bad credentials; 403 deactivated. |
| `GET /auth/me` | any | → `{ user }` |
| `GET /hospitals` | public | → `[ { hospital_id, name, city, verified } ]` by name |
| `PATCH /hospitals/:id/verify` | ADMIN | `{ verified }` → `{ hospital_id, name, city, verified }` |
| `GET /notifications/me` | DONOR | → latest 50 `[ { notification_id, type, channel, subject, message, status, created_at, sent_at } ]` |
| `GET /admin/stats` | ADMIN | → `{ users:{ donors, staff, admins }, hospitals:{ total, unverified }, notifications:{ pending, failed }, recent_audit:[…5 rows] }` |
| `GET /admin/users` | ADMIN | → `{ donors:[{ donor_id, name, email, is_active }], staff:[{ staff_id, name, email, hospital_name, is_active }] }` |
| `PATCH /admin/users/:role/:id/active` | ADMIN | `:role` is `donor` or `staff`; body `{ is_active }` → `{ id, is_active }` |
| `GET /admin/audit?limit=100` | ADMIN | → `[ { log_id, actor_role, actor_id, action, entity, entity_id, created_at } ]` |
| `GET /admin/notifications` | ADMIN | → `{ counts:{ pending, sent, failed }, recent_failures:[…] }` |
| `POST /admin/jobs/restore-eligibility` | ADMIN | → `{ restored }` (calls `restore_donor_eligibility()`) |

### Donors, requests, donations (A)

| Method · Route | Roles | Body → Response |
|---|---|---|
| `GET /donors/me` | DONOR | → `{ donor_id, name, email, phone, blood_type, city, latitude, longitude, notify_email, notify_sms, last_donation_date, is_eligible, next_eligible_date, days_remaining, total_days:90 }` |
| `PUT /donors/me` | DONOR | any of `{ name, phone, city, latitude, longitude, notify_email, notify_sms }` → same shape as GET |
| `GET /donors/me/donations` | DONOR | → `[ { donation_id, donation_type, units, donated_on, hospital_name } ]` newest first |
| `GET /donors/me/matches` | DONOR | → `[ { match_id, request_id, hospital_name, hospital_city, blood_type_needed, urgency, distance_km, matched_on, contacted_status, responded_on } ]` |
| `POST /matches/:id/respond` | DONOR (own match) | `{ response:"ACCEPTED"\|"DECLINED" }` → `{ match_id, contacted_status, responded_on }`. 409 if not `PENDING`/`CONTACTED` or the request is closed. |
| `GET /donors/eligible` | STAFF, ADMIN | → `[ { donor_id, name, blood_type, city, last_donation_date } ]` (no phone or email) |
| `POST /requests` | STAFF (verified hospital) | `{ request_type, blood_type_needed?, organ_type_needed?, urgency, patient_name?, units_needed?, radius_km? }`; hospital and staff come from the token → 201 `{ request_id, status, match_count }` |
| `GET /requests?status=` | STAFF (own), ADMIN (all) | → `[ { request_id, hospital_id, hospital_name, request_type, blood_type_needed, organ_type_needed, urgency, radius_km, patient_name, requested_on, status, match_count } ]` |
| `GET /requests/critical` | STAFF (own), ADMIN | → rows of `vw_critical_open_requests` |
| `GET /requests/:id/matches` | STAFF (own), ADMIN | → `[ { match_id, donor_id, name, phone, blood_type, distance_km, contacted_status, matched_on } ]` nearest first |
| `PATCH /requests/:id/cancel` | STAFF (own), ADMIN | → `{ request_id, status }`. 409 unless `OPEN`/`MATCHED`. |
| `POST /donations` | STAFF | `{ donor_id, request_id?, donation_type, units? }`; hospital from token; a given `request_id` must belong to the same hospital → 201 `{ donation_id }`. 409 `DONOR_NOT_ELIGIBLE`. |

### Organs and staff stats (C)

| Method · Route | Roles | Body → Response |
|---|---|---|
| `POST /organs/pledges` | DONOR | `{ organ_type }` → 201 `{ organ_id, organ_type, status }` |
| `GET /organs/pledges` | DONOR | own pledges `[ { organ_id, organ_type, status, registered_on } ]` |
| `DELETE /organs/pledges/:id` | DONOR (own) | sets `WITHDRAWN` → `{ organ_id, status }`. 409 `PLEDGE_ALREADY_MATCHED`. |
| `GET /organs/pledges/available` | STAFF, ADMIN | → `[ { organ_id, organ_type, donor_blood_group, city, registered_on } ]` (no donor name or contact) |
| `POST /organs/waitlist` | STAFF (verified hospital) | `{ patient_name, organ_type, blood_group, urgency_score }` → 201 `{ waitlist_id }` |
| `GET /organs/waitlist` | STAFF (own), ADMIN (all) | → rows of `vw_waitlist_ranked` |
| `PATCH /organs/waitlist/:id/remove` | STAFF (own), ADMIN | → `{ waitlist_id, status }` |
| `POST /organs/pledges/:id/match` | STAFF, ADMIN | runs `match_organ` → `[ { organ_match_id, rank_no, waitlist_id, patient_name, hospital_name, blood_group, urgency_score, days_waiting, distance_km, priority_score, status } ]`. Patients from other hospitals show `patient_name` as `"Patient #<waitlist_id>"`. |
| `POST /organs/matches/:id/confirm` | STAFF (recipient's hospital), ADMIN | runs `confirm_organ_match` → `{ ok:true }` |
| `GET /stats/staff` | STAFF | → `{ open_critical_requests, eligible_donors, waitlist_size }` (own hospital for the first and last) |

---

## 7. Seed data and demo accounts (dev only)

All seeded logins use the password **`Pulse@123`**. Admin is created by `npm run seed:admin` (`admin@pulse.test` / `Admin@123` unless `.env` overrides).

| Role | Email | Notes |
|---|---|---|
| STAFF | `staff.citycare@example.com` | Hospital 1, City Care, Pune, verified |
| STAFF | `staff.sunrise@example.com` | Hospital 2, Sunrise, Mumbai, verified |
| STAFF | `staff.newhope@example.com` | Hospital 4, New Hope, Nashik, **unverified** (tests T10) |
| DONOR | `aarav@example.com` | Donor 1, O+, Pune, never donated, has a kidney pledge |
| DONOR | `priya@example.com` | Donor 2, O+, Pune, donated 120 days ago, SMS on |
| DONOR | `neha@example.com` | Donor 6, O+, Pune, donated 30 days ago, **ineligible** |

Useful facts for tests: with a CRITICAL O+ request at hospital 1 (radius 50 km), the expected matches are Aarav (0 km), Priya (about 8 km), and Rahul (no coordinates, same-city fallback). Vikram (Mumbai), Isha (Satara), and Neha (ineligible) are excluded. With the seed waitlist, Aarav's kidney should rank Ramesh Patil > Imran Sheikh > Sunita Rao.

---

## 8. Deviations from `requirements_and_design.md`

| Design doc | This contract |
|---|---|
| `donors.email_login` | `donors.email` (unique, the login id) |
| `organ_match_log.rank` | `organ_match_log.rank_no` |
| `POST /requests`, `POST /donations`: Staff **and** Admin | Staff only (the hospital comes from the token) |
| `vw_critical_open_requests`: `status = 'OPEN'` | `status IN ('OPEN','MATCHED')`, because a request becomes `MATCHED` immediately after auto-matching |
| Request set to `MATCHED` after matching | Only when at least one donor matched |
| `/donors/eligible`, `/requests/critical` public | Staff and Admin only |
| ABO compatibility table has one row per pair with Rh | ABO group only (Rh ignored for organs) |

---

## 9. Integration order and dependencies

1. **Day 1:** repo restructure, this contract, and the shared SQL are on `main`. Everyone creates their local database and runs files `00`–`02`.
2. **Days 1–3, in parallel:**
   - A writes the blood-matching SQL (needs nothing from others).
   - B merges the **server foundation** first (`server.js`, `db.js`, middleware, auth routes, `.env.example`, package.json).
   - C merges the **web foundation** first (layout, route registry, `api`, `auth`, `ui`, `LocationPicker`, Auth page).
3. **From day 3:** A, B, and C pull `main`, then build their API routes and pages against the interfaces in §4 and §5.
4. **If something you need isn't merged yet,** code against the contract, wait for the merge, and never copy it into your own files. **If the contract is wrong or incomplete, stop and tell the human** instead of diverging quietly.
5. **Pull `main` and rebase before opening every PR.** One PR per phase.
