# Pulse — Blood & Organ Donor Availability Network

Pulse is a database-driven availability network developed as a DBMS laboratory project. In emergency situations, hospitals often experience critical delays locating eligible blood and organ donors because existing registries are static directories that do not track donation eligibility or calculate geographic distance. Pulse solves this problem by moving matching logic, 90-day cooldown enforcement, multi-criteria recipient prioritization, and notification queueing directly into PostgreSQL triggers and stored functions. When hospital staff raise an emergency request, the database immediately identifies the closest compatible donors, records the matches, queues alerts, and enforces atomic donation lifecycle transitions.

---

## 1. Features by Role

### Donor
- **Public Sign-up & Sign-in**: Register with contact info, blood type, city, and GPS coordinates (via browser Geolocation or manual input); secure login using bcrypt password verification with JWT-based session tokens.
- **Eligibility Countdown**: Personal profile featuring a dynamic countdown timer (`vw_donor_eligibility`) displaying live status ("Eligible now" in teal or days remaining until next eligible date), last donation date, and total cooldown metrics.
- **Match Alerts & Response**: View critical blood match requests received from nearby hospitals with calculated distance in kilometres; respond directly with **Accept** or **Decline**.
- **Donation History**: Track personal donation history including dates, units, and fulfilling hospital details.
- **Organ Pledges**: Pledge organs (Kidney, Liver, Cornea, Heart, Lung, Pancreas) to the network and withdraw un-matched pledges with automated cascade protection.
- **Settings & Preferences**: Update phone number, city, GPS coordinates, and toggle delivery channels for notifications (Email and SMS).
- **Notification Inbox**: Review the latest 50 alert messages received across enabled delivery channels.

### Hospital Staff
- **Hospital-Scoped Operations**: Sign up linked to a specific hospital; staff permissions and actions (requests, donations, patient records) are strictly scoped to their own hospital via JWT ownership validation.
- **Blood & Organ Requests**: Create emergency availability requests specifying blood type or organ type, urgency level (`CRITICAL`, `MODERATE`, `LOW`), units, and search radius (1–500 km, default 50 km).
- **Instant Automated Matching**: Creating a `CRITICAL` blood request immediately fires database triggers that match and rank up to 10 active, eligible donors of the exact blood type within the radius, ordered nearest-first.
- **Donor Contact Access**: Inspect matched donors for the hospital's requests with computed distance and emergency contact phone numbers.
- **Donation Logging**: Log blood donations against donors and requests. The database trigger automatically sets the donor ineligible for 90 days, updates their last donation date, and marks the linked request `FULFILLED`. Ineligible donors are blocked with HTTP 409 (`DONOR_NOT_ELIGIBLE`).
- **Organ Waitlist Management**: Add patients awaiting transplantation with urgency scores (1–10), organ type, and ABO blood group; view the hospital's ranked waitlist.
- **Organ Recipient Allocation**: Run multi-criteria compatibility matching on available organ pledges; review top 5 ranked recipient proposals with transparent score breakdowns (urgency, waiting time, proximity) and execute match confirmations.
- **Staff Operations Dashboard**: Real-time summary displaying open critical requests, region-wide eligible donor counts, and active hospital waitlist size.

### System Administrator
- **Secure Provisioning**: Admin accounts are created strictly through an offline CLI seed script (`npm run seed:admin`); no public registration endpoint exists.
- **Hospital Verification**: Inspect hospital registrations and toggle verified status. Staff members belonging to unverified hospitals are blocked from creating requests or listing waitlist patients (HTTP 403).
- **User Governance**: View all registered donors and staff members; toggle active/inactive status. Deactivated users are blocked from signing in.
- **Tamper-Proof Audit Trail**: Review system audit logs (`audit_log`) automatically populated by database triggers for critical domain actions (request created, status changed, donation logged, hospital verification toggled, organ match confirmed).
- **Queue Health Monitoring**: Monitor the notification pipeline (pending, sent, failed counts) and inspect failed delivery attempts with error diagnostics.
- **Manual Maintenance Triggers**: Trigger the 90-day eligibility restoration engine on demand via administrative HTTP POST.
- **Global Overview**: Read-only access to all requests, matched donor lists, and organ waitlists across all network hospitals.

---

## 2. Tech Stack

