# Pulse — Viva Demo Script (10-Minute Walkthrough)

This script is designed for the 10-minute lab evaluation. It guides the team step-by-step through presenting **Pulse** to the external examiners, demonstrating live trigger execution, spatial proximity matching, concurrency safety, role-based security, and organ allocation.

---

## Pre-Demo Checklist (2 Minutes Before Examiner Arrives)

1. **Database Freshness**:
   Open PowerShell and ensure the local database has all migrations and seed records loaded:
   ```powershell
   $psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
   $env:PGPASSWORD = "<your-postgres-password>"
   & $psql -U postgres -d donor_network -f database\00_reset.sql; `
   & $psql -U postgres -d donor_network -f database\01_schema.sql; `
   & $psql -U postgres -d donor_network -f database\02_seed.sql; `
   & $psql -U postgres -d donor_network -f database\10_blood_matching.sql; `
   & $psql -U postgres -d donor_network -f database\11_scheduler.sql; `
   & $psql -U postgres -d donor_network -f database\20_audit_notifications.sql; `
   & $psql -U postgres -d donor_network -f database\30_organ_matching.sql
   ```
2. **Terminal 1 (Backend Server)**:
   ```powershell
   Set-Location -Path server
   npm run seed:admin
   npm run dev
   ```
   *Verify: `[server] Pulse API listening on http://localhost:5000` and `[jobs] Started notifier` are logged.*
3. **Terminal 2 (Frontend Web Server)**:
   ```powershell
   Set-Location -Path web
   npm run dev
   ```
   *Verify: Vite dev server is running on `http://localhost:5173`.*
4. **pgAdmin 4**:
   Open pgAdmin 4, connect to `donor_network`, and open a Query Tool tab.

---

## 10-Minute Step-by-Step Viva Demo

### Step 1: Emergency Blood Request & Instant Spatial Matching (1.5 Mins)
- **Who to sign in as**: Hospital Staff — Anita Kulkarni (`staff.citycare@example.com` / `Pulse@123`).
- **Where to navigate**: Click **Blood Requests** in the sidebar (`/requests`).
- **What to click**:
  1. Fill in the "Raise Emergency Request" form:
     - Request Type: `BLOOD`
     - Blood Type: `O+`
     - Urgency: `CRITICAL` (Badge highlights in Coral)
     - Search Radius: `50` km
     - Patient Name: `Emergency Trauma Patient`
     - Units: `2`
  2. Click **Submit Request**.
- **What to say**:
  > *"When staff submit a CRITICAL blood request, we do not poll in JavaScript or fetch donors into Node.js. Instead, an `AFTER INSERT` database trigger fires instantly inside PostgreSQL. It calculates great-circle distances using our custom `haversine_km()` function and filters active donors who are eligible under our 90-day cooldown rule."*
- **What the examiner should see**:
  - The request is created and immediately displays with status badge **`MATCHED`** (in Alert Coral).
  - The matched donors list expands below the request showing exactly **3 matched donors** ordered nearest-first:
    1. **Aarav Shah**: `0.0 km` (Pune, same coordinates as Hospital 1).
    2. **Priya Nair**: `8.3 km` (Pune, nearby suburb).
    3. **Rahul Joshi**: `In your city` (Coordinates `NULL`, matched via same-city fallback).
  - Ineligible donor Neha (donated 30 days ago) and distant donors Vikram (Mumbai, 123 km) and Isha (Satara, 95 km) are excluded.
- **Responsible Database Objects**:
  - `trg_critical_request` (Trigger on `requests`)
  - `fn_trg_critical_request()` & `find_matching_donors()` (PL/pgSQL Functions)
  - `haversine_km()` (PL/pgSQL Spatial Math)

---

### Step 2: Inspecting `match_log` and `notifications` in pgAdmin (1 Min)
- **Who to sign in as**: Switch to pgAdmin 4 (Database Administrator view).
- **What to do**: Paste and execute the following query in the Query Tool:
  ```sql
  -- Inspect the latest matches recorded by the trigger
  SELECT m.match_id, m.request_id, d.name AS donor, d.blood_type,
         m.distance_km, m.contacted_status
  FROM match_log m
  JOIN donors d ON d.donor_id = m.donor_id
  ORDER BY m.match_id DESC
  LIMIT 5;

  -- Inspect the notifications automatically queued by trg_after_match
  SELECT n.notification_id, d.name AS recipient, n.channel, n.type,
         n.status, n.subject, n.message
  FROM notifications n
  JOIN donors d ON d.donor_id = n.donor_id
  ORDER BY n.notification_id DESC
  LIMIT 5;
  ```
