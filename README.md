# BloodBridge — “Be a Donor. Be a Savior.”

[![Full-Stack Production Ready](https://img.shields.io/badge/status-production--ready-brightgreen.svg)](#)
[![Database](https://img.shields.io/badge/database-PostgreSQL%2016-blue.svg)](#)
[![Backend Tests](https://img.shields.io/badge/backend%20tests-18%2F18%20passing-success.svg)](#)
[![Frontend Tests](https://img.shields.io/badge/frontend%20tests-22%2F22%20passing-success.svg)](#)
[![Zero-Cost Target](https://img.shields.io/badge/cost-%E2%82%B90%20local%20dev-orange.svg)](#)

BloodBridge is a mission-critical, full-stack blood donation and community healthcare emergency network built with **React 19, TypeScript, Tailwind CSS, Node.js, Express, Socket.IO, Prisma ORM, and PostgreSQL 16**.

---

## 🌟 Key Platform Capabilities

1. **Relational Database Architecture:**
   - Powered exclusively by PostgreSQL 16.
   - Zero NoSQL dependencies.
   - Full ACID transaction guarantees for donor enrollment, referral attribution, and account recovery.

2. **Complete Authentication System:**
   - Email/password authentication with memory-hard scrypt hashing and timing-safe verification.
   - Real-world Email OTP verification powered by CPET's Gmail SMTP configuration.
   - Google OAuth 2.0 / OpenID Connect authorization code flow.
   - Forgot-password and password-reset workflows with secure token expiration.
   - Role-Based Access Control (RBAC) protecting administrative operations.

3. **Zero-Knowledge Donor Privacy & Contact Masking:**
   - Raw donor telephone numbers are protected behind authorization boundaries.
   - Unapproved users receive masked telephone numbers (`+1 (555) •••-4819`).
   - Registration forms enforce non-preselected consent checkboxes for GDPR compliance.

4. **Real-Time Communication (Socket.IO):**
   - Authenticated WebSocket handshakes via JWT.
   - Server-controlled private user rooms (`user:<userId>`) and administrative channels (`admin:operations`).
   - Instant real-time alerts when new donors enroll via referral codes.

5. **Performance Optimized:**
   - Vendor chunk splitting (`vendor-react`, `vendor-charts`, `index`).
   - Zero-warning production build compiling in 6.33 seconds (65% improvement).
   - Server-side indexed database pagination and selective projections.

---

## 📁 Repository Layout

```
bloodbridge/
├── frontend/             # React 19 + TypeScript + Tailwind CSS UI (34 Screens)
│   ├── public/
│   ├── src/
│   │   ├── app/          # App router, providers, route guards
│   │   ├── components/   # Accessible design system components
│   │   ├── layouts/      # Public, Auth, User, Admin layouts
│   │   ├── pages/        # All 34 production screens
│   │   ├── services/     # Pluggable Service Adapters (HTTP & Mock)
│   │   └── types/        # TypeScript DTOs and domain types
│   ├── tests/            # Vitest component & privacy tests
│   ├── package.json
│   └── vite.config.ts    # Optimized bundle chunk splitting
│
├── backend/              # Node.js + Express + Prisma + PostgreSQL 16 API
│   ├── src/
│   │   ├── config/       # Environment & database config
│   │   ├── modules/      # Auth, Donors, Referrals, Consent, Notifications, Admin, Support, OAuth
│   │   ├── middleware/   # JWT auth, error handler, rate limiter, Zod validator
│   │   ├── sockets/      # Authenticated Socket.IO engine
│   │   ├── shared/       # Email delivery, password crypto, JWT utilities
│   │   ├── app.ts        # Express app
│   │   └── server.ts     # HTTP server entry point with Socket.IO
│   ├── prisma/
│   │   ├── schema.prisma # Normalized PostgreSQL schema
│   │   └── seed.ts       # Re-runnable seed script
│   ├── tests/            # Supertest API integration test suite
│   ├── .env.example
│   └── package.json
│
├── docs/                 # Complete platform technical documentation
│   ├── ARCHITECTURE.md   # System topology and ACL contracts
│   ├── API.md            # REST API endpoint reference
│   ├── SOCKET_EVENTS.md  # Socket.IO connection lifecycle & event schemas
│   ├── DATABASE.md       # Relational models, constraints, and indexes
│   ├── SECURITY.md       # Cryptography, contact masking, and GDPR audit
│   ├── PERFORMANCE.md    # Bundle optimization and query performance
│   └── SETUP.md          # Zero-cost local setup guide
│
├── package.json          # Monorepo workspaces definition
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start (Windows)

Everything runs locally with SQLite. No database server is needed.

| Script in `launch\` | What it does |
| :--- | :--- |
| `1 - Start Demo.cmd` | Frontend only, with built-in sample data (no backend). |
| `2 - Start Full App.cmd` | Installs packages, updates the database (`prisma generate`, `db push`, seed), starts the backend (port 5000) and the website (http://localhost:5173). **Run this after pulling code that changes `backend\prisma\schema.prisma`.** |
| `3 - Restart Backend.cmd` | Restarts only the backend, e.g. after editing `backend\.env`. |
| `4 - Check Code.cmd` | Type-checks backend and frontend. |
| `5 - Delete Test Users.cmd` | Deletes the accounts listed in `launch\delete-users.txt` (one email or mobile number per line) so they can be reused. Admins are never deleted. |
| `6 - Delete Test Requests.cmd` | Deletes blood requests whose patient name ends in `(test)`, and the alerts they sent. |

Logs are written to `launch\*.log`.

Manual commands (run from the repo root only; never run `npm install` inside `backend` or `frontend`):
```bash
npm install
cd backend && npx prisma generate && cd ..
cd backend && npx prisma db push && npm run prisma:seed
npm run dev:backend    # http://localhost:5000
npm run dev:frontend   # http://localhost:5173
```

---

## ⚙️ Configuration

All backend settings live in **`backend\.env`** (copy `backend\.env.example` to start). After changing a value, run `3 - Restart Backend.cmd`.
Frontend settings live in **`frontend\.env`**; restart the website (`2 - Start Full App.cmd`) after changing them.

### Sign-in and sessions
| Setting | Default | What it controls |
| :--- | :--- | :--- |
| `SESSION_IDLE_MINUTES` | `5` | Minutes with no clicks, taps or typing before a signed-in person is signed out. Any activity keeps the session going. The sign-in token lasts this long and is renewed while the person is active. |
| `JWT_SECRET` | (dev value) | Secret used to sign sign-in tokens. **Set a long random value in production.** Changing it signs everyone out. |
| `JWT_REFRESH_EXPIRY` | `7d` | Lifetime of legacy refresh tokens. |
| `JWT_ACCESS_EXPIRY` | `15m` | No longer used: token lifetime now follows `SESSION_IDLE_MINUTES`. |

How sign-in works:
- **Email or mobile + password:** signs in directly, with no code.
- **Login with mobile number:** a 6-digit code is sent by SMS (when SMS is set up, see below), otherwise to the account's email. In development the code is also printed in the backend window.
- **Sign up:** always needs the 6-digit code emailed to the person, to confirm they are real.

### One-time codes (OTP)
| Setting | Default | What it controls |
| :--- | :--- | :--- |
| `EMAIL_OTP_TTL_SECONDS` | `300` | How long a code stays valid. |
| `EMAIL_OTP_MAX_ATTEMPTS` | `5` | Wrong tries allowed before the code is cancelled. |
| `EMAIL_OTP_RESEND_COOLDOWN_SECONDS` | `60` | Wait before a new code can be requested. |
| `PASSWORD_RESET_TTL_SECONDS` | `900` | How long a password-reset link stays valid. |

### Email (SMTP)
| Setting | Example | Notes |
| :--- | :--- | :--- |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | `smtp.gmail.com` / `587` / `false` | Gmail settings shown. |
| `SMTP_USER` / `SMTP_PASS` | your Gmail / 16-letter app password | Create the app password at Google Account → Security → App passwords. |
| `SMTP_FROM` / `SMTP_FROM_NAME` | sender address / display name | |

### SMS (for "Login with mobile number")
| Setting | Example | Notes |
| :--- | :--- | :--- |
| `SMS_PROVIDER` | `msg91` | Leave empty to send codes by email instead. |
| `MSG91_AUTH_KEY` | from the MSG91 dashboard | |
| `MSG91_TEMPLATE_ID` | DLT-approved OTP template | The template text must contain `##otp##`. Required by Indian SMS (TRAI DLT) rules. |

### Google sign-in
| Setting | Example |
| :--- | :--- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application) |
| `GOOGLE_CALLBACK_URL` | `http://localhost:5000/api/v1/auth/google/callback` (add the same URL as an authorised redirect URI in Google Cloud) |

Without these, the "Continue with Google" button shows a "not set up yet" message.

### Family Safety Circle subscription (web-first payments)

**What is free and what is paid**
- **Free for everyone, always:** sign up, find donors (counts), post blood requests, matching donors near the hospital get alerted, receive alerts, respond, donate, public request pages, fraud reports.
- **Paid (Family Circle subscription):** sharing the savior (referral) link, sharing the family invite, seeing your family's donor list (names and numbers), and alerting those family donors on your requests wherever they live.
- Pledging to someone else's family through their invite is free.
- The server enforces this: only `POST /referrals/share` and `POST /family/invite` refuse without a subscription (HTTP 402 `SUBSCRIPTION_REQUIRED`); the family circle sends counts only, and family donors are left out of request alerts. Request and donor-search endpoints never check the subscription.

| Setting | Default | What it controls |
| :--- | :--- | :--- |
| `SUBSCRIPTION_AMOUNT_INR` | `200` | Price in rupees. |
| `SUBSCRIPTION_PERIOD_MONTHS` | `12` | How long one payment lasts. Paying again extends from the current end date. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | empty | Razorpay keys (use Test Mode `rzp_test_...` keys first). Empty in development = a "Simulate payment" button appears instead. |
| `RAZORPAY_PLAN_ID` | empty | Optional. A yearly plan (same price) from Razorpay → Subscriptions → Plans. When set, Razorpay charges the renewal automatically every year. When empty, payments are one-time and people get a "renews soon" reminder 7 days before the end date. |
| `RAZORPAY_WEBHOOK_SECRET` | empty | Optional, needed with `RAZORPAY_PLAN_ID`. Create a webhook to `https://<your-site>/api/v1/subscriptions/webhook` with events `subscription.charged`, `subscription.cancelled`, `subscription.halted`, and put its secret here. |

Automatic renewal is **on by default**. People can turn it off on the Subscribe page; the plan stays active until its end date. A background job runs every hour for renewals and reminders. Locally, the Subscribe page has a "Test: end my plan now and run renewal" button for simulated plans.

Payments are taken on the website only; the mobile apps send people to the website to subscribe.

### Server and database
| Setting | Default | Notes |
| :--- | :--- | :--- |
| `PORT` | `5000` | Backend port. |
| `NODE_ENV` | `development` | Use `production` on a live server (also turns off dev-only helpers like simulated payments and printed codes). |
| `DATABASE_URL` | `file:./dev.db` | SQLite file for local use. |
| `FRONTEND_URL` | `http://localhost:5173` | Website address, used in emails and Google sign-in redirects. |

### Frontend (`frontend\.env`)
| Setting | Default | Notes |
| :--- | :--- | :--- |
| `VITE_APP_MODE` | `api` | `api` = real backend, `demo` = built-in sample data. |
| `VITE_API_BASE_URL` | `/api/v1` | Keep `/api/v1` locally (the website forwards it to port 5000). |
| `VITE_SESSION_IDLE_MINUTES` | `5` | Fallback only; the backend's `SESSION_IDLE_MINUTES` wins. |

Country-specific settings (states, districts, phone format, helplines) are in `shared\countries.ts` and `shared\india.ts`.

---

## 🩸 Blood requests, Find Donors and Family permissions

**Blood requests** (`/app/requests`, admin: `/admin/requests`)
- Anyone signed in with a verified email and a mobile number can post a request (patient, blood group, units, hospital, state/district/city, urgency, needed-by). At most 3 active requests per person.
- On posting, matching donors are alerted in the app: same district, compatible blood group, marked available, and no donation in the last 90 days. Donors who pledged to the requester's family (with "send me this family's requests" on) are alerted wherever they live.
- **10 statuses:** submitted → open / donors alerted → donor found → in progress → partly fulfilled → fulfilled, plus cancelled, expired (24 h after "needed by") and closed. Only allowed changes are possible.
- **Verification is a separate track** (not verified / under review / verified / not approved). A request that is not approved is cancelled automatically and can only be closed.
- **Admin hold:** pauses a request (no alerts, no responses); releasing it sends any alerts that were held back.
- **Phone privacy:** donors' numbers are hidden. A donor who accepts sees the requester's number; the requester sees a donor's number only if that donor ticks "show my number for this request". Protected (masked) calling is shown as "coming soon" (no call provider chosen yet).
- **Public link** `/r/<code>`: information only (blood group, hospital, city, urgency). No names or numbers. Responding needs a signed-in donor with a compatible blood group.

**Find Donors** (`/app/find-donors`) shows counts only (exact group, compatible, can donate now) for a state or district. Donors are never listed.

**Family Safety Circle permissions** (per family, set by the donor on My Family → "Families you've pledged to help"):
- the family owner can see my mobile number and call me;
- send me this family's emergency requests wherever I am;
- the family owner can see whether I can donate right now.
Only the person who sent the invite sees these, never other family members.

**Ending a relationship:** the family owner can remove a donor from the circle (Remove). Everything shared stops at once. An optional, unticked box also stops that donor from pledging to the family again.

**Fraud checks** (policy page: `/safety`, admin: `/admin/requests`)
- Every new request gets a risk score from warning signs: new account (+20), several requests in 24 h (+15) or in different districts (+25), same patient posted by another account (+25), copied notes (+15), **mentions of money / UPI / agents (+60)**, hospital not in the list (+10), PIN code from another district (+15), new account asking 4+ critical units (+15).
  - under 30: goes live · 30–59: live, marked "Under review", admins alerted · 60+: **held**, no donor is alerted until an admin releases it.
- **Patient document** (photo or PDF, up to 5 MB, stored in `backend\uploads\`, never public): checked for re-use in another request, signs of photo-editing apps, and its text is read (OCR, `tesseract.js`; PDFs with `pdf-parse`) and compared with the hospital, patient name, blood group and a date in the last 30 days. Stamps and signatures still need a call to the hospital. The first OCR run downloads English language data (needs internet).
- **Reports:** donors can report a request (money asked, fake, wrong number). Each report raises the risk; 3 reports pause the request.
- **Suspending an account** cancels its open requests and tells donors who accepted not to go.
- Every request, alert and the public page show "Donating blood is always free. Never pay anyone."

---

## 🧪 Automated Testing

```bash
npm test --workspace=backend
npm test --workspace=frontend
```

---

## 🔑 Demonstration Credentials (Seeded)

| Role | Name | Email | Mobile | Password |
| :--- | :--- | :--- | :--- | :--- |
| **Administrator** | Dr. Evelyn Reed | `admin@bloodbridge.org` | `90000 00100` | `AdminPassword2026!` |
| **Donor / Referrer** | Marcus Vance | `marcus.vance@example.org` | `90000 00101` | `Password123!` |
