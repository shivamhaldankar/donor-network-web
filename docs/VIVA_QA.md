# Pulse — Viva Voce Questions & Answers Guide

This guide contains **30 question-and-answer pairs** prepared for the Pulse DBMS laboratory project evaluation. The questions are grouped by slice and foundational architecture, providing clear, concise, 2-to-4 sentence explanations that any student can comfortably speak out loud during examination.

---

## Part 1: Core Database Architecture & Relational Design (All Members)

### Q1: What normalization level is the Pulse database schema in, and how did you verify it?
**Answer:**
Pulse's schema is normalized to **Third Normal Form (3NF)**. Every table has a primary key with all attributes containing atomic values (1NF), every non-key column is fully functionally dependent on the entire primary key without partial dependencies (2NF), and there are no transitive dependencies between non-key attributes (3NF). For example, hospital details are not repeated inside staff or request records; instead, they are isolated in `hospitals` and referenced strictly via foreign keys.

### Q2: Why did you place business rules like matching and cooldown enforcement in database triggers rather than in Node.js?
**Answer:**
Placing business rules directly in PostgreSQL guarantees ACID consistency and absolute data integrity regardless of which client connects to the database. If logic were implemented solely in Node.js, an administrative script, a mobile app, or a direct query in pgAdmin could easily bypass the 90-day cooldown or matching constraints. Keeping rules in PL/pgSQL triggers ensures that the database engine enforces data validity and transactional safety as a single source of truth.

### Q3: How does Pulse map database exceptions to standard HTTP error responses?
**Answer:**
In PL/pgSQL functions and triggers, business-rule violations are raised using `RAISE EXCEPTION 'CODE: Human readable message' USING ERRCODE = 'P0001';`. The central Express error middleware intercepts PostgreSQL errors: `P0001` exceptions are parsed and returned as HTTP 409 Conflict with the specific error code and message. Unique constraint violations (`23505`) return HTTP 409, while foreign key (`23503`) and check constraint (`23514`) violations return HTTP 400 Bad Request.

### Q4: Why did you use custom PostgreSQL DOMAIN types instead of standard VARCHAR columns?
**Answer:**
We created reusable custom domains like `blood_type_t`, `abo_group_t`, and `organ_type_t` to enforce centralized check constraints across multiple tables. Instead of duplicating `CHECK (blood_type IN (...))` across `donors`, `requests`, and `donations`, defining a single domain guarantees that invalid values like `'X+'` or `'Unknown'` are rejected uniformly across all tables at the database level.

### Q5: What database indexes did you create, and why were they chosen?
**Answer:**
We created targeted B-tree indexes to optimize high-frequency query paths and avoid full-table scans. Specifically, `idx_donors_blood` accelerates blood-type filtering during emergency matching, `idx_requests_status` speeds up open critical request lookups, and `idx_notif_queue` on `(status, created_at)` allows our background worker to fetch pending notifications instantly without scanning previously sent history.

### Q6: What is the difference between a VIEW and a BASE TABLE in Pulse?
**Answer:**
Base tables like `donors` and `requests` physically store persistent data on disk with primary keys and constraints. Views like `vw_donor_eligibility` and `vw_eligible_donors` are stored SQL query definitions that compute dynamic metrics—such as days remaining until eligibility—on the fly without consuming redundant storage or risking synchronization anomalies.

### Q7: How does Pulse handle concurrency when multiple clients write to the database simultaneously?
**Answer:**
PostgreSQL uses Multi-Version Concurrency Control (MVCC) along with row-level locks. For critical state transitions, such as logging a donation or polling the notification queue, transactions acquire row-level locks (`FOR UPDATE`), ensuring that concurrent transactions see committed state and serialize safely without dirty reads or lost updates.

---

## Part 2: Slice 1 — Blood Matching, Eligibility & Donor Profile (Member A)

