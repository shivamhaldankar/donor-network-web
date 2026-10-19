# Pulse — Member A (Slice 1) Notes: Blood Matching, Eligibility & Donor Profile

This document explains all database objects, backend routes, frontend screens, and viva preparation notes built by Member A for the **Pulse** DBMS Lab project.

---

## 1. Plain-English Explanation of Database Objects (`10_blood_matching.sql` & `11_scheduler.sql`)

### 1.1 `haversine_km(lat1, lon1, lat2, lon2)`
- **What it does:** Calculates the great-circle distance (in kilometres) between two points on the Earth's spherical surface using their latitudes and longitudes in degrees.
- **Why in the database:** Calculating distances inside PostgreSQL allows spatial filtering (`distance <= radius_km`) and distance-based sorting directly in the SQL query plan. This avoids fetching thousands of records into Node.js memory just to filter them.
- **Formula:**
  $$\Delta lat = lat_2 - lat_1, \quad \Delta lon = lon_2 - lon_1$$
  $$a = \sin^2\left(\frac{\Delta lat}{2}\right) + \cos(lat_1) \cdot \cos(lat_2) \cdot \sin^2\left(\frac{\Delta lon}{2}\right)$$
  $$c = 2 \cdot \arcsin(\sqrt{a}), \quad \text{Distance} = R \cdot c \quad (R = 6371.0\text{ km})$$
- **Edge cases handled:** If any coordinate is `NULL`, it immediately returns `NULL` without error. The value of $a$ is clamped between `0.0` and `1.0` to guard against floating-point precision overflow before calling `sqrt()` and `asin()`.

---

### 1.2 Views

#### `vw_eligible_donors`
- **What it does:** Lists all active donors (`is_active = TRUE`) who are eligible to donate blood right now (`last_donation_date IS NULL OR last_donation_date <= CURRENT_DATE - 90`).
- **Why:** Centralizes the single source of truth for the 90-day cooldown rule. Staff and admin interfaces query this view without having to rewrite cooldown date arithmetic in every query.
- **Columns:** `donor_id, name, blood_type, city, latitude, longitude, last_donation_date`.

#### `vw_donor_eligibility`
- **What it does:** Provides detailed eligibility countdown metrics for each donor.
- **Why:** Powers the donor dashboard and profile countdown timer.
- **Columns:**
  - `donor_id`: Unique donor ID.
  - `last_donation_date`: Date of the donor's previous donation (`NULL` if first-time donor).
  - `next_eligible_date`: Date when the donor is or becomes eligible (`last_donation_date + 90` days, or `CURRENT_DATE` if never donated).
  - `days_remaining`: Days until eligible again (`GREATEST(0, (last_donation_date + 90) - CURRENT_DATE)`). Always 0 for eligible donors, never negative.
  - `is_eligible`: Boolean flag (`TRUE` when active and 90-day cooldown is met).

#### `vw_critical_open_requests`
- **What it does:** Lists urgent requests with urgency `CRITICAL` that are currently pending fulfillment (`status IN ('OPEN', 'MATCHED')`), joined with the `hospitals` table.
- **Why:** Shows staff and emergency teams which critical requests need immediate attention, along with how many days each request has been open (`days_open = CURRENT_DATE - requested_on::DATE`).

---

### 1.3 `find_matching_donors(p_request_id INT) RETURNS INT`
- **What it does:** Finds up to 10 matching blood donors for a given blood request, records them into `match_log`, updates the request status to `MATCHED` if at least one donor is found, and returns the match count.
- **Rules applied:**
  1. **Blood type matching:** Exact match (`d.blood_type = requests.blood_type_needed`).
  2. **Active & Eligible:** Only includes active donors whose cooldown has expired (`last_donation_date IS NULL OR last_donation_date <= CURRENT_DATE - 90`).
  3. **Geographic proximity:** If both hospital and donor have coordinates, requires $\text{distance} \le \text{radius\_km}$.
  4. **Fallback:** If either hospital or donor lacks coordinates, falls back to matching by city (`LOWER(TRIM(d.city)) = LOWER(TRIM(h.city))`) with `distance_km` recorded as `NULL`.
  5. **Ranking:** Nearest donors first (`distance_km ASC NULLS LAST`), then donors who haven't donated in the longest time (`last_donation_date ASC NULLS FIRST`), then `donor_id ASC`.
  6. **Cap:** Top 10 rows inserted into `match_log` with distance rounded to 1 decimal place.
  7. **Status update:** Sets `requests.status = 'MATCHED'` **only** if at least one donor matched.

---

### 1.4 Triggers

#### `trg_critical_request` (AFTER INSERT on `requests`)
- **What it does:** Fires when a new request is inserted with `urgency = 'CRITICAL'` and `request_type = 'BLOOD'`. It immediately calls `find_matching_donors(NEW.request_id)`.
- **Why in DB:** Ensures zero-latency automated matching at the database level. No manual button-click or background poll is needed to initiate matching.

