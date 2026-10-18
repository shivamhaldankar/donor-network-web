# Pulse — Team Plan (3 members)

Repo: https://github.com/shivamhaldankar/donor-network-web
Spec to build from: `docs/requirements_and_design.md` (the API table, schema, and test list in that file are the shared contract).

---

## 1. How the work is split

**Recommended: foundation by layer in Week 1, then feature slices in Weeks 2–4.**

A DBMS lab is graded mostly on database work. If one person owns all the SQL, the other two will struggle in the viva. So after Week 1, each member owns one *vertical slice*: the SQL, the API routes, and the screens for that feature. Everyone ends up with PL/pgSQL they must defend.

### Week 1 — Foundation (by layer)

| Member | Task | Done when |
|---|---|---|
| **A — Database** | `database/01_schema.sql`: core tables (hospitals, hospital_staff, donors, requests, match_log, donations, organ_registry) with constraints, plus `database/02_seed.sql`. Start from `donor_network_schema_postgres.sql` and the auth columns. | Everyone can run both files on a fresh local database with no errors. |
| **B — Backend** | `server/` skeleton: `config/db.js`, `server.js`, `auth` routes (signup/login), `requireAuth` and `requireRole` middleware, `GET /hospitals`, `.env.example`, health route. | Signup, login, and a protected test route work in Postman. |
| **C — Frontend** | Move the existing app into `web/`, then: layout + sidebar, API helper that adds the token, `RoleRoute` guard, Auth page connected to the API, **all routes from the page map registered as empty placeholder pages**. | App signs in and shows role-based sidebar links. |

Registering every route and page as a stub in Week 1 matters: it means later work goes into separate files and nobody edits the same lines of `server.js` or `App.jsx`.

### Weeks 2–4 — Feature slices

| Slice | Owner | Database | Backend | Frontend |
|---|---|---|---|---|
| **1. Blood matching & eligibility** | **A** | `haversine_km`, `find_matching_donors`, `trg_critical_request`, `trg_after_donation`, `restore_donor_eligibility`, `vw_donor_eligibility`, scheduler (`pg_cron` or `node-cron` fallback), lat/long columns | requests, matches, donations, `/donors/me`, match respond | Requests page with matches + distance, Donations page, **Profile page with countdown** |
| **2. Roles, admin & notifications** | **B** | `admins`, `audit_log` + audit triggers, hospital `verified`, `notifications` table, `trg_after_match` | RBAC on every route, hospital verify, admin routes, **notifier worker** (console + email), notification preferences | Admin pages (stats, hospitals, users, audit, queue health), notifications list |
| **3. Organ module & dashboards** | **C** | `organ_waitlist`, `organ_match_log`, `abo_compatibility`, `organ_priority`, `match_organ`, `confirm_organ_match`, `vw_waitlist_ranked` | pledge, waitlist, match, confirm routes; `/admin/stats` support | Organ pledges, waitlist, organ matching pages; staff dashboard |

Pick who is A, B, and C yourselves. Since the React app already exists, whoever started it is the natural C for Week 1, but any order works.

### Lab deliverables

| Deliverable | Owner |
|---|---|
| Hand-drawn ER diagram (A4) | A |
| Hand-drawn schema diagram (A4) | B |
| Synopsis (update the team table to 3 rows), PPT, README, demo script | C |
| Test report (run the tests below and record results) | Each member for their own slice |

### Tests per slice (numbers refer to the test table in the design doc)

- **Foundation (A):** T1, T2
- **Slice 1 (A):** T3, T4, T13, T14, T19, T20, T21, T22
- **Slice 2 (B):** T5–T12, T15–T18
- **Slice 3 (C):** T23–T27

---

## 2. Repository layout

```
donor-network-web/
├── web/          React app (Vite)
├── server/       Express API + notifier worker
├── database/     numbered SQL files
├── docs/         requirements_and_design.md, ER/schema diagrams, this plan
├── .gitignore
└── README.md     setup steps for the whole project
```

### Moving the current repo into this layout

