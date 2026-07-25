# Faculty Gate Out Pass Management System

A full-stack campus ERP module: faculty raise a gate-out pass request, it
routes through HOD approval → Registrar final approval (which generates a
scannable QR pass + a printable PDF), then Security scans it to record exit
and entry. Admin gets user/department management and reports.

This is a **real, working** system — Node.js + Express API backed by MySQL,
JWT authentication with bcrypt-hashed passwords, and a plain HTML/CSS/JS
client that talks to the API over REST. Every endpoint below has been tested
end-to-end (login → create pass → HOD approve → Registrar approve with real
QR/PDF file generation → Security exit/entry scan → Admin reports).

```
faculty-gatepass-system/
├── server/          Node + Express API (MySQL, JWT, QR, PDF)
├── client/          Static HTML/CSS/JS frontend (talks to the API)
└── database/        schema.sql (run this first)
```

## Quick start with Docker (fastest way to see it running)

If you have Docker installed, this brings up MySQL, the API, and the client
together with the schema already loaded:

```bash
docker compose up --build
```

Then seed demo data once the containers are healthy:

```bash
docker compose exec api npm run seed
```

- Client: http://localhost:8080
- API: http://localhost:5000/api/health

Set real secrets before using this beyond your own machine — create a
`.env` file next to `docker-compose.yml` with `JWT_SECRET`, `DB_PASSWORD`,
and `DB_ROOT_PASSWORD` overrides (docker-compose reads it automatically).

---

## Manual setup (no Docker)

## 1. Prerequisites

- Node.js 18+
- MySQL 8 (or MariaDB 10.6+) running locally, or a connection string to a
  remote instance

## 2. Set up the database

```bash
mysql -u root -p < database/schema.sql
```

This creates the `gatepass` database and four tables: `departments`,
`users`, `gate_passes`, `approval_history`.

## 3. Configure and install the server

```bash
cd server
cp .env.example .env
```

Edit `.env` with your MySQL credentials:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=gatepass
JWT_SECRET=replace_with_a_long_random_secret
```

Install dependencies:

```bash
npm install
```

## 4. Seed demo data

```bash
npm run seed
```

This creates 3 departments, 10 users across all 5 roles, and a handful of
sample gate passes in different states (pending HOD, pending registrar,
approved, completed, rejected) so the system is immediately explorable.

**Demo login — same password for every account:**

| Role      | Email                                    | Password    |
|-----------|-------------------------------------------|-------------|
| Faculty   | shobhnath.shukla.au250505@rntu.ac.in     | Passw0rd!   |
| HOD       | meera.iyer@rntu.ac.in                    | Passw0rd!   |
| Registrar | registrar@rntu.ac.in                     | Passw0rd!   |
| Security  | security@rntu.ac.in                      | Passw0rd!   |
| Admin     | admin@rntu.ac.in                         | Passw0rd!   |

> Re-running `npm run seed` wipes and recreates all demo data — don't run it
> against a database with real records you want to keep.

## 5. Run the API server

```bash
npm start          # plain node
# or
npm run dev         # auto-restarts on file changes
```

The API listens on `http://localhost:5000` by default. Check it's alive:

```bash
curl http://localhost:5000/api/health
```

## 6. Run the client

The client is static — no build step. It's two pages:

- `index.html` — marketing/landing page describing the system
- `app.html` — the actual sign-in screen and role dashboards

From the `client/` folder:

```bash
cd ../client
python3 -m http.server 8080
# or: npx serve .
```

Open `http://localhost:8080` in your browser to see the landing page, or go
straight to `http://localhost:8080/app.html` to sign in. If you deploy the
API somewhere other than `http://localhost:5000`, update `API_BASE` at the
top of `client/js/api.js`.

## API overview

All routes except `/api/auth/*` require `Authorization: Bearer <token>` and
are role-gated (a faculty token cannot call HOD routes, etc — enforced
server-side, not just hidden in the UI).

| Method | Route                          | Role      | Purpose |
|--------|----------------------------------|-----------|---------|
| POST   | /api/auth/login                 | —         | Log in, returns JWT + user |
| GET    | /api/auth/me                    | any       | Current user info |
| GET    | /api/faculty/dashboard          | faculty   | Totals + recent passes |
| POST   | /api/faculty/create-pass        | faculty   | Submit a new request |
| GET    | /api/faculty/history            | faculty   | Full personal history |
| GET    | /api/hod/pending                | hod       | Requests awaiting HOD decision |
| PUT    | /api/hod/approve/:id            | hod       | Approve → moves to Registrar |
| PUT    | /api/hod/reject/:id             | hod       | Reject |
| GET    | /api/registrar/pending          | registrar | Requests awaiting final approval |
| PUT    | /api/registrar/approve/:id      | registrar | Approve → generates QR + PDF |
| PUT    | /api/registrar/reject/:id       | registrar | Reject |
| GET    | /api/security/active            | security  | Approved passes ready for gate movement |
| POST   | /api/security/scan              | security  | Look up a pass by code, no mutation |
| PUT    | /api/security/exit              | security  | Record exit time |
| PUT    | /api/security/entry             | security  | Record entry time → marks Completed |
| GET    | /api/admin/users                | admin     | List all users |
| POST   | /api/admin/user                 | admin     | Create a user |
| GET    | /api/admin/departments          | admin     | List departments |
| GET    | /api/admin/reports              | admin     | Status breakdown, avg approval time |

