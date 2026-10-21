# Project Synopsis

## 1. Title
**Pulse: Blood and Organ Donor Real-Time Availability Network**  
*A Database-Driven Emergency Matching and Allocation Platform*  
**Course**: Database Management Systems (DBMS) Laboratory Mini Project  
**Academic Year**: 2026  

---

## 2. Problem Statement
In emergency medical situations requiring blood transfusions or solid organ transplants, healthcare facilities often face catastrophic delays in sourcing compatible donors. Conventional donor applications operate primarily as static directories: they fail to track real-time clinical eligibility (such as the mandatory 90-day cooldown period between whole-blood donations), do not calculate geographical proximity between donors and requesting hospitals, and do not proactively alert nearby compatible donors. Furthermore, solid organ allocation is frequently hindered by fragmented communication, lacking transparent, multi-criteria prioritization systems that balance immunological compatibility, recipient medical urgency, waiting duration, and organ ischemic transport constraints.

**Pulse** addresses these systemic challenges by implementing an automated, database-driven availability network. By embedding spatial math, compatibility validation, eligibility enforcement, and notification queueing directly inside PostgreSQL stored procedures and triggers, Pulse eliminates application-layer latency, guarantees transactional consistency, and ensures zero-latency donor discovery during medical emergencies.

---

## 3. Objectives
1. **Automated Emergency Matching**: Engineer zero-latency matching inside PostgreSQL that identifies the top 10 compatible blood donors within a configurable radius immediately upon creation of a critical request.
2. **Database-Enforced Eligibility Cooldown**: Guarantee biological safety by enforcing a 90-day cooldown interval between blood donations using database triggers, rejecting ineligible donations at the engine level.
3. **Spatial Distance Ranking**: Implement the Haversine spherical distance formula in PL/pgSQL to rank matching donors nearest-first, with graceful fallback to same-city matching when coordinates are absent.
4. **Multi-Attribute Organ Prioritization**: Design an organ allocation engine that filters candidates by ABO blood-group compatibility and ranks recipients using a composite mathematical priority score (urgency, waiting time, proximity).
5. **Decoupled Notification Architecture**: Establish an asynchronous notification pipeline inside PostgreSQL that enqueues alerts atomically with matches and processes them via a background worker using `FOR UPDATE SKIP LOCKED`.
6. **Role-Based Security & Governance**: Implement strict Role-Based Access Control (RBAC) across Donors, Hospital Staff, and Administrators with hospital-level data isolation, bcrypt hashing, and tamper-proof database audit logging.

---

## 4. Scope
- **Emergency Blood Network**: Creation of blood availability requests (`CRITICAL`, `MODERATE`, `LOW`), instant spatial matching, donor distance calculation, and donation logging.
- **Donor Lifecycle & Profile**: Public donor registration, dynamic eligibility countdown metrics, personal donation histories, and response workflows (Accept/Decline).
- **Solid Organ Allocation (Academic Model)**: Organ pledge registration, waitlist management, ABO compatibility lookup, multi-attribute recipient scoring, and transactional match confirmation.
- **Asynchronous Notification Delivery**: Multi-channel alert dispatch (Email and SMS) decoupled from request creation, featuring automatic retry state machines.
- **Administrative Governance**: Hospital verification workflows, user activation/deactivation, queue health monitoring, and system-wide audit trail inspection.

---

## 5. Modules

### Module 1: User Authentication & Role-Based Access Control (RBAC)
Handles user onboarding and session security. Donors and hospital staff register publicly, while administrator accounts are provisioned via offline seeding. Passwords are encrypted using bcrypt (10 rounds). Protected endpoints enforce JWT authentication and role validation (`requireRole`). Hospital staff are strictly restricted to accessing records linked to their specific institution.

### Module 2: Blood Availability Request & Spatial Matching Engine
Enables verified hospital staff to raise emergency requests. When a `CRITICAL` blood request is inserted, an `AFTER INSERT` database trigger executes `find_matching_donors()`. The function filters active, eligible donors of the exact blood type within the specified search radius using `haversine_km()`, ranks them nearest-first, inserts up to 10 candidates into `match_log`, and promotes the request status to `MATCHED`.

### Module 3: Donor Eligibility Engine & Cooldown Scheduler
Enforces the 90-day whole-blood donation cooldown. A `BEFORE INSERT` trigger on `donations` intercepts and blocks donations from donors whose last donation occurred within 90 days, raising a custom `P0001` exception. An `AFTER INSERT` trigger marks the donor ineligible and fulfills the linked request. A scheduled job executes `restore_donor_eligibility()` daily at midnight, resetting eligible status for donors past 90 days and enqueuing reminder alerts.