- **What to say**:
  > *"Here in pgAdmin, we can observe the database state immediately following the request. Notice how `match_log` contains the three donors with calculated distances. Furthermore, our second trigger `trg_after_match` fired automatically: Aarav only has email enabled, so he received 1 EMAIL row. Priya has both email and SMS enabled, so the trigger queued 2 rows (EMAIL and SMS). Crucially, examining the message text confirms that the patient's name is omitted to preserve privacy."*
- **What the examiner should see**:
  - `match_log` rows with distances `0.0`, `8.3`, and `NULL`.
  - Notification rows created with status `PENDING` or `SENT`.
  - Message body: *"City Care Hospital in Pune needs O+ blood (approximately 8.3 km from you)..."* without any mention of *"Emergency Trauma Patient"*.
- **Responsible Database Objects**:
  - `trg_after_match` (Trigger on `match_log`)
  - `fn_after_match()` (PL/pgSQL Function)
  - `notifications` & `match_log` (Tables)

---

### Step 3: Background Worker Notification Dispatch (30 Seconds)
- **Who to show**: Switch to Terminal 1 (Node.js Server output).
- **What to do**: Highlight the console output logs.
- **What to say**:
  > *"Every 30 seconds, our background worker in `jobs/notifier.js` queries `notifications` for pending rows using `SELECT ... FOR UPDATE SKIP LOCKED`. This guarantees that multiple worker instances never process the same alert. In our demo environment, it uses the console provider, printing the outbound message and updating the database status to `SENT` with a timestamp."*
- **What the examiner should see**:
  - Terminal logs showing:
    ```
    [notifier] Processing 3 pending notification(s)...
    [console:email] To: aarav@example.com | Subject: Urgent: O+ blood needed near you
    [console:email] To: priya@example.com | Subject: Urgent: O+ blood needed near you
    [console:sms] To: 9822222222 | Msg: City Care Hospital in Pune needs O+ blood...
    [notifier] Marked notification #1 as SENT
    ```
- **Responsible Code & DB Objects**:
  - `server/jobs/notifier.js` (Worker utilizing `FOR UPDATE SKIP LOCKED`)
  - `server/lib/providers/console.js` (Default zero-config provider)
  - `idx_notif_queue` (Composite Index on `notifications(status, created_at)`)

---

### Step 4: Donor Receives Alert & Accepts Match (1 Min)
- **Who to sign in as**: Click **Sign Out**, then sign in as Donor Aarav Shah (`aarav@example.com` / `Pulse@123`).
- **Where to navigate**: Click **My Profile** in the sidebar (`/profile`).
- **What to click**:
  1. Show the **Eligibility Countdown Ring**: displays a green/teal ring with *"Eligible now"* (0 days remaining).
  2. Scroll to the **Active Blood Match Alerts** section.
  3. Locate the alert from **City Care Hospital** for **O+ Blood (0.0 km)**.
  4. Click the **Accept** button.
- **What to say**:
  > *"Aarav opens his profile. The countdown ring pulls live from `vw_donor_eligibility`. Under matches, he sees the emergency alert with distance. When he clicks 'Accept', an authenticated POST request updates `contacted_status` to 'ACCEPTED' in `match_log`."*
- **What the examiner should see**:
  - The match card badge updates from `PENDING` to a green `ACCEPTED` badge with the response timestamp.
- **Responsible Database Objects**:
  - `vw_donor_eligibility` (View)
  - `POST /api/matches/:id/respond` (API route)
  - `match_log.contacted_status` (Domain integrity)

---

### Step 5: Logging Donation & Enforcing 90-Day Cooldown (1.5 Mins)
- **Who to sign in as**: Sign out, sign back in as Staff Anita Kulkarni (`staff.citycare@example.com` / `Pulse@123`).
- **Where to navigate**: Click **Log Donation** in the sidebar (`/donations`).
- **What to click (Part A — The 409 Ineligible Rejection)**:
  1. Select Donor: **Neha Kulkarni** (Donor ID 6, who donated 30 days ago).
  2. Select Donation Type: `BLOOD`.
  3. Click **Record Donation**.
- **What to say**:
  > *"To prove that business rules live in PostgreSQL and cannot be bypassed, let's attempt to log a blood donation for Neha Kulkarni, who donated 30 days ago. Our BEFORE INSERT trigger `trg_check_donor_eligibility` intercepts the transaction and raises a custom P0001 exception with the date she can donate again. The server converts this to HTTP 409."*
- **What the examiner should see**:
  - A red error banner appears: **`DONOR_NOT_ELIGIBLE: Donor is not eligible to donate blood until <date>`**.