### Q8: How does the `haversine_km` function calculate distance between a hospital and a donor?
**Answer:**
`haversine_km` computes the great-circle spherical distance across the Earth's surface using latitude and longitude coordinates converted to radians. It applies the Haversine trigonometric formula with a mean Earth radius of 6,371 kilometres. We explicitly clamp the intermediate squared-half-chord value between 0.0 and 1.0 to prevent floating-point rounding precision errors before invoking `sqrt()` and `asin()`.

### Q9: What happens during matching if a donor or hospital has GPS coordinates set to `NULL`?
**Answer:**
If any input coordinate is `NULL`, `haversine_km` immediately returns `NULL` without crashing. Our `find_matching_donors` function anticipates this by implementing a same-city fallback: when coordinates are absent, it matches candidates where `LOWER(TRIM(d.city)) = LOWER(TRIM(h.city))`. In the result set, these donors are placed after distance-ranked donors using `ORDER BY distance_km ASC NULLS LAST`.

### Q10: What is the difference between a `BEFORE INSERT` and an `AFTER INSERT` trigger, using your donation triggers as an example?
**Answer:**
A `BEFORE INSERT` trigger executes prior to committing a row to disk and can abort the transaction if validations fail. We use `trg_check_donor_eligibility` as a BEFORE trigger on `donations` to inspect the 90-day cooldown and abort with an exception before any invalid donation record can be stored. An `AFTER INSERT` trigger executes once the row is valid; our `trg_after_donation` uses this to atomically update `last_donation_date`, set `eligible_status = 'N'`, and fulfill the linked request.

### Q11: If you already store `last_donation_date`, why is `eligible_status` stored in `donors`? Isn't that redundant?
**Answer:**
`eligible_status` is an indexed, stored cache used for rapid dashboard rendering and quick filtering. However, to eliminate data drift and anomalies, our business rules, matching functions, and views never rely on `eligible_status` alone; they always calculate eligibility directly from the date rule: `last_donation_date IS NULL OR last_donation_date <= CURRENT_DATE - 90`. The midnight restoration function synchronizes the stored cache daily.

### Q12: How do you prevent race conditions when two hospital staff try to record a donation for the same donor at the same time?
**Answer:**
The check and the update occur within the exact same database transaction. The BEFORE trigger reads the donor's record, and the AFTER trigger updates `last_donation_date` and `eligible_status = 'N'`, acquiring an exclusive row-level lock on that donor. If a second transaction attempts to insert a donation concurrently, it must wait for the first to commit, after which it immediately detects that the donor is ineligible and raises `DONOR_NOT_ELIGIBLE`.

### Q13: In what exact order does `find_matching_donors` rank matching blood donors?
**Answer:**
Candidates are ordered first by calculated distance in ascending order (`distance_km ASC NULLS LAST`), ensuring the nearest available donors appear first while city-fallback donors appear at the end. Next, candidates are ranked by their donation date in ascending order (`last_donation_date ASC NULLS FIRST`), prioritizing first-time donors who have never donated, followed by donors who have rested the longest. Finally, `donor_id ASC` acts as a deterministic tie-breaker.

### Q14: How does the system restore donor eligibility when `pg_cron` is unavailable on Windows?
**Answer:**
While `11_scheduler.sql` attempts to schedule `restore_donor_eligibility()` at midnight using `pg_cron`, standard Windows PostgreSQL distributions do not include this extension and output a graceful notice. To ensure complete cross-platform reliability, our Node.js server includes a fallback worker in `jobs/eligibility.js` that uses `node-cron` to execute `SELECT restore_donor_eligibility()` daily at midnight, calling the exact same stored database procedure.

---

## Part 3: Slice 2 — Security, RBAC & Notification Queue (Member B)

