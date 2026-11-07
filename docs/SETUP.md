# BloodBridge Local Development Setup Guide

> **Target:** ₹0 Additional Cost | Local PostgreSQL Database | Windows/Linux/macOS

---

## 1. Prerequisites

- **Node.js:** v18.0.0 or later (v22 recommended)
- **npm:** v9.0.0 or later
- **PostgreSQL 16:** Local instance running on port 5432

---

## 2. Setting Up the Local PostgreSQL Database (Zero-Cost, Portable)

For Windows machines without administrator installation privileges:
1. Portable binaries are stored in `C:\Users\varsh\pgsql`.
2. Start the local server:
   ```powershell
   & "C:\Users\varsh\pgsql\bin\pg_ctl.exe" -D "C:\Users\varsh\pgsql\data" -l "C:\Users\varsh\pgsql\server.log" start
   ```
3. Database `bloodbridge` is created with user `postgres` on port `5432`.

Connection string:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bloodbridge?schema=public"
```

---

## 3. Environment Configuration

### Backend (`backend/.env`)
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bloodbridge?schema=public"

JWT_SECRET="replace-with-a-long-random-secret"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# Gmail SMTP: use your own Gmail address and a 16-letter app password (Google Account > Security > App passwords)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your.address@gmail.com"
SMTP_PASS="your-16-letter-app-password"
SMTP_FROM="your.address@gmail.com"
SMTP_FROM_NAME="BloodBridge — Be a Donor. Be a Savior."

EMAIL_OTP_TTL_SECONDS=300
EMAIL_OTP_MAX_ATTEMPTS=5
EMAIL_OTP_RESEND_COOLDOWN_SECONDS=60
PASSWORD_RESET_TTL_SECONDS=900

GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK_URL="http://localhost:5000/api/v1/auth/google/callback"
FRONTEND_URL="http://localhost:5173"
```

### Frontend (`frontend/.env`)
```env
VITE_APP_MODE=api
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

---

## 4. Running Database Migrations & Seeds

```bash
# Push Prisma schema to PostgreSQL
npm run db:push --workspace=backend

# Seed verified administrator and sample donor network
npm run prisma:seed --workspace=backend
```

---

## 5. Running the Application

### Start Backend API Server
```bash
npm run dev --workspace=backend
# Runs on http://localhost:5000
```

### Start Frontend Dev Server
```bash
npm run dev --workspace=frontend
# Runs on http://localhost:5173
```

### Or Run Both Concurrently
```bash
npm run dev:all
```

---

## 6. Running Automated Tests

```bash
# Run backend API integration tests (Supertest + Vitest against live PostgreSQL)
npm test --workspace=backend

# Run frontend component, unit, and privacy tests (Vitest)
npm test --workspace=frontend
```

---

## 7. Default Credentials (Seeded)

| Role | Name | Email | Password | Details |
| :--- | :--- | :--- | :--- | :--- |
| **Administrator** | Dr. Evelyn Reed | `admin@bloodbridge.org` | `admin123` | Full `/admin/*` operations |
| **Donor / Referrer** | Marcus Vance | `marcus.vance@example.org` | `password123` | Referral Code: `SAVIOR-MV2026` |
