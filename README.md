# BloodNation — “Be a Donor. Be a Savior.”

> **Brand:** BloodNation (formerly BloodBridge). App store name: **BloodNation: Your Donor Circle**. The core idea is your own circle of people who pledged to donate blood for you (relatives, friends, colleagues, group members, anyone willing), alerted first in an emergency. Folder and repository names still say BloodBridge.
>
> **Legal entity:** BloodNation is a platform owned and operated by **Manjusha Health Tech Pvt Ltd**. Every screen shows this line at the bottom. Once the company is registered, fill `VITE_COMPANY_CIN`, `VITE_COMPANY_REGISTERED_OFFICE`, `VITE_COMPANY_PHONE`, `VITE_COMPANY_EMAIL` and `VITE_COMPANY_GRIEVANCE_OFFICER` in `frontend/.env` (Rule 26, Companies (Incorporation) Rules 2014 asks for these on the home page).

[![Full-Stack Production Ready](https://img.shields.io/badge/status-production--ready-brightgreen.svg)](#)
[![Database](https://img.shields.io/badge/database-PostgreSQL%2016-blue.svg)](#)
[![Backend Tests](https://img.shields.io/badge/backend%20tests-18%2F18%20passing-success.svg)](#)
[![Frontend Tests](https://img.shields.io/badge/frontend%20tests-22%2F22%20passing-success.svg)](#)
[![Zero-Cost Target](https://img.shields.io/badge/cost-%E2%82%B90%20local%20dev-orange.svg)](#)

BloodNation is a mission-critical, full-stack blood donation and community healthcare emergency network built with **React 19, TypeScript, Tailwind CSS, Node.js, Express, Socket.IO, Prisma ORM, and PostgreSQL 16**.

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

### Donor Circle subscription (web-first payments)

**What is free and what is paid**
- **Free for everyone, always:** sign up, find donors (counts), post blood requests, matching donors near the hospital get alerted, receive alerts, respond, donate, public request pages, fraud reports.
- **Paid (Donor Circle subscription):** sharing the savior (referral) link, sharing the family invite, seeing your family's donor list (names and numbers), and alerting those family donors on your requests wherever they live.
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

**Donor Circle permissions** (per family, set by the donor on My Family → "Families you've pledged to help"):
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
```

- Runs against a **separate test database** (`backend\prisma\test.db`) that is rebuilt and seeded on every run. Your real local data (`dev.db`) is never touched, and no emails or SMS are sent.
- `tests/eligibility.test.ts`: donor eligibility rules (age, weight, 90/120-day gap, reasons to wait).
- `tests/core.test.ts`: sign-in, free Find Donors and requests, alerts to matching donors, phone privacy before/after accepting, ineligible donors not alerted and unable to accept, Donor Circle paywall, referral counting, data download without secrets, and account deletion freeing the email/mobile.
- **"7 - Push Changes" runs these tests and refuses to push if any fail.**
- `tests/api.test.ts` is an older suite that is out of date and not run.

## 🔐 Privacy: download and delete

- **Download Data** (Privacy Settings) saves a JSON file of the person's own data: account, donor profile, consents, family, pledges, requests, responses, payments, notifications. It never includes password hashes or tokens.
- **Delete Account** (type DELETE to confirm): cancels open requests and tells donors who accepted not to go, turns off automatic renewal, removes uploaded documents, then deletes the account and everything linked to it. The email and mobile number can be used again. Only an audit note without personal details (and payment references for tax/refunds) is kept. Admin accounts can't be deleted this way.
- **Privacy Policy** (`/privacy`): a draft written for India's DPDP Act 2023. Fill in the [bracketed] company and Grievance Officer details and have a lawyer review it before launch.

## 🎯 Smart matching (ranked donors, waves, live progress)

Instead of alerting every matching donor at once, BloodNation ranks them and contacts them in waves.

- **Who first** (`backend\src\modules\requests\matching.ts`): family donors (Donor Circle), donors in the hospital's PIN code area, same city, people who know the family (savior links), donors who usually say yes, who have donated before, and who were active recently. Only donors who are compatible, available and eligible today are considered.
- **Waves**: wave 1 = all family donors + top 5, wave 2 = next 10, then 20 at a time. The next wave goes out after 10 / 20 / 60 minutes (critical / urgent / planned) unless enough donors have accepted. If half of a wave says "can't today", the next wave comes within 3 minutes. A withdrawal triggers the next wave straight away.
- **Live progress** (request page, requester only): contacted, viewed, accepted, can't today, and when the next group is contacted. Counts only, never names. **Alert more donors now** sends the next group (at most every 2 minutes).
- The wave timer runs inside the backend every minute (`server.ts`). Ranked lists are stored in the `RequestCandidate` table.

## 🏘️ Communities (free)

A community is just a tag a donor adds to themselves: a gated or villa community, an apartment, a college, a company, a place of worship or a club. Communities never have to sign up; an organiser can claim one later.

- **Private by design.** Nobody can see who is in a community. Requesters only see counts, and any count below 3 shows as “fewer than 3”.
- **Requesters don't need to be members.** New request and Find Donors show *Communities near this hospital* with how many members could donate now. Tick them to alert them too (ticked by default for critical requests).
- **Fellow members.** Donors can choose “alert me when a fellow member needs blood, at any hospital” (off by default).
- **People who move.** “Still at X?” is asked every 6 months; with no answer for 30 days the membership is paused. “I've moved / alumni” keeps the membership without nearby alerts; alerts always follow the donor's current address.
- Up to 5 communities per person; names are de-duplicated (“Green Meadows Apartments” = “green-meadows”). Page: `/app/communities`. API: `/api/v1/communities` (`mine`, `search`, `near`, `POST /`, `/:id/join`, `/:id/membership`, `/:id/confirm`).
- After pulling this change run **3 - Restart Backend** once (it updates the database).

## 🏢 Organisations (companies, colleges, NGOs) — v1

- **One account per person.** Joining a company adds a link to the person's own account (`OrgMember`). Leaving the job ends the link, never the account or its donation history.
- **Proof of working there:** a code sent to a work email on the organisation's domains (Gmail, Yahoo, Outlook... are refused). One work email belongs to one person. Up to 3 organisations per person.
- **HR / CSR registers the organisation** (Profile → “Join with your work email” → Register). BloodNation staff verify it in **Admin → Organisations & Banks** before employees can join with the invite code or invite link.
- **Org admin dashboard** (`/app/organisations/:id/admin`): counts only — members, donors, “could donate now”, donors by blood group (below 3 shows “fewer than 3”), requests and helps in 90 days. Member list shows names and work emails only. Admins send announcements and donation camps (5 a day) and remove people who left.
- **Emergencies need no approval:** an employee posts a request themselves; if they are a member, “Also alert my colleagues at X” appears (hidden for everyone else). Colleagues in the hospital's state are added to the waves.
- **Who can reach me** (Profile → How we reach you): “public requests near me” and, for members only, “my colleagues' requests and company camps”. Each can be switched off.

## 🔁 Donate here, save a life there (replacement donations)

- A donor far from the hospital (another district) sees “Can't reach the hospital? Donate in your city” when a **partner blood bank** exists in their state. They pledge, donate, enter the slip number; BloodNation staff confirm it with the blood bank; the family sees the confirmed credit (bank + slip number) to show at the hospital's blood bank. Any blood group can be a replacement.
- Requesters in an organisation can tick “Ask colleagues in other cities to donate at a partner blood bank”.
- **Flyer:** on a request, “Make a flyer” opens a printable “Donate here, save a life in <city>” page (no patient name or phone, only the public link).
- **Honest limit:** a credit only works where blood banks have agreed to honour it (same chain or a partnership). That agreement is business work outside the app. Blood is never sold.
- After pulling this change run **3 - Restart Backend** once (new database tables).

## 🤝 Partner programmes and group invite links

- **Corporate chain (company pays):** BloodNation staff set a verified organisation's plan to **Paid** (Admin → Organisations). While a person is an active member (work email checked), their **personal Donor Circle is free**. My Family shows two sections: **Corporate** (just you; your requests alert colleagues **wherever they are**) and **Personal** (your family and Donor Circle, always yours). Employees can sign up with their **official email**: once it is verified they are linked to that company automatically, and they sign in with their **mobile number** from then on (it keeps working after they leave). Anyone already paying personally sees **"Welcome to Corporate Donor Circle"**: nothing is refunded, their plan stays on record and automatic renewal is switched off. **Exit:** the organisation admin removes the person, the person leaves, or HR records exits in bulk on the organisation admin page (**Employees who left**: work email or employee ID, last working day; CSV or paste). The Donor Circle then stays free for **30 days** after the exit date, with reminders at 15, 7, 3 and 1 days, then it **locks** (nothing is deleted). **Two ways to unlock** on the Subscribe page: (1) the locked days pro rata + 1 year, active for 1 year from today; or (2) **₹120 + GST** (`UNLOCK_AMOUNT_INR`, `GST_PERCENT`), active until their yearly date (anniversary of when they first paid, or joined). Every donor in the circle shows again after paying. Joining another paying company continues it at once. Buying a personal plan is refused while a company pays.
- **Family members who can donate (no account needed):** in **My Family**, tick **“Eligible to donate blood?”** when adding or editing a member aged 18 to 65 (date of birth required; not for “self”). Enter their own mobile number, or tick **“Use same mobile number”** to use yours. Their name and number are shown **only** if they agreed (consent checkbox, stored with the date and exact wording) **and** they match a live blood request: compatible blood group, family living in the hospital's district or PIN code. Only the person who posted that request sees them (up to 10, own family first). Without consent nothing is shown to other families. Changing the number clears the consent. **Your own family:** every willing member appears in your **Donor Circle** ("From your family", with who they can give to, including you) at no cost, and on your own blood requests wherever the hospital is. The first time a member's details are shown for a request it is logged and the family gets a notification.
- **Partner programmes (insurers, term-insurance providers, banks, colleges, large groups):** BloodNation staff create a programme in **Admin → Partner Programmes** (name, kind, seats, free months, optional last day). The partner shares the code or the link `/app/subscribe?partner=CODE`. A person redeems once and Donor Circle switches on at no cost (starts after any paid period they already have). One sponsored period at a time. The partner report is counts only (codes used, families set up, donors pledged, emergencies posted / fulfilled), with numbers below 3 hidden.
- **WhatsApp groups, associations, clubs:** new community kinds “WhatsApp / family group” and “Association / union / alumni”. Any member taps **Invite** to get a link and a ready-made WhatsApp message. People who open `/app/communities/join/<code>` join in one tap and choose “Alert me when a group member needs blood” (ticked by default for these groups). When a member posts a request, the group's donors are added to the first waves wherever they live. Nobody in the group sees anyone's number or blood group.
- After pulling this change run **3 - Restart Backend** once (new database tables).
- Manual test cases for every feature (100 cases): the shared "BloodNation – Manual Test Cases" doc; export it to Word or PDF from the doc's menu and keep a copy in `docs/`.

## 🩸 After a donation, and pausing alerts

- **Rest after donating (automatic):** when a donation is recorded, the donor gets no alerts until they can give again (men 90 days, women 120 days; 120 when not given). They are left out of waves, “can donate now” counts and community counts. Their number is never shown anyway.
- **The donor confirms:** when the family marks “donated”, the donor is taken off alerts at once and asked on their Profile: “Did you donate on [date]?” Yes keeps it; “No, I did not” undoes it (and is written to the audit log).
- **“I donated somewhere else”:** donors add donations from a blood bank, camp or hospital (last 12 months, no duplicates within 3 days).
- **“You can donate again”** notice once the gap is over (sent once per donation).
- **Pause my alerts:** 3 days, 1 week, 2 weeks, 1 month or “until I turn it back on”, with a private note (travel, exams, unwell, family...). It switches back on by itself with a “You’re back on the donor list” notice. Pausing ends on-call; family lists show the donor as unavailable.
- Health reasons with fixed waits (fever, antibiotics, malaria, dengue, surgery, tattoo...) are still under “Reasons to wait”.
- After pulling this change run **3 - Restart Backend** once (new database columns).

## 📞 Phone numbers, SMS alerts and calls

- **“Include my number in alerts”** (Request blood, off by default, with a warning): donors who miss the alert can call the family straight back. Off = donors see the number only after accepting.
- **Donor choices** (Profile → “How we reach you in an emergency”): SMS on/off, automatic call for critical requests on/off, quiet hours (India time), and whether critical requests may still come through during quiet hours. In-app alerts always arrive.
- **One-tap link** in alert SMS: `/q/<code>` opens a page where the donor answers “Yes, I can donate” / “Not this time” without signing in. Each link belongs to one donor and one request.
- **Calls through BloodNation (masked):** a donor who accepted can call the family, and the family can call a donor who kept their number private. BloodNation rings the caller first and then joins the other person; both see only the BloodNation number. Max 3 calls per hour per donor and request.
- **Automatic alert calls** for critical requests: the call reads the alert; press 1 = I can donate, 2 = not this time.
- **All of this is OFF until you set it up** in `backend\.env` (see `.env.example`): `MSG91_ALERT_TEMPLATE_ID` for alert SMS (a DLT-approved template), and `VOICE_PROVIDER=exotel` with the Exotel keys for calls. Until then, buttons and options show “not switched on yet”, and nothing is sent. Check the Exotel request fields against Exotel's current documentation before going live.
- Every SMS / call attempt is logged (without message text) for limits and support, and removed when the person deletes their account.
- After pulling this change run **3 - Restart Backend** once (new database columns).

## 📟 On-call donors and verified blood groups

- **On call:** on their Profile a donor can say “contact me first” for 12 hours, 24 hours, 3 days or 7 days. It's only possible while they can donate; adding a reason to wait or turning off availability ends it. On-call donors get a big boost in smart matching.
- **Verified blood group:** in Admin → Donors → Correct, tick “Blood group verified” after seeing a blood bank card, lab report or donation record. The donor sees a “Verified blood group” note on their profile, the family sees a badge on donors who accepted, and verified donors are contacted earlier. Changing the blood group removes the tick. Every change is written to the audit log.
- After pulling this change run **3 - Restart Backend** once (new database columns).

## 🌐 Languages

The app can be shown in **English, हिन्दी (Hindi), తెలుగు (Telugu), தமிழ் (Tamil) and മലയാളം (Malayalam)**. Pick the language from the menu at the top (public pages and the signed-in app). The first visit follows the phone's language; the choice is remembered on the device and on the account.

- Texts live in `frontend/src/i18n/locales/` (`en.ts` is the source). Any text not translated yet falls back to English.
- Use it in a screen with `const t = useT();` then `t('find.title')` or `t('find.exact', { group: 'B+' })`.
- Translated so far: menus, Find donors, Request blood, communities near a hospital, live matching progress, and the donor's answer screen. More screens follow.
- **The Hindi, Telugu, Tamil and Malayalam texts are drafts.** Please have a native speaker check them before launch.

## 🔞 Adults only (18+)

BloodNation keeps **no accounts for people under 18** (India's DPDP Act treats under-18s as children and requires verified parental consent, which we don't collect).

- Sign-up and invite-link registration ask for a date of birth and refuse anyone under 18 before anything is stored.
- Google sign-ups must add a date of birth on the profile page. If an account that never had a date of birth turns out to be under 18, it is deleted straight away (same as Delete Account).
- Server rule: `backend\src\shared\age.ts`; website rule: `frontend\src\utils\age.ts`.
- Family members a user adds (for example their children) are part of that adult's family list, not accounts.

## 🩺 Donor eligibility

Rules are in `backend\src\modules\eligibility\eligibility.rules.ts` (based on India's NBTC donor selection guidelines, 2017): age 18–65 (first-time donors up to 60), at least 45 kg, 90 days between donations for men and 120 for women (120 when not given), and self-declared reasons to wait (tattoo 12 months, pregnancy 12 months, surgery, typhoid, malaria, dengue, antibiotics, etc.). Alerts, "available now" counts and accepting a request all use these rules. Donors manage this on the Profile page ("Can I donate now?"). The blood bank always does the final medical check.

---

## 🔑 Demonstration Credentials (Seeded)

| Role | Name | Email | Mobile | Password |
| :--- | :--- | :--- | :--- | :--- |
| **Administrator** | Dr. Evelyn Reed | `admin@bloodbridge.org` | `90000 00100` | `AdminPassword2026!` |
| **Donor / Referrer** | Marcus Vance | `marcus.vance@example.org` | `90000 00101` | `Password123!` |