### Q15: Why did you use bcrypt with 10 salt rounds instead of SHA-256 for storing passwords?
**Answer:**
SHA-256 is a general-purpose cryptographic hash designed to be extremely fast, allowing modern GPUs to compute billions of guesses per second during brute-force attacks. bcrypt is an adaptive, intentionally slow key-derivation function with configurable cost rounds. Using 10 rounds takes approximately 100 milliseconds per hash on a standard CPU, which is imperceptible to legitimate users but makes large-scale offline dictionary attacks computationally unfeasible.

### Q16: Why does your login route return the exact same 401 error whether an email is unknown or a password is incorrect?
**Answer:**
Returning identical error messages prevents **user enumeration attacks**. If the API returned "User not found" for unregistered emails and "Invalid password" for registered ones, an attacker could programmatically test lists of email addresses to discover who holds an account on the platform. To completely prevent timing attacks, our backend executes a dummy bcrypt comparison even when an email does not exist.

### Q17: What information is stored inside the Pulse JWT payload, and how is it secured?
**Answer:**
The JWT payload contains minimal identity metadata: `{ id, role, name, hospital_id? }`. It is signed with a high-entropy secret (`JWT_SECRET`) using the HMAC-SHA256 (`HS256`) algorithm with a 7-day expiration. The token is tamper-proof because any modification to the payload invalidates the signature, and sensitive data like `password_hash` is never included in the token.

### Q18: How does Pulse differentiate between role-based authorization and ownership-based authorization?
**Answer:**
Role-based authorization checks whether a user's role is permitted to call an endpoint (e.g., only `STAFF` can call `POST /donations`). Ownership-based authorization verifies that the authenticated user has rights to the specific record being manipulated. For instance, staff can only view, cancel, or log donations against requests where the request's `hospital_id` matches the `req.user.hospital_id` extracted from their authenticated JWT token.

### Q19: Why does `requireVerifiedHospital` query PostgreSQL live rather than reading a verified flag from the JWT?
**Answer:**
JWTs are stateless; once issued, their contents cannot be changed until expiration. If hospital verification status were stored inside the JWT, a staff member whose hospital was unverified or suspended by an admin would continue to possess full operational privileges for up to 7 days. Querying the `hospitals.verified` column live from the database ensures that administrative revocations take effect immediately.

### Q20: Why are notifications written to a database table instead of being sent directly via SMTP in the route handler?
**Answer:**
Directly sending emails inside an HTTP request couples critical emergency workflows to third-party network latency and server availability. If an external SMTP or SMS server is down or slow, an emergency request could time out or fail completely. By writing notifications to a queue table inside the matching trigger, the emergency request completes in milliseconds, and the background worker handles delivery independently.

### Q21: What does `SELECT ... FOR UPDATE SKIP LOCKED` do, and why is it essential in the notification worker?
**Answer:**
`FOR UPDATE` locks the selected rows within the current transaction so no other process can modify them, while `SKIP LOCKED` instructs PostgreSQL to immediately ignore rows that are already locked by other concurrent transactions instead of waiting. This allows multiple background worker instances or server clusters to poll the same queue concurrently without duplicate processing or thread contention.

### Q22: How does the notification worker handle failed email or SMS deliveries?
**Answer:**
When an external delivery provider throws an error, the worker catches the exception and increments the `attempts` column while leaving the status as `PENDING`. The worker retries the message on subsequent ticks. If `attempts` reaches 3 without successful dispatch, the worker transitions the row status to `FAILED`, allowing administrators to inspect the failure reason on the queue health dashboard.

---

## Part 4: Slice 3 — Organ Allocation & Web Foundation (Member C)

### Q23: Explain the mathematical formula used for organ recipient priority and the rationale behind its weights.
**Answer:**
The priority score is calculated in PostgreSQL as: $\text{Priority} = 0.5 \times U + 0.3 \times W + 0.2 \times P$, yielding a score between 0 and 100. Clinical urgency ($U$) carries 50% weight because acute organ failure represents an immediate life threat. Waiting time ($W$) carries 30% weight to ensure fairness and prevent patient starvation, while proximity ($P$) carries 20% weight to minimize **cold ischemia time**—the duration an organ remains viable on ice outside the human body.

