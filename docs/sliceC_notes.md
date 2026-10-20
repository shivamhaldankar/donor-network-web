# Pulse — Slice 3 Engineering Notes & Viva Preparation Guide
**Member C: Web Foundation, Organ Matching, and Dashboards**  
**DBMS Lab Project · Academic Year 2026**

---

## 1. Overview of Slice 3 Responsibilities

As Member C, my role encompasses two foundational pillars of Pulse:
1. **The Shared Web Foundation:** Establishing the complete React application architecture, design token system, shared API client with Bearer token injection, authentication state management, reusable UI primitives, and the dynamic route registry that unblocks teammates A and B.
2. **The Organ Transplantation & Recipient Allocation Engine:** Implementing the database schema logic, multi-criteria priority scoring function, ABO blood-group compatibility filtering, proposal ranking, match confirmation transactions, withdrawal protection triggers, Express API endpoints, and interactive UI dashboards.

> [!IMPORTANT]
> **Academic Model Disclaimer:**  
> The organ matching system implemented in Pulse is a **simplified academic model** created to demonstrate advanced database concepts (PL/pgSQL functions, views, triggers, multi-attribute ranking, and transactional state machines). It is **not** a clinical organ allocation system. In real-world clinical governance (such as NOTTO under India's Transplantation of Human Organs Act 1994), organ allocation incorporates complex criteria including HLA antigen tissue typing, Panel Reactive Antibodies (PRA), organ sizing, donor-recipient weight ratios, pediatric priority, and disease-severity scoring (e.g., MELD/PELD).

---

## 2. Dynamic Route Registry & Architecture

### How `routes.config.js` Works
In a three-person team working on one Git repository, having everyone edit `App.jsx` to register pages causes continuous merge conflicts. To solve this, Member C designed a centralized **Route Registry**:

```javascript
// src/routes.config.js
export const routesConfig = [
  { path: '/auth', roles: ['signed-out'], pageFile: 'pages/Auth.jsx', owner: 'C' },
  { path: '/', roles: ['DONOR', 'STAFF'], pageFile: 'pages/Dashboard.jsx', owner: 'C', label: 'Dashboard' },
  { path: '/profile', roles: ['DONOR'], pageFile: 'pages/Profile.jsx', owner: 'A', label: 'My Profile' },
  { path: '/notifications', roles: ['DONOR'], pageFile: 'pages/Notifications.jsx', owner: 'B', label: 'Notifications' },
  { path: '/organ-pledges', roles: ['DONOR'], pageFile: 'pages/organ/Pledges.jsx', owner: 'C', label: 'Organ Pledges' },
  { path: '/requests', roles: ['STAFF', 'ADMIN'], pageFile: 'pages/Requests.jsx', owner: 'A', label: 'Blood Requests' },
  { path: '/donations', roles: ['STAFF'], pageFile: 'pages/Donations.jsx', owner: 'A', label: 'Log Donation' },
  { path: '/donors', roles: ['STAFF', 'ADMIN'], pageFile: 'pages/Donors.jsx', owner: 'A', label: 'Eligible Donors' },
  { path: '/organ-waitlist', roles: ['STAFF', 'ADMIN'], pageFile: 'pages/organ/Waitlist.jsx', owner: 'C', label: 'Organ Waitlist' },
  { path: '/organ-matching', roles: ['STAFF', 'ADMIN'], pageFile: 'pages/organ/Matching.jsx', owner: 'C', label: 'Organ Matching' },
  { path: '/admin', roles: ['ADMIN'], pageFile: 'pages/admin/Dashboard.jsx', owner: 'B', label: 'Admin Overview' },
  // ...
];
```

### Dynamic Loading with Placeholder Fallback
Using Vite's `import.meta.glob('./pages/**/*.jsx', { eager: true })`, the application dynamically inspects existing page files:
- If a teammate's page component exists, it mounts normally.
- If a teammate has not yet built their page file, `resolvePageComponent()` catches the absence and renders a polished **"Coming Soon"** placeholder displaying the target file path and owner.
- **Result:** Teammates simply create their file under `pages/` with a default export. Nobody ever touches `App.jsx`, eliminating merge conflicts entirely.

### Role-Based Access Control (RBAC) in the UI
- **Signed-Out Protection:** Unauthenticated users attempting to access any protected route are redirected to `/auth` with the previous route saved in location state.
- **Signed-In Auth Guard:** Signed-in users visiting `/auth` are redirected to `/admin` (if ADMIN) or `/` (for DONOR/STAFF).
- **Admin Redirection:** ADMIN visiting `/` is automatically routed to `/admin`.
- **Role Guarding:** If a user attempts to manually navigate to an unauthorized URL (e.g., a DONOR accessing `/admin`), the guard redirects them back to their authorized home dashboard.
- **Dynamic Sidebar:** The sidebar filters `routesConfig` by `route.roles.includes(user.role)` and renders only the navigation links authorized for that role.

---

## 3. The Organ Priority Formula

### Mathematical Specification
The priority score is computed by the database function `organ_priority`:

$$\text{Priority Score} = 0.5 \cdot U + 0.3 \cdot W + 0.2 \cdot P$$

Where:
- **Urgency Component ($U$):**
  $$U = \text{urgency\_score} \times 10 \quad (\text{Range: } 10 - 100)$$
- **Waiting Time Component ($W$):**
  $$W = \frac{\min(\text{days\_waiting}, 365)}{365} \times 100 \quad (\text{Range: } 0 - 100)$$
  *(Capped at 365 days so chronic waiting cannot entirely override severe clinical emergencies).*
- **Proximity Component ($P$):**
  $$P = \max\left(0, 100 - \frac{\text{distance\_km}}{5}\right) \quad (\text{Range: } 0 - 100)$$
  *(Yields 100 points at 0 km, decays linearly to 0 at 500 km; evaluates to 0 if coordinates are NULL).*

### Rationale Behind the Weights (0.5 / 0.3 / 0.2)
1. **Urgency Weight (0.5 — 50%):** Medical urgency must dominate allocation because an acute patient with end-stage organ failure will suffer irreversible deterioration without immediate transplantation.
2. **Waiting Time Weight (0.3 — 30%):** Ensures equity and prevents starvation of stable patients who have waited patiently for months or years.
3. **Proximity Weight (0.2 — 20%):** Accounts for **cold ischemia time** (the duration an organ remains viable outside the body on ice: 4–6 hours for hearts/lungs, 12–24 hours for livers/kidneys). Shorter transit distances directly improve graft survival rates.

### Why Weights are Defined Inside PostgreSQL
Instead of computing scores in JavaScript, the constants are declared directly in `organ_priority`:
```sql
w_urgency   CONSTANT NUMERIC := 0.5;
w_waiting   CONSTANT NUMERIC := 0.3;
w_proximity CONSTANT NUMERIC := 0.2;
```
- **Single Source of Truth:** Any client (web, mobile, CLI, reporting job) receives strictly identical calculations.
- **Set-Oriented Efficiency:** The PostgreSQL query planner can filter, score, and sort thousands of candidates in a single index-assisted table scan without transferring unneeded rows over the network to Node.js.

---

## 4. ABO Compatibility Table & Immunological Basis

### The Table
```sql
CREATE TABLE abo_compatibility (
    donor_abo      abo_group_t NOT NULL,
    recipient_abo  abo_group_t NOT NULL,
    PRIMARY KEY (donor_abo, recipient_abo)
);
```

| Donor Group | Compatible Recipients |
|---|---|
| **O** | O, A, B, AB (Universal Organ Donor) |
| **A** | A, AB |
| **B** | B, AB |
| **AB** | AB (Universal Organ Recipient) |

### Why Rh Factor (+ / -) is Ignored for Organs but Enforced for Blood
- **Blood Transfusions (Rh Matters):** Red blood cells (RBCs) express the RhD protein antigen. Introducing Rh+ red blood cells into an Rh- patient triggers anti-D antibody production and fatal hemolytic transfusion reactions.
- **Solid Organ Transplantation (Rh Ignored):** Solid organs (kidneys, livers, hearts) are vascularized tissues. The major immunological barrier is the **ABO blood group antigens**, which are heavily expressed on vascular endothelial cells. RhD antigens are **not expressed** on endothelial or parenchymal cells of solid organs; they exist almost exclusively on erythrocyte membranes. Therefore, an A- donor can safely donate an organ to an A+ or AB+ recipient without Rh-mediated hyperacute vascular rejection.

---

## 5. Walkthrough of `match_organ` and `confirm_organ_match`

### `match_organ(p_organ_id INT)`
```
[Staff presses "Find Recipients"]
       │
       ▼
1. Validate Pledge: Checks organ_registry.status = 'AVAILABLE'.
       │
       ▼
2. Extract ABO: Strips '+' or '-' from donors.blood_type -> v_donor_abo.
       │
       ▼
3. Clear Stale State: Deletes old PROPOSED rows for this organ_id in organ_match_log.
       │
       ▼
4. Candidate Join & Scoring:
   Joins organ_waitlist w (WAITING, same organ_type)
   WITH abo_compatibility c (donor_abo = v_donor_abo AND recipient_abo = w.blood_group)
   WITH hospitals h (for patient coordinates).
   Calculates distance_km via haversine_km() and priority_score via organ_priority().
       │
       ▼
5. Insert Top 5:
   Inserts the top 5 candidates with rank_no (1..5) and status = 'PROPOSED'.
   Returns count of proposals generated.
```

### `confirm_organ_match(p_organ_match_id INT)`
```
[Staff Coordinator clicks "Confirm Match"]
       │
       ▼
1. Atomic Verification:
   Ensures proposal is 'PROPOSED' (else PROPOSAL_NOT_ACTIVE)
   Ensures patient is 'WAITING' (else PATIENT_NOT_WAITING).
       │
       ▼
2. State Transition:
   - Sets chosen proposal status = 'ACCEPTED' in organ_match_log.
   - Sets organ pledge status = 'MATCHED' in organ_registry.
   - Sets patient status = 'MATCHED' in organ_waitlist.
   - Sets competing proposals for that pledge = 'REJECTED'.
       │
       ▼
3. Automated Audit:
   Trigger trg_audit_organ_match on organ_match_log detects 'ACCEPTED'
   and inserts an audit_log record (ORGAN_MATCH_CONFIRMED, actor SYSTEM).
```

### Withdrawal Protection Trigger (`trg_pledge_withdrawn`)
- If a donor withdraws an organ that has pending proposals: the trigger cancels and marks all pending proposals `REJECTED`, allowing the pledge to become `WITHDRAWN`.
- If an organ pledge was already `MATCHED`: the trigger fires:
  ```sql
  RAISE EXCEPTION 'PLEDGE_ALREADY_MATCHED: Cannot withdraw an already matched organ pledge' USING ERRCODE = 'P0001';
  ```
  This immediately aborts the transaction and returns HTTP 409 to the client.

---

## 6. Two-Minute Viva Talk Track

> *"Good morning, examiners. In Pulse, I am Member C, responsible for the Web Foundation, the Organ Matching and Recipient Allocation Engine, and the Hospital Dashboards.*
>
> *First, for the web foundation, I built our plain CSS design system using the project's tokens—incorporating Space Grotesk and Inter typography, with Coral strictly reserved for critical emergency alerts. To enable our team to build in parallel without Git merge conflicts, I engineered a dynamic Route Registry. It uses Vite's `import.meta.glob` to inspect page modules; if a teammate's page isn't ready yet, it renders a 'Coming Soon' placeholder with their name and target file path. It also enforces our role guards and generates the sidebar per role.*
>
> *Second, for the organ module, I designed a multi-criteria priority scoring engine inside PostgreSQL. When a hospital coordinator runs matching on an available organ pledge, our `match_organ` function filters waiting patients strictly by organ type and ABO blood-group compatibility via our `abo_compatibility` lookup table. Note that Rh factor is ignored here because Rh antigens are not expressed on vascular endothelial cells of solid organs.*
>
> *Compatible patients are scored using the formula: 50% Urgency score, 30% Waiting time, and 20% Proximity using the Haversine formula to minimize cold ischemia time. The top 5 candidates are recorded as proposals with their score breakdowns.*
>
> *When a coordinator confirms a proposal, `confirm_organ_match` executes an atomic state transition: it sets the proposal to ACCEPTED, marks both the pledge and the patient as MATCHED, and marks all other proposals REJECTED. A trigger on the registry protects matched pledges from being withdrawn.*
>
> *Finally, I exposed these through authenticated Express routes with privacy masking—protecting donor identities and masking other hospitals' patient names—and built our Donor and Staff dashboards. All Slice 3 test cases T23 through T27 pass idempotently inside PostgreSQL."*

---

## 7. Five Likely Examiner Questions & Answers

### Q1: Why implement the organ matching and priority formula in PostgreSQL functions rather than in Express/JavaScript?
**Answer:**
*"Because this is a database-driven system where data integrity and consistency are paramount. If matching logic lived in Express, multiple backend instances or direct database access from other services could calculate conflicting scores or suffer from race conditions. Keeping the logic in PL/pgSQL means:
1. It executes in the database engine right next to the data, avoiding transferring hundreds of candidate records over the network.
2. It guarantees transactional consistency—locking and status transitions happen atomically in single database transactions.
3. Every client receives the exact same priority ranking."*

### Q2: Why is the Rh factor (+ / -) ignored in organ matching, but strictly enforced in blood matching?
**Answer:**
*"In blood transfusion, red blood cells carry the RhD protein antigen, which triggers severe hemolytic reactions if mismatched. In solid organ transplantation, the organs consist of parenchymal tissue and vascular endothelium. Endothelial cells strongly express ABO carbohydrate antigens, which can cause hyperacute graft rejection, but they do not express the RhD protein. Therefore, an A- donor organ can be safely transplanted into an A+ or AB+ recipient."*

### Q3: How does the priority formula handle patients without GPS coordinates, and why is waiting time capped at 365 days?
**Answer:**
*"If a hospital or donor has no coordinates, `haversine_km` returns NULL, and `organ_priority` assigns 0 points to the proximity component rather than crashing. Waiting time is capped at 365 days ($\min(\text{days}, 365)$) so that a stable patient who has waited 3 years cannot mathematically overtake an acute emergency patient whose organ is failing today. Urgency must always retain clinical precedence."*

### Q4: What prevents two coordinators at different hospitals from confirming the same organ pledge simultaneously?
**Answer:**
*"Concurrency is safeguarded at the database level inside `confirm_organ_match`. The function verifies that the proposal status is `PROPOSED` and the pledge is `AVAILABLE`. When the first coordinator confirms, the pledge status immediately transitions to `MATCHED` and competing proposals are set to `REJECTED`. If a second coordinator submits a confirmation on the same pledge, the proposal status is no longer `PROPOSED`, and the function raises a `PROPOSAL_NOT_ACTIVE` exception (`P0001`), which our Express error handler converts to an HTTP 409 Conflict."*

### Q5: How does the dynamic route registry help parallel team development?
**Answer:**
*"In traditional React applications, all team members edit `App.jsx` to import components and define `<Route>` tags, leading to constant merge conflicts. Our `routes.config.js` decouples route definitions from file creation. It automatically loads existing files using `import.meta.glob`; if a teammate's file does not exist yet, it renders a placeholder indicating who owns it. This allowed me to merge the web foundation on Day 1 so teammates A and B could pull `main` and create their pages independently."*