| Layer / Concern | Technology | Version | Purpose in Pulse |
|---|---|---|---|
| **Database** | PostgreSQL | 16+ (tested on 18.6) | Relational storage, custom domains, stored functions (PL/pgSQL), views, integrity constraints, and triggers |
| **Backend Runtime** | Node.js | LTS (v18+ / v20+ / v24+) | CommonJS asynchronous runtime for API routes and background workers |
| **Backend Framework** | Express | 4.19.2 | REST API routing, CORS handling, middleware pipeline, and PostgreSQL error mapping |
| **Password Hashing** | bcrypt | 5.1.1 | 10 salt cost rounds, constant-time comparison resisting timing and brute-force attacks |
| **Authentication** | jsonwebtoken | 9.0.2 | HMAC-SHA256 (HS256) signed bearer tokens with 7-day expiration |
| **Database Driver** | pg | 8.12.0 | PostgreSQL connection pool with custom type parsers for `DATE` and `NUMERIC` |
| **Task Scheduling** | node-cron | 3.0.3 | 30-second notification queue worker and midnight eligibility restoration fallback |
| **Email Delivery** | nodemailer | 6.9.13 | SMTP email transport supporting Mailtrap, Ethereal, and production SMTP relays |
| **SMS Delivery** | twilio | 5.2.0 | Optional SMS delivery provider for emergency mobile text alerts |
| **Frontend Framework** | React | 19.2.8 | Declarative component UI with stateful hooks and context providers |
| **Build Tool / Bundler**| Vite | 8.2.0+ | Fast ESM development server and optimized production assets bundler |
| **Client Routing** | React Router | 7.18.2 | Route guards, dynamic route registry loading, and role-based client navigation |
| **Styling** | Plain CSS | CSS3 / Tokens | Design system in `tokens.css` with CSS custom variables, Space Grotesk & Inter typography |
| **UI Icons** | lucide-react | 1.44.0 | Lightweight vector icons for role badges, alerts, and navigation items |

---

## 3. Architecture

```
  ┌─────────────────────────────────────────────────────────────┐
  │                 React 19 Frontend (Vite :5173)              │
  │          Role-Based UI: Donor  ·  Staff  ·  Admin           │
  └──────────────────────────────┬──────────────────────────────┘
                                 │ HTTP / JSON (Bearer JWT)
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                Express 4 API Server (:5000)                 │
  │         Auth · RBAC Middleware · Central Error Handler      │
  └──────────────┬───────────────────────────────▲──────────────┘
                 │ Parameterized SQL ($1, $2)    │ Queue Polling
                 ▼ (pg.Pool)                     │ (FOR UPDATE SKIP LOCKED)
  ┌──────────────────────────────────────────────┴──────────────┐
  │                   PostgreSQL 16+ Database                   │
  │  ─────────────────────────────────────────────────────────  │
  │  • Custom Domains: blood_type_t, abo_group_t, organ_type_t  │
  │  • Spatial Math: haversine_km()                             │
  │  • Blood Matching: find_matching_donors()                   │
  │  • Organ Priority: organ_priority(), match_organ()          │
  │  • Integrity & Automation Triggers:                         │
  │      trg_critical_request     -> instant donor matching     │
  │      trg_after_match          -> queues notification rows   │
  │      trg_check_donor_eligibility -> enforces 90-day cooldown│
  │      trg_after_donation       -> sets ineligible & fulfills │
  │      trg_pledge_withdrawn     -> blocks matched withdrawal  │
  │      trg_audit_*              -> tamper-proof audit trail   │
  │  • Views: vw_donor_eligibility, vw_waitlist_ranked, etc.    │
  └──────────────────────────────┬──────────────────────────────┘
                                 │ Reads PENDING notifications
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │             Notifier Background Worker (Node.js)            │
  │        Runs every 30s · Max 3 Retries · State Machine       │
  │      • Console Provider (Default, no accounts needed)       │
  │      • SMTP Provider (Nodemailer / Mailtrap)                │
  │      • Twilio Provider (SMS Alerts)                         │
  └─────────────────────────────────────────────────────────────┘
```

### Architectural Principle: Business Rules Live in the Database
In Pulse, the Express API is intentionally kept thin. Core business logic—spatial proximity calculations, blood group compatibility, organ priority scoring, 90-day cooldown verification, notification generation, and audit logging—is implemented directly inside PostgreSQL stored functions, triggers, and views. This design ensures that business rules are absolute and tamper-proof: whether a row is inserted via the React web application, a background job, or directly by a database administrator via `psql` or pgAdmin, the same constraints, calculations, and cascades execute consistently. The API server merely validates permissions, issues parameterized queries, and maps PostgreSQL error codes (e.g., `P0001` to HTTP 409, `23505` to HTTP 409, `23503` to HTTP 400) back to the client.

---

## 4. Repository Layout

```
donor-network-web/
├── database/          # PostgreSQL database definitions, logic, and tests
│   └── tests/         # Idempotent PL/pgSQL automated test scripts (Slice 1, 2, 3)
├── docs/              # Architectural designs, API contract, and viva documentation
├── server/            # Express 4 CommonJS backend application and background jobs
│   ├── config/        # Database pool setup and custom PostgreSQL type parsers
│   ├── jobs/          # Background cron jobs (notifier queue worker and eligibility restorer)
│   ├── lib/           # Utility helpers, audit logging library, and notification providers
│   │   └── providers/ # Notification dispatch drivers (Console, SMTP, Twilio)
│   ├── middleware/    # JWT authentication, role-based access control, and hospital verification
│   ├── routes/        # Modular API route controllers auto-mounted by server.js
│   ├── scripts/       # Database provisioning utilities (admin seeding script)
│   └── tests/         # HTTP integration test files for VS Code REST Client
└── web/               # React 19 + Vite frontend application
    ├── public/        # Static web assets
    └── src/           # React frontend source tree
        ├── api/       # Centralized API client with automatic Bearer token injection
        ├── assets/    # Brand icons and visual vector illustrations
        ├── auth/      # Authentication context, token storage, and session hooks
        ├── components/# Reusable UI primitives and interactive LocationPicker
        ├── context/   # Global client context definitions
        ├── pages/     # Role-guarded screen views
        │   ├── admin/ # System administrator dashboard, user, hospital, and audit views
        │   └── organ/ # Organ transplantation pledges, waitlists, and matching screens
        └── styles/    # Design tokens, global CSS rules, and component stylesheets
```