### Q24: Why is the waiting time component ($W$) capped at 365 days in the organ priority function?
**Answer:**
Waiting time is normalized using $\text{LEAST}(\text{days\_waiting}, 365) / 365 \times 100$. Capping the metric at one year prevents a chronic, medically stable patient who has waited for three years from mathematically overtaking an emergency acute patient whose organ is failing today. Clinical emergency must always maintain priority over cumulative time.

### Q25: Why is the Rh factor (+ / -) strictly enforced for blood transfusions but ignored for solid organ transplantation?
**Answer:**
Red blood cells express the RhD protein antigen, which induces severe hemolytic transfusion reactions if introduced into an Rh-negative patient. In contrast, solid organs consist of parenchymal tissue and vascular endothelium that strongly express ABO carbohydrate antigens (the primary barrier to hyperacute vascular rejection) but do not express the RhD protein. Therefore, an A- donor kidney can be safely transplanted into an A+ or AB+ recipient.

### Q26: What happens atomically when hospital staff confirm an organ match proposal?
**Answer:**
The function `confirm_organ_match()` executes an atomic state machine inside a single transaction. It verifies that the proposal is `PROPOSED` and the patient is `WAITING`, updates the chosen proposal status to `ACCEPTED`, sets the organ pledge to `MATCHED`, sets the patient to `MATCHED`, and marks all competing proposals for that organ as `REJECTED`. An audit trigger automatically captures the confirmation.

### Q27: How does the trigger `trg_pledge_withdrawn` protect the integrity of the organ allocation system?
**Answer:**
`trg_pledge_withdrawn` is a `BEFORE UPDATE` trigger on `organ_registry`. If a donor attempts to withdraw a pledge that has already been confirmed (`OLD.status = 'MATCHED'`), the trigger blocks the update and raises `PLEDGE_ALREADY_MATCHED` (`P0001`), returning an HTTP 409 error. If the pledge is still active with unconfirmed proposals, it permits the withdrawal and automatically marks all pending proposals as `REJECTED`.

### Q28: How does the dynamic Route Registry in `routes.config.js` facilitate team development without Git merge conflicts?
**Answer:**
In standard React applications, every developer edits `App.jsx` to import components and define `<Route>` paths, resulting in frequent merge conflicts. Our architecture centralizes routing in `routes.config.js` and uses Vite's `import.meta.glob` to inspect page files dynamically. If a teammate has not yet implemented their page, the registry automatically renders a styled "Coming Soon" placeholder, allowing team members to merge and build screens completely independently.

---

## Part 5: System Limitations & Viva Honesty (All Members)

### Q29: What are the primary clinical limitations of Pulse's organ matching engine?
**Answer:**
Pulse implements an educational, academic allocation model based solely on ABO compatibility, travel distance, and a basic 1–10 urgency score. Real-world organ allocation—such as India's NOTTO under the Transplantation of Human Organs Act 1994 or UNOS in the United States—requires comprehensive clinical compatibility tests, including HLA tissue typing, Panel Reactive Antibodies (PRA), organ size matching, donor-to-recipient weight ratios, pediatric prioritization, and disease-specific severity scores like MELD.

### Q30: What specific improvements would you implement before deploying Pulse into a clinical production environment?
**Answer:**
For a production deployment, we would:
1. Migrate spatial calculations to **PostGIS** with spatial `GIST` indexes for sub-millisecond proximity queries across millions of coordinates.
2. Replace `localStorage` token storage with **`httpOnly`, `Secure`, `SameSite=Strict` cookies** alongside short-lived access tokens and refresh token rotation.
3. Add rate limiting using Redis on authentication endpoints to resist brute-force attacks.
4. Integrate push notifications (WebPush and FCM) to alert off-duty donors instantly on mobile devices.