#### `trg_check_donor_eligibility` (BEFORE INSERT on `donations`)
- **What it does:** Enforces the 90-day cooldown before any blood donation is recorded. If a donor donated less than 90 days ago, it raises an exception:
  `RAISE EXCEPTION 'DONOR_NOT_ELIGIBLE: Donor is not eligible to donate blood until %', v_next_eligible USING ERRCODE = 'P0001';`
- **Why in DB:** Integrity guarantee. Even if a buggy client or malicious user bypasses frontend and API validation, the database rejects invalid donation records with error code `P0001` (which maps to HTTP 409).

#### `trg_after_donation` (AFTER INSERT on `donations`)
- **What it does:** When a blood donation is successfully inserted:
  1. Updates the donor's `last_donation_date` to `donated_on`.
  2. Sets the donor's `eligible_status = 'N'`.
  3. If a `request_id` was specified, sets `requests.status = 'FULFILLED'`.
- **Why in DB:** Atomic consistency. The donation log, donor status, and request lifecycle stay 100% synchronized in a single transaction.

---

### 1.5 Scheduled Restoration (`restore_donor_eligibility()` & `11_scheduler.sql`)
- **Function `restore_donor_eligibility() RETURNS INT`:**
  - Queries donors whose `eligible_status = 'N'` but whose `last_donation_date <= CURRENT_DATE - 90`.
  - Updates their `eligible_status = 'Y'`.
  - Queues an `ELIGIBLE_AGAIN` notification in the `notifications` table for every channel the donor opted into (`EMAIL` if `notify_email`, `SMS` if `notify_sms` and phone present).
  - Returns the number of donors restored.
- **Scheduler (`11_scheduler.sql`):**
  - Attempts to register a midnight cron job (`0 0 * * *`) via PostgreSQL's `pg_cron` extension.
  - If `pg_cron` is not installed (e.g. standard Windows PostgreSQL installer), it gracefully catches the error, outputs a `NOTICE`, and proceeds without failing. The Node.js cron worker in `server/jobs/eligibility.js` handles the job as a robust fallback.

---

## 2. Explanation of Backend Routes & Jobs (Phase A2)

| Route / Job | Method | Role | Description |
|---|---|---|---|
| `/donors/me` | `GET` | DONOR | Returns donor profile + eligibility metrics (`is_eligible`, `days_remaining`, `next_eligible_date`, `total_days: 90`). |
| `/donors/me` | `PUT` | DONOR | Updates profile fields: phone, city, latitude, longitude, `notify_email`, `notify_sms`. Returns updated profile. |
| `/donors/me/donations` | `GET` | DONOR | Returns donor's past donation history, ordered newest first. |
| `/donors/me/matches` | `GET` | DONOR | Returns requests the donor has been matched with, including hospital name, city, urgency, distance, and contacted status. |
| `/matches/:id/respond` | `POST` | DONOR | Accept or decline a match (`{ response: "ACCEPTED" \| "DECLINED" }`). Sets `contacted_status` and `responded_on`. |
| `/donors/eligible` | `GET` | STAFF, ADMIN | Returns public list of eligible donors (`vw_eligible_donors`). Omits private contact info (phone/email). |
| `/requests` | `POST` | STAFF (verified) | Creates a blood or organ request. If `CRITICAL` blood, database trigger automatically matches nearby donors. |
| `/requests` | `GET` | STAFF (own), ADMIN | Returns hospital requests with match counts. Staff only see their own hospital's requests. |
| `/requests/critical` | `GET` | STAFF (own), ADMIN | Returns open critical requests from `vw_critical_open_requests`. |
| `/requests/:id/matches` | `GET` | STAFF (own), ADMIN | Returns matched donors for this request with distance and contact info (phone), ordered nearest-first. |
| `/requests/:id/cancel` | `PATCH` | STAFF (own), ADMIN | Cancels an open or matched request. |
| `/donations` | `POST` | STAFF | Logs a donation. Database trigger sets donor ineligible and fulfills request. Returns 409 if donor ineligible. |
| `jobs/eligibility.js` | Job | Background | Midnight cron job calling `SELECT restore_donor_eligibility()` when `ELIGIBILITY_SCHEDULER=node`. |

---

## 3. Explanation of Frontend Screens (Phase A3)

1. **`Profile.jsx` (Donor Profile):**
   - **Eligibility countdown visual:** Circular ring or progress bar showing `days_remaining` out of 90. Displays "Eligible now" in teal (`--teal: #0F6E56`) when eligible, or days remaining with `next_eligible_date` when ineligible. (Never uses coral).
   - **Match cards:** Shows active blood match alerts with hospital name, blood type needed, distance, and **Accept** / **Decline** buttons.
   - **Donation history:** Table/list of previous blood donations and fulfilling hospitals.
   - **Settings form:** Edit phone, city, notification toggles (Email / SMS), and coordinates via `LocationPicker`.

2. **`Requests.jsx` (Staff / Admin Requests):**
   - Request creation form with request type toggle (`BLOOD` vs `ORGAN`), urgency select (`CRITICAL`, `MODERATE`, `LOW`), radius slider/input (default 50 km).
   - If a `CRITICAL` blood request is submitted, the UI immediately loads and renders matched donors with computed distance in kilometres.
   - Request list with status badges (`OPEN`, `MATCHED`, `FULFILLED`, `CANCELLED`). Coral badges are strictly reserved for `CRITICAL`.