---

## 5. Prerequisites

Before setting up the project, ensure the following software is installed on your Windows machine:
1. **Node.js (LTS version 18, 20, or higher)**: Check with `node -v` and `npm -v`.
2. **PostgreSQL 16 or higher** (with **pgAdmin 4**): Check with `& "C:\Program Files\PostgreSQL\<version>\bin\psql.exe" --version`.
3. **Git**: Check with `git --version`.

---

## 6. Setup, Step by Step (PowerShell)

All commands below are tailored for **Windows PowerShell 5.1**.

### Step 1: Clone Repository and Navigate to Folder
```powershell
git clone https://github.com/shivamhaldankar/donor-network-web.git
Set-Location -Path donor-network-web
```

### Step 2: Create the PostgreSQL Database
Open pgAdmin 4, right-click **Databases** → **Create** → **Database...**, name it `donor_network`, and click **Save**.  
Alternatively, execute via PowerShell using PostgreSQL's CLI utilities:
```powershell
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$env:PGPASSWORD = "<your-postgres-password>"
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres donor_network
```
*(Replace `18` with your installed PostgreSQL version folder if different).*

### Step 3: Run Database Scripts in Exact Order
Execute the numbered SQL migration scripts in `database/` in ascending order.
> [!WARNING]
> `00_reset.sql` wipes the entire `public` schema (`DROP SCHEMA public CASCADE`). Only run it on your local development database.

```powershell
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$env:PGPASSWORD = "<your-postgres-password>"

# 1. Reset schema (clean slate for development)
& $psql -U postgres -d donor_network -f database\00_reset.sql

# 2. Core tables, domains, constraints, and indexes
& $psql -U postgres -d donor_network -f database\01_schema.sql

# 3. Seed demo hospitals, staff, donors, and organ waitlist
& $psql -U postgres -d donor_network -f database\02_seed.sql

# 4. Blood matching engine, Haversine function, triggers, and views (Slice 1)
& $psql -U postgres -d donor_network -f database\10_blood_matching.sql

# 5. Scheduled restoration via pg_cron (skipped safely if pg_cron is unavailable)
& $psql -U postgres -d donor_network -f database\11_scheduler.sql

# 6. Audit logging triggers and notification queue trigger (Slice 2)
& $psql -U postgres -d donor_network -f database\20_audit_notifications.sql

# 7. Organ priority scoring, matching function, and ranked waitlist view (Slice 3)
& $psql -U postgres -d donor_network -f database\30_organ_matching.sql
```

### Step 4: Configure and Start the Backend Server
```powershell
Set-Location -Path server
npm install
Copy-Item -Path .env.example -Destination .env
```
Open `server\.env` in a text editor (e.g., `notepad .env`) and set the following required variables:
- `DB_PASSWORD`: Set to `<your-postgres-password>`.
- `JWT_SECRET`: Any random 32+ character string (e.g. `pulse_secret_key_jwt_super_safe_12345`).
- `PORT`: `5000` (default).
- `ELIGIBILITY_SCHEDULER`: `node` (uses `node-cron` on Windows).
- `NOTIFY_PROVIDER`: `console` (prints outgoing alerts to the server console; requires no external credentials).

Seed the administrator account and launch the development API:
```powershell
npm run seed:admin
npm run dev
```
*(The server starts listening on `http://localhost:5000` and initializes the background notification worker).*

### Step 5: Configure and Start the Frontend Web Application
Open a second PowerShell window, navigate to the project directory, and launch the Vite dev server:
```powershell
Set-Location -Path d:\donor-network_web\donor-network-web\web
npm install
if (Test-Path -Path .env.example) { Copy-Item -Path .env.example -Destination .env }
npm run dev
```