- **What to click (Part B — Successful Donation & Cascades)**:
  1. Change Donor to: **Aarav Shah** (Donor ID 1).
  2. Select Linked Request: The emergency request created in Step 1.
  3. Click **Record Donation**.
- **What to say**:
  > *"Now we log Aarav's donation. The BEFORE trigger verifies he is eligible. Then our AFTER INSERT trigger `trg_after_donation` executes atomically: it updates Aarav's `last_donation_date` to today, flips his `eligible_status` to 'N', and marks the hospital request 'FULFILLED'."*
- **What the examiner should see**:
  - Green success banner: *"Donation logged successfully"*.
  - Returning to **Blood Requests** shows the request status updated to **`FULFILLED`**.
  - A row `DONATION_LOGGED` is automatically written to `audit_log` by `trg_audit_donations`.
- **Responsible Database Objects**:
  - `trg_check_donor_eligibility` (BEFORE INSERT Trigger on `donations`)
  - `trg_after_donation` (AFTER INSERT Trigger on `donations`)
  - `trg_audit_donations` (AFTER INSERT Audit Trigger)

---

### Step 6: Scheduled Eligibility Restoration & Admin Trigger (1 Min)
- **Who to sign in as**: Sign out, sign in as System Admin (`admin@pulse.test` / `Admin@123`).
- **Where to navigate**: Admin Overview (`/admin`).
- **What to click**:
  1. Review system metrics: user counts, hospital statuses, queue health.
  2. Locate the **System Maintenance** card and click **Run Eligibility Restore**.
- **What to say**:
  > *"In production on Linux, `pg_cron` calls `restore_donor_eligibility()` daily at midnight. On Windows, `node-cron` calls the exact same SQL function. An administrator can also trigger it on demand. The function checks for donors whose last donation was 90+ days ago, resets `eligible_status = 'Y'`, and queues an `ELIGIBLE_AGAIN` notification so the donor knows they can give blood once more."*
- **What the examiner should see**:
  - A toast or banner confirms: *"Eligibility restoration complete. Restored: 0 donor(s)"* (or count restored).
  - Open pgAdmin to show the SQL behind this:
    ```sql
    SELECT restore_donor_eligibility();
    ```
- **Responsible Database Objects**:
  - `restore_donor_eligibility()` (PL/pgSQL Function in `10_blood_matching.sql`)
  - `server/jobs/eligibility.js` (Node-cron scheduler fallback)

---

### Step 7: Organ Matching, Priority Scoring & Confirmation (2 Mins)
- **Who to sign in as**: Sign out, sign back in as Staff Anita Kulkarni (`staff.citycare@example.com` / `Pulse@123`).
- **Where to navigate**:
  1. Click **Organ Waitlist** (`/organ-waitlist`): show Ramesh Patil (Kidney, Group O, Urgency 9), Imran Sheikh (Kidney, Group B, Urgency 5), and Sunita Rao (Kidney, Group A, Urgency 7).
  2. Click **Organ Matching** (`/organ-matching`).
- **What to click**:
  1. Under Available Pledges, locate **Aarav Shah's Kidney** (Pledge #1, Group O).
  2. Click **Find Recipients**.
- **What to say**:
  > *"Unlike blood matching which requires exact type and Rh factor, organ matching ignores Rh because vascular endothelial cells do not express RhD antigens. Our PL/pgSQL function `match_organ()` uses our `abo_compatibility` lookup table. Since Aarav is blood group O, he is the universal organ donor: all three patients (O, A, B) are compatible.
  > Candidates are scored using our formula: 50% Urgency, 30% Waiting time (capped at 365 days), and 20% Proximity using the Haversine formula to minimize cold ischemia time."*
- **What the examiner should see**:
  - The top 3 ranked proposals appear with score breakdowns:
    1. **Rank 1**: Ramesh Patil · Score: `81.4` (Urgency 9/10, Days 200, Dist 0.0 km).
    2. **Rank 2**: Imran Sheikh · Score: `69.7` (Urgency 5/10, Days 300, Dist 0.0 km).
    3. **Rank 3**: Patient #2 (Sunita Rao, Sunrise Hospital Mumbai) · Score: `52.7` (Urgency 7/10, Days 30, Dist ~120 km). Notice her name is masked as *"Patient #2"* because she belongs to another hospital.
- **What to click next**:
  - On Rank 1 (Ramesh Patil), click **Confirm Match**.
- **What to say**:
  > *"When staff confirm the match, `confirm_organ_match()` executes an atomic state machine: it marks proposal #1 ACCEPTED, marks both the pledge and patient MATCHED, and automatically marks competing proposals REJECTED. Trigger `trg_audit_organ_match` writes an audit row, and trigger `trg_pledge_withdrawn` prevents the donor from withdrawing an already matched organ."*