### Module 4: Asynchronous Notification Queue & Delivery Worker
Decouples notification dispatch from transaction lifecycles. Trigger `trg_after_match` automatically inserts notification records for matched donors according to their enabled channels (Email/SMS) while omitting patient names for privacy. A background Node.js worker polls pending rows every 30 seconds using `FOR UPDATE SKIP LOCKED`, dispatches messages via the configured provider, and implements a 3-attempt retry state machine.

### Module 5: Solid Organ Registry, Waitlist & Recipient Prioritization
Manages solid organ transplantation workflows. Pledged organs are registered as `AVAILABLE`. Staff maintain ranked waiting lists. Function `match_organ()` filters candidates by ABO compatibility using an immunological matrix and computes priority scores: $0.5 \times \text{Urgency} + 0.3 \times \text{Waiting} + 0.2 \times \text{Proximity}$. Function `confirm_organ_match()` atomically executes state transitions: accepting the proposal, matching the pledge and patient, and rejecting competing proposals. A trigger guards against withdrawing matched organs.

### Module 6: Hospital Staff Emergency Operations & Clinical Dashboard
Provides clinical interfaces for hospital coordinators. Staff monitor open critical requests, track days open, inspect matched donor phone numbers, manage patient waiting lists, and view real-time emergency dashboard metrics.

### Module 7: Administrative Governance, Verification & System Audit Logging
Gives system administrators oversight across the entire network. Admins verify hospital registrations, activate or deactivate accounts, review notification queue health, trigger manual eligibility restorations, and inspect an append-only audit log generated by database triggers.

---

## 6. Tools and Technologies

| Layer | Tools & Technologies |
|---|---|
| **Database** | PostgreSQL 16+, PL/pgSQL, pgAdmin 4, pgcrypto, psql CLI |
| **Backend Runtime & API** | Node.js (v18+ LTS, CommonJS), Express 4.19.2 |
| **Database Driver** | `pg` (node-postgres 8.12.0) with custom type parsers |
| **Security & Auth** | `bcrypt` 5.1.1 (10 rounds), `jsonwebtoken` 9.0.2 (HS256) |
| **Scheduling & Workers**| `node-cron` 3.0.3, `pg_cron` (Linux optional) |
| **Notification Providers**| `nodemailer` 6.9.13 (SMTP), `twilio` 5.2.0 (SMS), Console Provider |
| **Frontend Framework** | React 19.2.8, Vite 8.2.0+, React Router 7.18.2 |
| **User Interface** | Plain CSS3 with Custom Design Tokens (`tokens.css`), `lucide-react` |
| **Testing & API Tools** | VS Code REST Client (`.http`), pgAdmin Query Tool, PowerShell 5.1, Git |

---

## 7. Entity-Relationship (ER) Model

### Entities and Cardinalities (Text List)
1. **HOSPITALS**: Represents registered medical institutions (`hospital_id` PK, `name`, `city`, `phone`, `license_no`, `latitude`, `longitude`, `verified`).
2. **HOSPITAL_STAFF**: Staff coordinators employed by hospitals (`staff_id` PK, `hospital_id` FK, `name`, `role`, `phone`, `email` UK, `password_hash`, `is_active`).
   - Cardinality: `HOSPITALS (1) ──── (N) HOSPITAL_STAFF` (One hospital employs many staff members).
3. **DONORS**: Registered blood and organ donors (`donor_id` PK, `name`, `phone`, `email` UK, `blood_type`, `dob`, `gender`, `city`, `latitude`, `longitude`, `last_donation_date`, `eligible_status`, `registered_on`, `password_hash`, `notify_email`, `notify_sms`, `is_active`).
4. **ADMINS**: System administrators provisioned offline (`admin_id` PK, `name`, `email` UK, `password_hash`, `created_on`, `is_active`).
5. **REQUESTS**: Emergency blood and organ availability requests (`request_id` PK, `hospital_id` FK, `staff_id` FK, `request_type`, `blood_type_needed`, `organ_type_needed`, `units_needed`, `urgency`, `radius_km`, `patient_name`, `requested_on`, `status`).
   - Cardinality: `HOSPITALS (1) ──── (N) REQUESTS` (One hospital raises many requests).
   - Cardinality: `HOSPITAL_STAFF (1) ──── (N) REQUESTS` (One staff member creates many requests).
6. **MATCH_LOG**: Matched eligible donors for blood requests (`match_id` PK, `request_id` FK, `donor_id` FK, `matched_on`, `distance_km`, `contacted_status`, `responded_on`). Unique constraint on `(request_id, donor_id)`.
   - Cardinality: `REQUESTS (1) ──── (N) MATCH_LOG` (One request generates up to 10 matches).
   - Cardinality: `DONORS (1) ──── (N) MATCH_LOG` (One donor is matched across multiple requests).