Right now the repo root *is* the React app (`src`, `public`, `package.json`, …). One person does this once, on a branch, and everyone pulls after it merges:

```bash
git checkout -b chore/monorepo-structure
mkdir web server database docs
git mv src public index.html package.json package-lock.json vite.config.js eslint.config.js web/
git commit -m "Move React app into web/ and add server, database, docs folders"
git push -u origin chore/monorepo-structure
```

Then open a pull request and merge it.

**If this repo is deployed on Vercel** (or Netlify): after the move, open the project's settings and set the **Root Directory** to `web`, or the next deploy will fail. If you haven't deployed it, ignore this.

**A static host only serves the frontend.** The Express server and PostgreSQL won't exist there, so the live site can't sign in. For the lab, demo on localhost. If you want the live link to work, you'd need a hosted Postgres (such as Neon or Supabase) and a host for the Node server (such as Render), which is extra work you can skip.

### `.gitignore` (root)

```
node_modules/
dist/
.env
*.local
.DS_Store
```

**The repo is public.** Never commit `.env`, passwords, JWT secrets, or SMTP/Twilio keys. Commit only `server/.env.example` with placeholder values. If a secret is ever pushed, change it immediately; deleting the file later doesn't remove it from history.

---

## 3. Working together in Git

**Branches:** `main` is always runnable. Everyone works on branches named `<area>/<short-description>`, for example `db/haversine-matching`, `server/rbac-middleware`, `web/profile-countdown`.

**Pull requests:** one teammate reviews each PR before merging. Keep PRs small (one feature or one SQL file). Merge at least every two days so branches don't drift.

**Daily habit:**

```bash
git checkout main && git pull
git checkout -b db/my-feature      # new work
# ... work, commit often ...
git pull origin main               # before opening the PR
git push -u origin db/my-feature
```

**Database changes use numbered files, never edits to old ones:**

```
database/01_schema.sql
database/02_seed.sql
database/03_rbac_audit.sql
database/04_location_matching.sql
database/05_notifications.sql
database/06_organ_matching.sql
```

If you need to change a table another member owns, add a new numbered file (an `ALTER TABLE`) and message the group. Add a `database/reset.sql` or a README line explaining how to rebuild the local database from scratch by running the files in order.

**Each person runs their own local PostgreSQL.** Don't share one database; shared databases cause "who changed my data?" problems. The numbered files keep everyone's database identical.

**Shared hot spots** (conflicts happen here): `server/server.js`, `web/src/App.jsx`, the sidebar component, and `database/01_schema.sql`. The Week 1 stubs exist so you rarely need to touch these again.

**Adding teammates:** on GitHub, open the repo → Settings → Collaborators → Add people. They accept the email invite, then `git clone` the repo.

---

## 4. Timeline (4 weeks)

| Week | Goal | Checkpoint (all three together) |
|---|---|---|
| 1 | Foundation merged. Everyone's local setup works. | Sign up and sign in as donor and staff end to end. |
| 2 | Each slice's database part and main API routes working, tested in Postman/pgAdmin. | Create a CRITICAL blood request and see `match_log` filled by the trigger. |
| 3 | Each slice's screens finished; integrate. | Full demo run: request → matches → notification → accept → donation → ineligible. |
| 4 | Bug fixing, test report, ER/schema diagrams, synopsis, PPT, viva rehearsal. | Dry-run viva where each member explains another member's slice. |

**Cut order if time runs short:** SMS first, then organ module polish, then admin queue-health page. Keep slice 1 and the core of slice 2 working at all costs.

---

## 5. Viva preparation

- Each member should be able to explain, in two minutes, the whole flow: request → trigger → matches → notification → donation → eligibility restore.
- Each member demos their own slice live, including one trigger firing in pgAdmin.
- Rehearse cross-questions: A explains B's RBAC, B explains C's priority formula, C explains A's Haversine function.
- Keep a short list of "why" answers: why triggers instead of API code, why bcrypt, why a notification queue, why ABO-only for organs.
- Be upfront about limits (simplified organ model, localStorage tokens, no rate limiting). Evaluators respect honesty more than surprises.