3. **`Donations.jsx` (Log Donation):**
   - Staff selects a donor and optional linked request.
   - Displays clear error box if the donor is ineligible (HTTP 409 `DONOR_NOT_ELIGIBLE`) indicating the date when they can donate again.

4. **`Donors.jsx` (Eligible Donors Directory):**
   - Searchable, filterable directory of active eligible donors sourced from `GET /donors/eligible`.

---

## 4. 2-Minute Viva Talk Track

> *"Good morning, examiners. In Pulse, I am Member A, responsible for the **Blood Matching, Eligibility Engine, and Donor Profile** slice.*
>
> *The central problem in blood donation networks is availability: donors cannot donate more frequently than every 90 days, and in emergencies, finding the closest eligible donor takes critical time.*
>
> *Here is our end-to-end flow:*
>
> 1. *When hospital staff raise a **CRITICAL blood request**, an `AFTER INSERT` trigger on the `requests` table automatically calls our PL/pgSQL function `find_matching_donors()`.*
> 2. *This function calculates great-circle distances using our custom `haversine_km` function. It filters for active, eligible donors of the exact blood group within the hospital's search radius—falling back to same-city matching if GPS coordinates are missing.*
> 3. *It sorts candidates nearest-first, inserts up to 10 candidates into `match_log`, and promotes the request to `MATCHED`.*
> 4. *Our partner Member B's trigger queues notifications. The matched donor logs into their **Profile**, sees the match alert with distance in kilometres, and clicks **Accept**.*
> 5. *When the donor arrives at the hospital, staff log the donation via `POST /donations`. A `BEFORE INSERT` trigger validates that the donor is eligible; if not, it rejects the insert with a custom `P0001` exception stating the next eligible date.*
> 6. *An `AFTER INSERT` trigger then updates the donor's `eligible_status` to `'N'`, sets `last_donation_date` to today, and automatically marks the hospital request `FULFILLED`.*
> 7. *Finally, our scheduled job runs `restore_donor_eligibility()` at midnight. Once 90 days elapse, it restores the donor's status back to `'Y'` and queues an `ELIGIBLE_AGAIN` notification.*
>
> *All critical business logic lives inside PostgreSQL triggers and functions to guarantee ACID compliance and ensure data integrity regardless of which client connects."*

---

## 5. Five Likely Examiner Questions & Answers

### Q1: Why did you implement the Haversine formula and matching logic in PostgreSQL instead of Node.js?
**Answer:**
Putting spatial calculation and filtering in the database allows PostgreSQL's query optimizer to filter and rank candidates before sending data over the network. If we did it in Node.js, the backend would have to fetch every donor in the state into memory on every request. Keeping it in PL/pgSQL also guarantees that whether a request is created via the web app, a mobile app, or pgAdmin, the business rules execute consistently.

### Q2: What happens if a donor or hospital has GPS coordinates set to `NULL`?
**Answer:**
`haversine_km` returns `NULL` when any coordinate is `NULL`. Our `find_matching_donors` function explicitly handles this with a fallback: if either party lacks coordinates, it checks `LOWER(TRIM(d.city)) = LOWER(TRIM(h.city))`. These matched donors have `distance_km = NULL` in `match_log`, and in the `ORDER BY distance_km ASC NULLS LAST` clause, they are placed after distance-ranked donors.

### Q3: Why is `eligible_status` stored in `donors` when you already have `last_donation_date`? Isn't that redundant?
**Answer:**
`eligible_status` is an indexed, cached indicator for rapid UI display and reporting. However, to eliminate data anomalies, our triggers, views (`vw_eligible_donors`), and matching function always evaluate the date rule: `(last_donation_date IS NULL OR last_donation_date <= CURRENT_DATE - 90)`. The `restore_donor_eligibility` function keeps this cache synchronized daily.

### Q4: How do you prevent race conditions when two hospital staff try to record a donation for the same donor at the same time?
**Answer:**
Our `BEFORE INSERT` trigger `trg_check_donor_eligibility` checks donor eligibility inside the insert transaction. Furthermore, the `AFTER INSERT` trigger updates `eligible_status = 'N'` and `last_donation_date` within the exact same transaction. If two concurrent transactions execute, PostgreSQL row-level locks on the `donors` row will cause the second transaction to see the updated `last_donation_date` and raise `DONOR_NOT_ELIGIBLE`.

### Q5: Why does your scheduler support both `pg_cron` and Node.js `node-cron`?
**Answer:**
`pg_cron` is an extension that typically requires a Linux server or Docker container with shared preload libraries enabled. In our development environment (Windows 11 with PostgreSQL 18), `pg_cron` is not bundled by default. Our SQL file `11_scheduler.sql` handles this gracefully with `EXCEPTION WHEN OTHERS`, while `server/jobs/eligibility.js` uses `node-cron` as an automated cross-platform fallback that calls the exact same `SELECT restore_donor_eligibility()` SQL function.