7. **DONATIONS**: Completed blood or organ donation events (`donation_id` PK, `donor_id` FK, `request_id` FK [nullable], `hospital_id` FK, `donation_type`, `units`, `donated_on`).
   - Cardinality: `DONORS (1) ──── (N) DONATIONS` (One donor gives many donations).
   - Cardinality: `HOSPITALS (1) ──── (N) DONATIONS` (One hospital receives many donations).
   - Cardinality: `REQUESTS (0..1) ──── (1) DONATIONS` (A donation optionally fulfills a request).
8. **NOTIFICATIONS**: Outbound alert queue (`notification_id` PK, `donor_id` FK, `request_id` FK [nullable], `type`, `channel`, `subject`, `message`, `status`, `attempts`, `created_at`, `sent_at`).
   - Cardinality: `DONORS (1) ──── (N) NOTIFICATIONS` (One donor receives many notifications).
   - Cardinality: `REQUESTS (0..1) ──── (N) NOTIFICATIONS` (A request triggers multiple notifications).
9. **ORGAN_REGISTRY**: Donor organ pledges (`organ_id` PK, `donor_id` FK, `organ_type`, `registered_on`, `status`).
   - Cardinality: `DONORS (1) ──── (N) ORGAN_REGISTRY` (One donor can pledge multiple organs).
10. **ORGAN_WAITLIST**: Patients waiting for organ transplants (`waitlist_id` PK, `hospital_id` FK, `staff_id` FK [nullable], `patient_name`, `organ_type`, `blood_group`, `urgency_score`, `listed_on`, `status`).
    - Cardinality: `HOSPITALS (1) ──── (N) ORGAN_WAITLIST` (One hospital lists many waitlisted patients).
11. **ORGAN_MATCH_LOG**: Ranked organ recipient proposals (`organ_match_id` PK, `organ_id` FK, `waitlist_id` FK, `priority_score`, `distance_km`, `rank_no`, `matched_on`, `status`).
    - Cardinality: `ORGAN_REGISTRY (1) ──── (N) ORGAN_MATCH_LOG` (One organ pledge has up to 5 proposals).
    - Cardinality: `ORGAN_WAITLIST (1) ──── (N) ORGAN_MATCH_LOG` (A patient appears in multiple proposals).
12. **ABO_COMPATIBILITY**: Immunological matrix (`donor_abo` PK, `recipient_abo` PK) defining 9 permissible organ transplantation pairings. Standalone lookup.
13. **AUDIT_LOG**: Tamper-proof system audit trail (`log_id` PK, `actor_role`, `actor_id`, `action`, `entity`, `entity_id`, `created_at`). Standalone append-only log.

---

## 8. Database Design Highlights

### Integrity Constraints and Domains
- **Domains**: `blood_type_t` enforces 8 valid blood types; `abo_group_t` enforces 4 ABO groups; `organ_type_t` restricts valid organ pledges to 6 clinical types.
- **Table Constraints**: Check constraints ensure `latitude` is between -90 and 90, `longitude` is between -180 and 180, `radius_km` is between 1 and 500, `units_needed` > 0, `urgency_score` is between 1 and 10, and `chk_request_target` ensures blood requests specify blood types while organ requests specify organ types.

### Stored PL/pgSQL Functions
- `haversine_km(lat1, lon1, lat2, lon2)`: Computes spherical distance in kilometres; handles NULL coordinates safely and clamps trigonometric domains.
- `find_matching_donors(p_request_id)`: Filters eligible active donors, evaluates radius or city fallback, orders nearest-first, inserts top 10 matches into `match_log`, and sets status `MATCHED`.
- `restore_donor_eligibility()`: Identifies donors 90+ days past last donation, updates status to `Y`, enqueues `ELIGIBLE_AGAIN` notifications, and returns restored count.
- `organ_priority(urgency, days_waiting, distance_km)`: Evaluates multi-criteria priority score: $0.5 \times U + 0.3 \times W + 0.2 \times P$.
- `match_organ(p_organ_id)`: Validates pledge availability, joins waitlisted patients through `abo_compatibility`, computes distance and priority, and generates top 5 ranked proposals.
- `confirm_organ_match(p_organ_match_id)`: Atomically transitions proposal to `ACCEPTED`, pledge to `MATCHED`, patient to `MATCHED`, and competing proposals to `REJECTED`.

### Automated Triggers
- `trg_critical_request`: AFTER INSERT on `requests` — executes instant matching for critical blood requests.
- `trg_check_donor_eligibility`: BEFORE INSERT on `donations` — enforces 90-day cooldown and blocks ineligible donors.
- `trg_after_donation`: AFTER INSERT on `donations` — updates last donation date, marks donor ineligible, and fulfills request.
- `trg_after_match`: AFTER INSERT on `match_log` — queues notification rows for enabled channels (omits patient name).
- `trg_pledge_withdrawn`: BEFORE UPDATE on `organ_registry` — blocks withdrawal of already matched organ pledges.
- `trg_audit_*`: Automated audit triggers on `requests`, `donations`, `hospitals`, and `organ_match_log`.

