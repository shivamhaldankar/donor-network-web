# Pulse — Server

Express 4 API for the Pulse blood/organ donor network.  
PostgreSQL 16+, Node 18+, CommonJS.

---

## Quick start

### 1. Install dependencies

```powershell
cd server
npm install
```

### 2. Create your `.env` file

```powershell
Copy-Item .env.example .env
```

Open `.env` and fill in:

| Variable | What to set |
|---|---|
| `DB_PASSWORD` | Your local PostgreSQL password |
| `JWT_SECRET` | Any long random string (run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin login credentials (default: `admin@pulse.test` / `Admin@123`) |

### 3. Rebuild the database

Run these files in order using pgAdmin's Query Tool or psql:

```powershell
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$env:PGPASSWORD = "your_password"
& $psql -U postgres -d donor_network -f ..\database\00_reset.sql
& $psql -U postgres -d donor_network -f ..\database\01_schema.sql
& $psql -U postgres -d donor_network -f ..\database\02_seed.sql
& $psql -U postgres -d donor_network -f ..\database\20_audit_notifications.sql
```

If Member A's blood-matching files exist, also run `10_blood_matching.sql` and `11_scheduler.sql`.

### 4. Seed the admin account

```powershell
npm run seed:admin
```

This creates the admin login from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`.  
Safe to run multiple times — it skips if the account already exists.

### 5. Start the development server

```powershell
npm run dev
```

Server starts at `http://localhost:5000`.  
Test the health check: `http://localhost:5000/api/health`

---

## Project structure

```
server/
├── server.js          Main app: CORS, routes auto-mount, error handler
├── config/
│   └── db.js          pg Pool + type parsers
├── middleware/
│   └── auth.js        requireAuth, requireRole, requireVerifiedHospital
├── lib/
│   ├── asyncHandler.js  Wraps async routes so errors reach the error handler
│   ├── audit.js         Writes to audit_log for actions without a DB trigger
│   └── providers/
│       ├── console.js   Default: prints notifications to terminal
│       ├── smtp.js      Sends email via Nodemailer
│       └── twilio.js    Sends SMS via Twilio
├── routes/
│   ├── auth.js          POST /signup, POST /login, GET /me
│   ├── hospitals.js     GET /hospitals, PATCH /hospitals/:id/verify
│   ├── admin.js         All /admin/* routes (ADMIN only)
│   └── notifications.js GET /notifications/me (DONOR only)
├── jobs/
│   └── notifier.js      Every 30 s: send PENDING notifications, mark SENT/FAILED
├── scripts/
│   └── seedAdmin.js     npm run seed:admin
└── tests/
    └── slice2.http      REST Client test file
```

---

## Environment variables

See `.env.example` for the full list with descriptions.

---

## npm scripts

| Script | What it does |
|---|---|
| `npm start` | Run with Node (production) |
| `npm run dev` | Run with nodemon (auto-restart on file changes) |
| `npm run seed:admin` | Create the admin account from `.env` |

---

## Notification providers

Set `NOTIFY_PROVIDER` in `.env`:

| Value | Behaviour |
|---|---|
| `console` (default) | Prints subject + message to terminal. No account needed. |
| `smtp` | Sends real emails. Fill in `SMTP_*` vars. Use Mailtrap for testing. |
| `twilio` | Sends SMS. Fill in `TWILIO_*` vars. |