Generated QR codes and PDFs are served statically from
`/uploads/qrcodes/<pass_code>.png` and `/uploads/passes/<pass_code>.pdf`.

## Notes on what's real vs. what to extend

**Fully working:** authentication, role-based access control, the entire
approval workflow, real QR code generation (`qrcode` package), real PDF gate
pass generation (`pdfkit`), the exit/entry gate cycle, and admin reporting —
all backed by actual MySQL queries with transactions where multiple rows
change together (e.g. approving a pass + writing its audit history row).

**Stubbed, on purpose, as extension points:**
- `services/notificationService.js` — logs to console instead of sending
  real email. Wire up Nodemailer or a transactional email API here.
- There's no camera-based QR *scanning* in the browser — Security enters/
  scans a pass code via text input. Adding a live camera scanner is a
  frontend-only addition (e.g. the `html5-qrcode` library) that posts to the
  same `/api/security/scan` endpoint.
- Password reset (`/api/auth/forgot-password`) doesn't send a reset email
  yet — it's wired to look up the account safely without leaking whether an
  email exists, ready for you to plug in real email delivery.

## Troubleshooting "Failed to fetch" on the sign-in page

This means the browser couldn't reach the API — not a wrong password. As of
this version, the sign-in page shows a banner explaining why instead of the
raw browser error, and `CLIENT_ORIGIN` in `.env.example` now covers the most
common local dev server ports out of the box (`8080`, `5500` — Live
Server's default, `5173` — Vite's default) on both `localhost` and
`127.0.0.1`. If you still see it:

1. **Is the API actually running?** Open `http://localhost:5000/api/health`
   directly in a browser tab. If that fails to load, start it:
   `cd server && npm start`.
2. **Is your client's origin in `CLIENT_ORIGIN`?** Check the URL bar where
   you opened the client (e.g. `http://127.0.0.1:5500`) matches an entry in
   `CLIENT_ORIGIN` inside `server/.env`, then restart the server — it only
   reads `.env` on startup.
3. **Check the browser console (F12).** `ERR_CONNECTION_REFUSED` means the
   server isn't running; a message mentioning `CORS policy` means the origin
   isn't allowed yet.

## Deploying somewhere with a real URL

This repo ships with everything needed to deploy, but actually deploying
requires your own account/credentials on whatever platform you choose — it's
not something that can be done on your behalf from a chat. A few solid
options, roughly easiest first:

- **Railway / Render** — both can build `server/Dockerfile` directly and
  provision a MySQL instance; set the same environment variables as
  `.env.example` in their dashboard.
- **Google Cloud Run + Cloud SQL** — build the server image with
  `gcloud builds submit --tag <region>-docker.pkg.dev/<project>/gatepass/api`
  from inside `server/`, deploy it to Cloud Run, point `DB_HOST` at a Cloud
  SQL (MySQL) instance's connection name, and serve `client/` from Firebase
  Hosting or a Cloud Storage bucket.
- **A VPS (DigitalOcean, etc.)** — `docker compose up --build -d` from the
  project root does the whole stack in one line once Docker is installed.

Whichever you pick, remember to set a real `JWT_SECRET` and point
`CLIENT_ORIGIN` at the client's real deployed URL.

## What's already hardened

- **Helmet** security headers (HSTS, X-Content-Type-Options, X-Frame-Options, etc.)
- **Rate limiting** — 300 req/15min globally per IP, 10 req/15min on `/api/auth/login` specifically
- **Input validation** on every write endpoint (`express-validator`) — bad payloads get a
  clear 400 with field-level messages, never reach the database
- **Role-gated routes**, enforced server-side (verified: a faculty JWT gets a genuine 403 on
  admin/HOD/registrar/security routes, not just a hidden UI button)
- **Transactional writes** — a status change and its audit-history row are committed together;
  a failure rolls back both
- **bcrypt** password hashing (10 rounds), **JWT** with configurable expiry
- **CORS** restricted to `CLIENT_ORIGIN` (comma-separated list supported), not left open by default
- Graceful shutdown (drains the MySQL pool on SIGINT/SIGTERM) and a startup warning if
  `JWT_SECRET` is still the placeholder value

## Before a real production launch, still do this

- Change `JWT_SECRET` to a long random value and never commit `.env`.
- Put the API behind HTTPS (terminate TLS at a reverse proxy / load balancer).
- Consider shorter JWT expiry + refresh tokens instead of the flat 8h expiry used here.
- Point `DB_USER` at a MySQL account scoped to just the `gatepass` database (not root).
- Wire `services/notificationService.js` up to a real email provider.
- Add a process manager (PM2, systemd, or your platform's own restart policy) so the API
  restarts automatically if it crashes.