### Step 6: Verify Service Health
- **Web Application**: Open [http://localhost:5173](http://localhost:5173) in your browser.
- **Backend API**: Running at [http://localhost:5000/api](http://localhost:5000/api).
- **Health Check Endpoint**: Verify server status at [http://localhost:5000/api/health](http://localhost:5000/api/health) (returns `{"status":"ok","ts":"..."}`).

---

## 7. Demo Accounts (Development Only)

All seeded demo accounts are configured with the shared password **`Pulse@123`**. The System Admin account is configured via `server/.env` and created by `npm run seed:admin` with default password **`Admin@123`**.

| Role | Email | Password | Details & Test Scenario |
|---|---|---|---|
| **Hospital Staff** | `staff.citycare@example.com` | `Pulse@123` | Anita Kulkarni · City Care Hospital (ID 1, Pune) · **Verified**. Test creating CRITICAL requests, auto-matching, logging donations, waitlist management, and organ matching. |
| **Hospital Staff** | `staff.sunrise@example.com` | `Pulse@123` | Farhan Qureshi · Sunrise Medical Center (ID 2, Mumbai) · **Verified**. Test hospital ownership isolation (cannot view or cancel City Care requests; receives 403). |
| **Hospital Staff** | `staff.newhope@example.com` | `Pulse@123` | Rohit Jadhav · New Hope Clinic (ID 4, Nashik) · **Unverified**. Test verification enforcement (signs in successfully, but blocked with 403 on raising requests or waitlists). |
| **Donor** | `aarav@example.com` | `Pulse@123` | Aarav Shah · O+ · Pune (ID 1) · Never donated · **Eligible now** (countdown: 0 days). Has a Kidney pledge. Test receiving/accepting blood matches and organ pledge lifecycle. |
| **Donor** | `priya@example.com` | `Pulse@123` | Priya Nair · O+ · Pune (ID 2) · Donated 120 days ago · **Eligible now** · Both Email and SMS enabled. Test multi-channel notification dispatch. |
| **Donor** | `neha@example.com` | `Pulse@123` | Neha Kulkarni · O+ · Pune (ID 6) · Donated 30 days ago · **Ineligible** (countdown: 60 days remaining). Test profile countdown and 409 rejection when staff logs donation. |
| **Admin** | `admin@pulse.test` | `Admin@123` | System Administrator · Seeded by `seedAdmin.js`. Test hospital verification, user deactivation, audit log inspection, queue health, and manual eligibility restoration. |

---

## 8. Database Objects

The table below catalogs every table, domain, index, view, function, and trigger across the Pulse schema.

| Object Name | Type | Defining File | Purpose |
|---|---|---|---|
| `blood_type_t` | Domain | `01_schema.sql` | Constrains blood types to 8 valid groups (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`) |
| `abo_group_t` | Domain | `01_schema.sql` | Constrains ABO groups for organ matching to 4 valid groups (`A`, `B`, `AB`, `O`) |
| `organ_type_t` | Domain | `01_schema.sql` | Constrains valid organ types (`Kidney`, `Liver`, `Cornea`, `Heart`, `Lung`, `Pancreas`) |
| `hospitals` | Table | `01_schema.sql` | Registered healthcare institutions with contact details, GPS coordinates, and verification status |
| `hospital_staff` | Table | `01_schema.sql` | Staff accounts linked to a hospital with credentials and active flag |
| `donors` | Table | `01_schema.sql` | Donor profiles with blood type, coordinates, last donation date, eligibility status, and alert toggles |
| `admins` | Table | `01_schema.sql` | System administrator credentials created by offline seed script |
| `requests` | Table | `01_schema.sql` | Blood and organ availability requests created by verified hospital staff |
| `match_log` | Table | `01_schema.sql` | Matches linking blood requests to eligible donors with distance in km and response status |
| `donations` | Table | `01_schema.sql` | Completed blood and organ donation records |
| `notifications` | Table | `01_schema.sql` | Queue of outbound alert messages with delivery status, channel, and retry counters |
| `organ_registry` | Table | `01_schema.sql` | Organs pledged by donors with lifecycle status (`AVAILABLE`, `MATCHED`, `DONATED`, `WITHDRAWN`) |
| `organ_waitlist` | Table | `01_schema.sql` | Patients awaiting organ transplantation with clinical urgency scores (1–10) and listed date |
| `organ_match_log` | Table | `01_schema.sql` | Ranked organ proposals linking pledged organs to waitlisted candidates with priority scores |
| `abo_compatibility` | Table | `01_schema.sql` | Immunological matrix defining permissible donor-recipient ABO blood group pairs |
| `audit_log` | Table | `01_schema.sql` | Append-only audit trail capturing security-sensitive actions and entity modifications |
| `idx_donors_blood` | Index | `01_schema.sql` | B-tree index on `donors(blood_type)` accelerating matching queries |
| `idx_requests_status`| Index | `01_schema.sql` | Composite index on `requests(status, urgency)` optimizing open emergency lookups |
| `idx_match_donor` | Index | `01_schema.sql` | Index on `match_log(donor_id)` accelerating donor profile match history lookups |
| `idx_notif_queue` | Index | `01_schema.sql` | Composite index on `notifications(status, created_at)` optimizing queue polling |
| `idx_waitlist_organ` | Index | `01_schema.sql` | Composite index on `organ_waitlist(organ_type, status)` speeding up organ candidate discovery |
| `idx_audit_created` | Index | `01_schema.sql` | Descending index on `audit_log(created_at DESC)` for admin log inspection |
| `haversine_km` | Function | `10_blood_matching.sql` | Computes great-circle distance in km between two GPS coordinates; returns NULL if any input is NULL |
| `vw_eligible_donors`| View | `10_blood_matching.sql` | Slices active donors eligible to donate blood right now (`cooldown <= CURRENT_DATE - 90`) |
| `vw_donor_eligibility`| View | `10_blood_matching.sql` | Calculates donor countdown metrics (`days_remaining`, `next_eligible_date`, `is_eligible`) |
| `vw_critical_open_requests`| View | `10_blood_matching.sql` | Lists open/matched critical requests joined with hospital names and days open |
| `find_matching_donors`| Function | `10_blood_matching.sql` | Matches eligible donors within radius (or same city fallback), ranks nearest-first, and inserts up to 10 |
| `fn_trg_critical_request`| Function | `10_blood_matching.sql` | Trigger function invoking `find_matching_donors` on new CRITICAL blood requests |
| `trg_critical_request`| Trigger | `10_blood_matching.sql` | AFTER INSERT on `requests`: calls `find_matching_donors` when critical blood request is inserted |
| `fn_trg_check_donor_eligibility`| Function | `10_blood_matching.sql` | Enforces 90-day cooldown before donation; raises exception `DONOR_NOT_ELIGIBLE` (`P0001`) |
| `trg_check_donor_eligibility`| Trigger | `10_blood_matching.sql` | BEFORE INSERT on `donations`: blocks donations from donors who donated within 90 days |
| `fn_trg_after_donation`| Function | `10_blood_matching.sql` | Updates donor `last_donation_date`, marks `eligible_status = 'N'`, and fulfills linked request |
| `trg_after_donation`| Trigger | `10_blood_matching.sql` | AFTER INSERT on `donations`: synchronizes donor eligibility and request status atomically |
| `restore_donor_eligibility`| Function | `10_blood_matching.sql` | Resets `eligible_status = 'Y'` for donors past 90 days and enqueues `ELIGIBLE_AGAIN` notifications |
| `restore_donor_eligibility_daily`| Scheduled Job | `11_scheduler.sql` | Daily midnight cron job scheduled via `pg_cron` (if extension available) |
| `fn_after_match` | Function | `20_audit_notifications.sql` | Trigger function inserting email and/or SMS notification rows when a donor is matched |
| `trg_after_match` | Trigger | `20_audit_notifications.sql` | AFTER INSERT on `match_log`: enqueues notifications per donor's enabled channels (no patient name) |
| `fn_audit_requests` | Function | `20_audit_notifications.sql` | Writes `REQUEST_CREATED` and `REQUEST_STATUS_CHANGED` records to `audit_log` |
| `trg_audit_requests`| Trigger | `20_audit_notifications.sql` | AFTER INSERT OR UPDATE on `requests`: audits request creation and status transitions |
| `fn_audit_donations`| Function | `20_audit_notifications.sql` | Writes `DONATION_LOGGED` records to `audit_log` |
| `trg_audit_donations`| Trigger | `20_audit_notifications.sql` | AFTER INSERT on `donations`: audits logged donations |
| `fn_audit_hospitals`| Function | `20_audit_notifications.sql` | Writes `HOSPITAL_VERIFIED` or `HOSPITAL_UNVERIFIED` records to `audit_log` |
| `trg_audit_hospitals`| Trigger | `20_audit_notifications.sql` | AFTER UPDATE on `hospitals`: audits verification status changes |
| `fn_audit_organ_match`| Function | `20_audit_notifications.sql` | Writes `ORGAN_MATCH_CONFIRMED` records to `audit_log` when proposal is accepted |
| `trg_audit_organ_match`| Trigger | `20_audit_notifications.sql` | AFTER UPDATE on `organ_match_log`: audits confirmed organ transplant proposals |
| `organ_priority` | Function | `30_organ_matching.sql` | Calculates recipient priority score: `0.5*U + 0.3*W + 0.2*P` (clamped 0–100) |
| `match_organ` | Function | `30_organ_matching.sql` | Filters ABO-compatible waiting patients, scores them, and inserts top 5 proposals into `organ_match_log` |
| `confirm_organ_match`| Function | `30_organ_matching.sql` | Atomically accepts proposal, sets pledge/patient `MATCHED`, and marks competing proposals `REJECTED` |
| `fn_trg_pledge_withdrawn`| Function | `30_organ_matching.sql` | Rejects pending proposals on withdrawal; raises `PLEDGE_ALREADY_MATCHED` if already matched |
| `trg_pledge_withdrawn`| Trigger | `30_organ_matching.sql` | BEFORE UPDATE on `organ_registry`: guards against withdrawing matched organ pledges |
| `vw_waitlist_ranked`| View | `30_organ_matching.sql` | Waitlisted patients ranked by clinical urgency score DESC and waiting duration DESC |

---

## 9. API Overview

Base URL: `http://localhost:5000/api`

| Method | Path | Allowed Roles | Summary / Description |
|---|---|---|---|
| `POST` | `/auth/signup` | Public | Register new Donor or Hospital Staff account; returns JWT and user profile |
| `POST` | `/auth/login` | Public | Sign in as Donor, Staff, or Admin; returns JWT and user profile |
| `GET` | `/auth/me` | Signed-in (`DONOR`, `STAFF`, `ADMIN`) | Fetch current authenticated user payload from token |
| `GET` | `/hospitals` | Public | Retrieve list of hospitals for staff sign-up dropdown |
| `PATCH` | `/hospitals/:id/verify` | `ADMIN` | Update hospital verification status |
| `GET` | `/notifications/me` | `DONOR` | Fetch latest 50 notifications received by current donor |
| `GET` | `/admin/stats` | `ADMIN` | Dashboard counts for users, unverified hospitals, and queue health |
| `GET` | `/admin/users` | `ADMIN` | List all registered donors and staff members with status |
| `PATCH` | `/admin/users/:role/:id/active` | `ADMIN` | Activate or deactivate a donor or staff account |
| `GET` | `/admin/audit` | `ADMIN` | Retrieve system audit log (latest 100 entries) |
| `GET` | `/admin/notifications` | `ADMIN` | Queue health summary (pending, sent, failed counts and recent errors) |
| `POST` | `/admin/jobs/restore-eligibility` | `ADMIN` | Execute `restore_donor_eligibility()` manually on demand |
| `GET` | `/donors/me` | `DONOR` | Fetch donor profile with dynamic countdown metrics |
| `PUT` | `/donors/me` | `DONOR` | Update phone, city, coordinates, and notification toggles |
| `GET` | `/donors/me/donations` | `DONOR` | Fetch personal donation history, newest first |
| `GET` | `/donors/me/matches` | `DONOR` | Fetch hospital match alerts received by the donor |
| `POST` | `/matches/:id/respond` | `DONOR` (own match) | Respond to match alert (`ACCEPTED` or `DECLINED`) |
| `GET` | `/donors/eligible` | `STAFF`, `ADMIN` | Public directory of eligible donors (contact details omitted) |
| `POST` | `/requests` | `STAFF` (verified hospital) | Create blood or organ request; triggers automatic matching if CRITICAL blood |
| `GET` | `/requests` | `STAFF` (own hospital), `ADMIN` (all) | Retrieve hospital requests with match counts |
| `GET` | `/requests/critical` | `STAFF` (own hospital), `ADMIN` (all) | Fetch open critical requests from `vw_critical_open_requests` |
| `GET` | `/requests/:id/matches` | `STAFF` (own hospital), `ADMIN` (all) | Fetch matched donors for a request ordered nearest-first with phone numbers |
| `PATCH` | `/requests/:id/cancel` | `STAFF` (own hospital), `ADMIN` (all) | Cancel an active request |
| `POST` | `/donations` | `STAFF` | Log a blood or organ donation; triggers 90-day cooldown |
| `POST` | `/organs/pledges` | `DONOR` | Register a new pledged organ |
| `GET` | `/organs/pledges` | `DONOR` | List personal organ pledges |
| `DELETE` | `/organs/pledges/:id` | `DONOR` (own pledge) | Withdraw an organ pledge (blocked if already matched) |
| `GET` | `/organs/pledges/available` | `STAFF`, `ADMIN` | Browse available organ pledges across the network (donor identities masked) |
| `POST` | `/organs/waitlist` | `STAFF` (verified hospital) | Add patient to hospital's organ transplant waiting list |
| `GET` | `/organs/waitlist` | `STAFF` (own hospital), `ADMIN` (all) | View ranked waiting list from `vw_waitlist_ranked` |
| `PATCH` | `/organs/waitlist/:id/remove`| `STAFF` (own hospital), `ADMIN` (all) | Remove a patient from the waiting list |
| `POST` | `/organs/pledges/:id/match` | `STAFF`, `ADMIN` | Execute `match_organ()` to generate top 5 ranked proposals |
| `POST` | `/organs/matches/:id/confirm`| `STAFF` (recipient hospital), `ADMIN`| Confirm organ proposal via `confirm_organ_match()` |
| `GET` | `/stats/staff` | `STAFF` | Retrieve emergency dashboard counts for staff hospital |
| `GET` | `/health` | Public | System health status check |

---

## 10. Tests

### Running Automated Database Tests (psql)
Each test file executes inside isolated transactions (`BEGIN ... ROLLBACK`), making test executions completely idempotent without modifying seed data.

Execute from PowerShell:
```powershell
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$env:PGPASSWORD = "<your-postgres-password>"

# Slice 1 Tests (Blood Matching, Eligibility & Countdown)
& $psql -U postgres -d donor_network -f database\tests\slice1_tests.sql

# Slice 2 Tests (Notification Queues & Audit Triggers)
& $psql -U postgres -d donor_network -f database\tests\slice2_tests.sql

# Slice 3 Tests (ABO Compatibility, Organ Priority & Confirmation)
& $psql -U postgres -d donor_network -f database\tests\slice3_tests.sql
```

### Running Automated Database Tests in pgAdmin 4
1. In pgAdmin, expand **Servers** → **PostgreSQL** → **Databases** → `donor_network`.
2. Click **Tools** → **Query Tool** (or press `Alt + Shift + Q`).
3. Click **Open File** (`Ctrl + O`), navigate to `database/tests/slice1_tests.sql`, and click **Select**.
4. Press **Execute / Refresh** (`F5`).
5. Inspect the **Messages** tab to observe `PASS` notices for all executed test cases.
6. Repeat for `slice2_tests.sql` and `slice3_tests.sql`.

### Running HTTP Integration Tests (.http files)
The repository contains integration test suites in `server/tests/`:
- `server/tests/foundation.http`: Core auth, duplicate sign-up checks, token verification.
- `server/tests/slice1.http`: Donor profile, critical blood request creation, match queries, donation logging.
- `server/tests/slice2.http`: RBAC route guarding, hospital verification toggling, queue health.
- `server/tests/slice3.http`: Organ waitlist additions, pledge creation, match proposal execution, proposal confirmation.

**How to execute**:
1. Open the repository in VS Code with the **REST Client** extension (`humao.rest-client`) installed.
2. Start the backend server (`npm run dev` in `server/`).
3. Open any `.http` file in `server/tests/`.
4. Click the **Send Request** link displayed directly above each HTTP request to view live JSON response status and payloads.

### Test Coverage Matrix (T1 to T27)

| Test ID | Description | File Covering Test | Result |
|---|---|---|---|
| **T1** | Insert request with non-existent `hospital_id` rejected by foreign key | `database/01_schema.sql` (FK constraint) & `server/tests/foundation.http` | run and record |
| **T2** | Insert donor with invalid blood type `X+` rejected by CHECK constraint | `database/01_schema.sql` (`blood_type_t`) | run and record |
| **T3** | Create CRITICAL BLOOD request with eligible donors nearby → matched and status set to `MATCHED` | `database/tests/slice1_tests.sql` & `server/tests/slice1.http` | run and record |
| **T4** | Insert blood donation updates eligibility, sets last donation date, fulfills request, and rejects ineligible donors | `database/tests/slice1_tests.sql` & `server/tests/slice1.http` | run and record |
| **T5** | Sign up twice with duplicate email rejected with HTTP 409 Conflict | `server/tests/foundation.http` & `server/tests/slice2.http` | run and record |
| **T6** | Sign in with wrong password rejected with HTTP 401 Unauthorized | `server/tests/foundation.http` & `server/tests/slice2.http` | run and record |
| **T7** | Access protected route without Bearer token rejected with HTTP 401 Unauthorized | `server/tests/foundation.http` & `server/tests/slice2.http` | run and record |
| **T8** | Donor role calls `POST /requests` rejected with HTTP 403 Forbidden | `server/tests/slice2.http` | run and record |
| **T9** | Staff of Hospital A reads matches for Hospital B's request rejected with HTTP 403 Forbidden | `server/tests/slice2.http` | run and record |
| **T10** | Staff of unverified hospital creates request rejected with HTTP 403 Forbidden | `server/tests/slice2.http` | run and record |
| **T11** | Non-admin user calls `/admin/*` route rejected with HTTP 403 Forbidden | `server/tests/slice2.http` | run and record |
| **T12** | Deactivated user attempts to sign in rejected with HTTP 403 Forbidden | `server/tests/slice2.http` | run and record |
| **T13** | Donors at 10 km and 40 km matched in order; donor at 200 km excluded when radius is 50 km | `database/tests/slice1_tests.sql` | run and record |
| **T14** | Donor with missing GPS coordinates matched via same-city fallback with `distance_km = NULL` | `database/tests/slice1_tests.sql` | run and record |
| **T15** | `match_log` insert queues notification per enabled channel (EMAIL only → 1; EMAIL+SMS → 2; patient name omitted) | `database/tests/slice2_tests.sql` (T15a, T15b, T15c) | run and record |
| **T16** | Background worker dispatches pending notification, marks status `SENT`, and records `sent_at` | `server/tests/slice2.http` & `server/jobs/notifier.js` | run and record |
| **T17** | Delivery failure increments retry count; marks status `FAILED` after 3 failed attempts | `server/tests/slice2.http` & `server/jobs/notifier.js` | run and record |
| **T18** | Request creation while background notifier worker is stopped succeeds without blocking | `server/tests/slice2.http` & `database/20_audit_notifications.sql` | run and record |
| **T19** | Donor profile countdown view (`vw_donor_eligibility`) for donor who donated 30 days ago returns `days_remaining = 60` | `database/tests/slice1_tests.sql` & `server/tests/slice1.http` | run and record |
| **T20** | Reset last donation date to 91 days ago and run `restore_donor_eligibility()` → restores eligibility and queues alert | `database/tests/slice1_tests.sql` | run and record |
| **T21** | Scheduled eligibility job executes daily at midnight via scheduler | `database/11_scheduler.sql` & `server/jobs/eligibility.js` | run and record |
| **T22** | Donor accepts match via `POST /matches/:id/respond` → sets `contacted_status = 'ACCEPTED'` and records timestamp | `server/tests/slice1.http` | run and record |
| **T23** | Match A+ donor organ against waitlist (A, AB, B, O) → proposes only ABO-compatible recipients (A and AB) | `database/tests/slice3_tests.sql` | run and record |
| **T24** | Priority score ranking with seed data correctly ranks Ramesh Patil (81.4) > Imran Sheikh (69.7) > Sunita Rao (52.7) | `database/tests/slice3_tests.sql` | run and record |
| **T25** | Two compatible patients with equal urgency and distance: patient with longer waiting duration ranks first | `database/tests/slice3_tests.sql` | run and record |
| **T26** | Confirm organ proposal sets pledge and patient `MATCHED`, rejects competing proposals; second confirm fails | `database/tests/slice3_tests.sql` & `server/tests/slice3.http` | run and record |
| **T27** | Withdraw pledge with pending proposals rejects them; withdrawing already `MATCHED` pledge raises exception | `database/tests/slice3_tests.sql` & `server/tests/slice3.http` | run and record |

---

## 11. Troubleshooting

### Port Already in Use (Error: `EADDRINUSE: address already in use :::5000` or `:::5173`)
Another process is running on port 5000 or 5173. Identify and terminate the process using PowerShell:
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess | Stop-Process -Force
```

### Password Authentication Failed (`password authentication failed for user "postgres"`)
- Ensure PostgreSQL service is running: `Get-Service -Name postgresql*`.
- Verify the password in `server\.env` under `DB_PASSWORD` matches your local PostgreSQL master password.
- Test connection manually: `& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d donor_network`.

### "Failed to Fetch" or Network Error in Frontend
- Verify that the Express server is running on `http://localhost:5000`.
- Verify health check in browser: `http://localhost:5000/api/health`.
- Check `web\.env` to confirm `VITE_API_URL=http://localhost:5000/api`.

### PowerShell Execution Policy Error (`cannot be loaded because running scripts is disabled`)
When running `npm` or local activation scripts, PowerShell may block unverified scripts:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

### `pgcrypto` Permission Error in `02_seed.sql`
`02_seed.sql` uses `CREATE EXTENSION IF NOT EXISTS pgcrypto;` to hash seed passwords using `crypt(..., gen_salt('bf', 10))`. If your PostgreSQL user lacks superuser permissions:
```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d donor_network -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

---

## 12. Known Limitations

1. **Operating System Scheduler (`pg_cron` vs `node-cron`)**: Standard Windows distributions of PostgreSQL do not bundle the `pg_cron` shared-library extension. Pulse addresses this gracefully: `11_scheduler.sql` catches extension absence with a notice, and `server/jobs/eligibility.js` uses `node-cron` as an automated cross-platform fallback that calls the exact same SQL function (`SELECT restore_donor_eligibility()`) at midnight.
2. **Notification Delivery Providers**: In development and viva evaluation, `NOTIFY_PROVIDER` defaults to `console`. Real SMTP email delivery (via Mailtrap or Ethereal) and SMS delivery (via Twilio) require external cloud credentials and DLT registration in India; console mode provides complete visibility without paid services.
3. **JWT Storage**: JWT bearer tokens are stored in browser `localStorage` for simplicity in this student prototype. In production, tokens should be stored in `httpOnly`, `Secure`, `SameSite=Strict` cookies accompanied by short-lived access tokens and refresh token rotation.
4. **Login Rate Limiting**: The authentication endpoints do not currently implement IP or account-level rate limiting against brute-force password guessing.
5. **Academic Organ Allocation Model**: Pulse's organ matching engine implements a simplified academic model based on ABO compatibility and a multi-attribute priority formula (urgency, waiting time, distance). Real clinical organ allocation (governed in India by NOTTO under the Transplantation of Human Organs Act 1994) requires extensive clinical compatibility testing including HLA tissue typing, Panel Reactive Antibodies (PRA), organ sizing, and pediatric prioritization. Pulse is an educational prototype and is not a clinical medical system.

---

## 13. Team and Ownership

| Slice | Features & Technical Scope | Database | Backend API & Jobs | Frontend Screens | Owner |
|---|---|---|---|---|---|
| **Slice 1** | Blood Matching, Donor Eligibility Engine, 90-Day Cooldown, Profile Countdown | `10_blood_matching.sql`, `11_scheduler.sql`, `haversine_km`, `find_matching_donors`, `restore_donor_eligibility`, `vw_donor_eligibility`, `vw_eligible_donors`, `vw_critical_open_requests`, `tests/slice1_tests.sql` | `routes/donors.js`, `routes/requests.js`, `routes/donations.js`, `routes/matches.js`, `jobs/eligibility.js` | `Profile.jsx` (countdown visual & match response), `Requests.jsx` (blood requests), `Donations.jsx`, `Donors.jsx` | `<name>` |
| **Slice 2** | Security Foundation, RBAC Middleware, Admin Management, Notification Queue & Audit Engine | `20_audit_notifications.sql`, `admins`, `audit_log`, `notifications`, `trg_after_match`, `trg_audit_*`, `tests/slice2_tests.sql` | `server.js`, `config/db.js`, `middleware/auth.js`, `lib/asyncHandler.js`, `lib/audit.js`, `routes/auth.js`, `routes/hospitals.js`, `routes/admin.js`, `routes/notifications.js`, `jobs/notifier.js`, `scripts/seedAdmin.js` | `pages/admin/*` (Dashboard, Hospitals, Users, Audit, Notifications), `pages/Notifications.jsx` | `<name>` |
| **Slice 3** | Organ Allocation Engine, Priority Scoring, Dynamic Route Registry, Web Foundation & Dashboards | `30_organ_matching.sql`, `organ_registry`, `organ_waitlist`, `organ_match_log`, `abo_compatibility`, `organ_priority`, `match_organ`, `confirm_organ_match`, `vw_waitlist_ranked`, `tests/slice3_tests.sql` | `routes/organs.js`, `routes/stats.js` | `routes.config.js`, `App.jsx`, `api/client.js`, `auth/AuthContext.jsx`, `components/ui.jsx`, `LocationPicker.jsx`, `styles/tokens.css`, `pages/Auth.jsx`, `pages/Dashboard.jsx`, `pages/organ/*` | `<name>` |