- **What the examiner should see**:
  - Ramesh Patil's proposal status changes to `ACCEPTED`. Competing proposals transition to `REJECTED`.
- **Responsible Database Objects**:
  - `organ_priority()` & `match_organ()` (PL/pgSQL Functions)
  - `confirm_organ_match()` (Atomic Transaction Function)
  - `abo_compatibility` (Lookup Table)
  - `trg_audit_organ_match` & `trg_pledge_withdrawn` (Triggers)

---

### Step 8: Admin Hospital Verification & Guard Enforcement (1 Min)
- **Who to sign in as**: Sign out, sign in as Staff Rohit Jadhav (`staff.newhope@example.com` / `Pulse@123`).
- **Where to navigate**: Click **Blood Requests** (`/requests`).
- **What to click**: Fill in any request and click **Submit Request**.
- **What the examiner should see**:
  - The submission is blocked with an error banner: **`HOSPITAL_NOT_VERIFIED: Your hospital is not yet verified by an administrator`** (HTTP 403).
- **What to say**:
  > *"New Hope Clinic in Nashik is seeded as unverified. Notice that staff can sign in, but our `requireVerifiedHospital` middleware queries the database live and rejects sensitive operations with HTTP 403."*
- **What to do next**:
  1. Sign out, sign in as Admin (`admin@pulse.test` / `Admin@123`).
  2. Navigate to **Hospitals** (`/admin/hospitals`).
  3. Locate **New Hope Clinic** and click the **Verify** toggle.
  4. Show the Audit Log (`/admin/audit`): trigger `trg_audit_hospitals` recorded `HOSPITAL_VERIFIED`.
  5. Sign out and sign back in as Rohit Jadhav (`staff.newhope@example.com`).
  6. Submit the blood request: it now succeeds immediately!
- **Responsible DB & Code Objects**:
  - `hospitals.verified` (Column)
  - `trg_audit_hospitals` (Trigger on `hospitals`)
  - `server/middleware/auth.js` (`requireVerifiedHospital`)

---

### Step 9: Role-Based Authorization & Cross-Hospital Isolation (1 Min)
- **What to demonstrate**:
  1. **Donor cannot access staff routes**: Sign in as Donor Aarav (`aarav@example.com`). Manually attempt to navigate to `http://localhost:5173/requests` or `http://localhost:5173/admin`.
     - *Result*: Client-side Route Guard automatically intercepts and redirects back to `/profile` or `/`.
     - *API verification*: Sending a direct `POST /api/requests` with Aarav's token returns **HTTP 403 Forbidden** (`requireRole('STAFF')`).
  2. **Cross-hospital isolation**: Sign in as Staff Farhan Qureshi at Sunrise Hospital (`staff.sunrise@example.com`).
     - Navigate to **Blood Requests**: Farhan only sees Sunrise Medical Center requests. He cannot see or cancel City Care's requests.
     - Sending a `PATCH /api/requests/1/cancel` with Farhan's token returns **HTTP 403 Forbidden** because `req.user.hospital_id` (2) does not match the request's `hospital_id` (1).
- **What to say**:
  > *"Authorization is enforced at both the UI and API levels. The frontend guards routes and filters the navigation sidebar, while our Express middleware verifies JWT roles and hospital ownership on every request. Client tampering cannot bypass these boundaries."*

---

## If Something Goes Wrong During the Demo (Emergency Recovery Box)

| Symptom | Cause | Fast Recovery Command (PowerShell) |
|---|---|---|
| **Port 5000 or 5173 busy** | Previous process did not shut down cleanly | `Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess -ErrorAction SilentlyContinue \| Stop-Process -Force; Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess -ErrorAction SilentlyContinue \| Stop-Process -Force` |
| **Data out of sync or test already run** | Seed data was altered during earlier testing | Run `database\00_reset.sql` through `30_organ_matching.sql` as shown in Pre-Demo step 1; then run `npm run seed:admin` in `server/`. Takes under 10 seconds. |
| **Login fails with 401** | Passwords mismatch or admin not seeded | Use `Pulse@123` for all seeded staff/donors. Run `npm run seed:admin` in `server/` to ensure `admin@pulse.test` / `Admin@123` exists. |
| **"Failed to fetch" on browser** | Express server was stopped | In `server/`, run `npm run dev`. Verify `http://localhost:5000/api/health` in browser. |
| **Notification not appearing in console** | `NOTIFY_PROVIDER` set to external service | Open `server\.env`, confirm `NOTIFY_PROVIDER=console`, save, and restart `npm run dev`. |