### Materialized Business Views
- `vw_eligible_donors`: Exposes active donors eligible to donate right now.
- `vw_donor_eligibility`: Computes live donor countdown metrics (`days_remaining`, `next_eligible_date`, `is_eligible`).
- `vw_critical_open_requests`: Displays open and matched critical requests with hospital names and days open.
- `vw_waitlist_ranked`: Orders waitlisted organ patients by clinical urgency score DESC and waiting duration DESC.

---

## 9. Team Structure and Ownership

| Slice | Technical Scope & Responsibilities | Assigned Member |
|---|---|---|
| **Slice 1: Blood Matching, Eligibility Engine & Donor Profile** | Database blood matching (`find_matching_donors`, `haversine_km`), 90-day cooldown triggers (`trg_check_donor_eligibility`, `trg_after_donation`), eligibility views (`vw_donor_eligibility`, `vw_eligible_donors`), scheduled restoration (`restore_donor_eligibility`), backend routes (`requests`, `donations`, `donors`, `matches`), and frontend pages (`Profile.jsx` countdown, `Requests.jsx`, `Donations.jsx`, `Donors.jsx`). | `<name>` |
| **Slice 2: Security Foundation, RBAC, Admin Governance & Notification Queue** | Database security tables (`admins`, `audit_log`, `notifications`), audit triggers (`trg_audit_*`), notification trigger (`trg_after_match`), backend foundation (`server.js`, `db.js`, `middleware/auth.js`, `routes/auth.js`, `routes/admin.js`, `routes/hospitals.js`), background worker (`jobs/notifier.js`), and admin frontend pages (`Dashboard.jsx`, `Hospitals.jsx`, `Users.jsx`, `Audit.jsx`, `Notifications.jsx`). | `<name>` |
| **Slice 3: Organ Allocation Engine, Recipient Prioritization, Web Foundation & Dashboards** | Database organ modules (`organ_registry`, `organ_waitlist`, `organ_match_log`, `abo_compatibility`), scoring function (`organ_priority`), matching functions (`match_organ`, `confirm_organ_match`), withdrawal trigger (`trg_pledge_withdrawn`), waitlist view (`vw_waitlist_ranked`), backend routes (`routes/organs.js`, `routes/stats.js`), React web foundation (`routes.config.js`, `App.jsx`, `api/client.js`, `styles/tokens.css`), and frontend screens (`Pledges.jsx`, `Waitlist.jsx`, `Matching.jsx`, `Dashboard.jsx`). | `<name>` |

---

## 10. Expected Outcome
The project delivers a production-grade, database-driven web application featuring:
1. **Sub-second spatial matching** for critical emergency blood requests executed directly inside PostgreSQL.
2. **Guaranteed clinical safety** with 90-day donation cooldowns enforced at the engine level without application bypass.
3. **Transparent multi-attribute organ allocation** incorporating ABO blood-group compatibility, medical urgency, waiting time, and ischemic travel distance.
4. **Resilient asynchronous messaging** via an internal PostgreSQL queue with automated retries.
5. **Complete auditability** ensuring all security-sensitive actions generate immutable audit log records.

---

## 11. Limitations and Future Scope

### Limitations
1. **Operating System Scheduling**: The PostgreSQL `pg_cron` extension is not packaged by default on Windows; the system uses `node-cron` in the Node.js backend as a cross-platform fallback.
2. **Notification Delivery Modes**: Defaults to console logging in development to avoid requiring paid third-party SMS/SMTP gateway accounts and commercial DLT registrations.
3. **Session Token Storage**: JWT tokens are retained in browser `localStorage` for prototype simplicity rather than `httpOnly` secure cookies.
4. **Academic Organ Model**: Organ allocation uses a simplified academic model based on ABO compatibility and a weighted score; it does not incorporate clinical HLA tissue typing, Panel Reactive Antibodies (PRA), or pediatric priority as mandated in real clinical systems (e.g., NOTTO).

### Future Scope
1. **PostGIS Integration**: Transition from PL/pgSQL mathematical formulas to native PostGIS spatial indexes (`GIST`) and geometries for sub-millisecond querying over millions of regional coordinates.
2. **Clinical Organ Metrics**: Integration with standardized clinical scoring models (e.g., MELD for liver, KDPI for kidney) and HLA genetic matching algorithms.
3. **Mobile & Push Notifications**: Native Android/iOS applications supporting WebPush and Firebase Cloud Messaging (FCM) for instant push notifications to off-duty donors.
4. **Enhanced Session Security**: Migration to `httpOnly`, `Secure` cookies with short-lived access tokens and refresh token rotation.
