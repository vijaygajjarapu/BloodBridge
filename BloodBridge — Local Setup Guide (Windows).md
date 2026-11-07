# BloodBridge — Local Setup Guide (Windows)

Nov 6, 2026 · @Vijay

## Overview

BloodBridge runs locally with two processes: a backend API on **http://localhost:5000** and a website on **http://localhost:5173**. No database server is needed: the backend stores data in a single SQLite file (`backend\dev.db`).

| Part | Stack | Folder | Port |
| --- | --- | --- | --- |
| Website | React 19, Vite 8, Tailwind CSS | `frontend` | 5173 |
| Backend API | Node.js, Express, Socket.IO, Prisma 5 | `backend` | 5000 |
| Database | SQLite file via Prisma | `backend\dev.db` | none |

The repository is an npm workspace: one `npm install` at the repository root installs packages for both parts. This guide was written from a working setup on Windows 10 with PowerShell.

## Prerequisites

You need Node.js and Git. PostgreSQL is **not** needed, even though the project README mentions PostgreSQL 16: the Prisma schema is set to SQLite.

| Tool | Version | Check with |
| --- | --- | --- |
| Node.js | 22.12 or newer (tested on 24.19) | `node -v` |
| npm | comes with Node.js | `npm -v` |
| Git | any recent | `git --version` |

About 1 GB of free disk space covers the packages. Any modern browser works.

## Get the code

Open PowerShell in the folder where you keep projects and clone the repository:

```powershell
git clone https://github.com/MedhaSriVarsha/BloodBr.git
cd BloodBr
```

Every command below starts from this `BloodBr` folder unless it says otherwise.

## Quick start (one double-click)

The `launch` folder holds Windows scripts that do every step in the next section for you. These scripts exist only in the original local copy (`F:\BloodBr\launch`) and are **not in the Git repository yet**, so copy the folder into your clone or ask for it to be committed.

| Script | What it does |
| --- | --- |
| `2 - Start Full App.cmd` | Stops old BloodBridge windows, installs packages, writes both `.env` files, prepares and seeds the database, opens the backend in a second window, then starts the website and opens the browser |
| `1 - Start Demo.cmd` | Starts only the website with built-in sample data; no backend or database |
| `3 - Restart Backend.cmd` | Stops and restarts only the backend API |

Each run writes a log file (for example `start-full-213536.log`) into the `launch` folder. Keep both black windows open while you use the app; closing them stops it.

## Manual setup, step by step

These are the exact commands the launch script runs. Use two PowerShell windows: one for the backend, one for the website.

**1. Install packages (repository root, once).** Run this at the root only, never inside `frontend` or `backend` (see Troubleshooting).

```powershell
npm install --no-audit --no-fund
```

**2. Create `backend\.env`.** Create this file in the `backend` folder. Replace the JWT secret with any random string of 32+ characters. The SMTP lines point at a dummy local address on purpose, so no real emails are sent.

```
PORT=5000
NODE_ENV=development
DATABASE_URL="file:./dev.db"
JWT_SECRET="replace-with-a-long-random-string"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"
SMTP_HOST="localhost"
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER="dev@localhost"
SMTP_PASS="dev"
SMTP_FROM="dev@localhost"
SMTP_FROM_NAME="BloodBridge (local)"
EMAIL_OTP_TTL_SECONDS=300
EMAIL_OTP_MAX_ATTEMPTS=5
EMAIL_OTP_RESEND_COOLDOWN_SECONDS=60
PASSWORD_RESET_TTL_SECONDS=900
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK_URL="http://localhost:5000/api/v1/auth/google/callback"
FRONTEND_URL="http://localhost:5173"
```

**3. Prepare the database (once).** This creates `backend\dev.db`, builds the tables and adds the sample users and donors.

```powershell
cd backend
npx prisma generate
npx prisma db push --skip-generate
npm run prisma:seed
```

**4. Start the backend (window 1).** Leave this window open. Check http://localhost:5000/health in a browser; it should report healthy.

```powershell
cd backend
npm run dev
```

**5. Create `frontend\.env`.** Using `/api/v1` sends API calls through the website's own address; Vite forwards them to port 5000 (see `vite.config.ts`).

```
VITE_APP_MODE=api
VITE_API_BASE_URL=/api/v1
```

**6. Start the website (window 2).** The browser opens at http://localhost:5173.

```powershell
cd frontend
npx vite --open
```

The root `npm run dev` script joins two commands with `&`, which does not run them side by side in PowerShell, so start the two windows separately as above.

## Logging in

Sign-in checks the password, then emails a 6-digit code that must be typed in. With the dummy email settings above, the password check works but the code never arrives, so you cannot finish signing in yet.

Seeded test accounts (from `backend\prisma\seed.ts`; the README's `admin123` / `password123` are out of date). The two buttons under **Quick test credentials** on the sign-in page fill these in.

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@bloodbridge.org | AdminPassword2026! |
| Donor | marcus.vance@example.org | Password123! |

To receive real codes:

1. Use your own Gmail account with 2-Step Verification on, and create an App Password in your Google account settings.
2. In `backend\.env`, set `SMTP_HOST="smtp.gmail.com"`, `SMTP_PORT=587`, and put your Gmail address in `SMTP_USER` and `SMTP_FROM` and the App Password in `SMTP_PASS`.
3. Restart the backend.
4. Codes go to the account's own email, and the seeded addresses are not real inboxes, so register a new account with an email you can read using **Sign Up**.

Never commit `backend\.env`; it is already in `.gitignore`.

## Demo mode (no backend)

Demo mode runs the website with built-in sample data and needs no backend, database or email. It is the fastest way to click through all the screens.

1. Set `frontend\.env` to `VITE_APP_MODE=demo`.
2. Run `npm install` at the root (if not done yet), then `cd frontend` and `npx vite --open`.
3. Sign in with the quick test credential buttons; when asked for a code, any 6 digits (for example 123456) are accepted in demo mode.

Switch back to `VITE_APP_MODE=api` and restart the website to use the real backend.

## Troubleshooting

These are the problems hit during the first setup, with what fixed each one.

| Symptom | Cause | Fix |
| --- | --- | --- |
| `npm ci` fails with `EUSAGE` at the root | The original clone had no root `package-lock.json` | Use `npm install` at the root (it creates the lock file) |
| Backend crashes: `Cannot find module ...tsx\dist\preflight.cjs`, or `npx prisma` says `could not determine executable to run` | `npm ci` / `npm install` was run inside `frontend` or `backend`, which rewrote the shared root `node_modules` and removed backend packages | Run `npm install` at the root again, then `npx prisma generate` in `backend` |
| `EPERM: operation not permitted, unlink ...query_engine-windows.dll.node` | The running backend locks the Prisma engine file | Stop the backend window, then install again |
| Sign-in page shows **Failed to fetch** | The browser blocked direct calls from port 5173 to port 5000 | Set `VITE_API_BASE_URL=/api/v1` in `frontend\.env` and restart the website |
| Port 5000 or 5173 already in use | An earlier backend or website window is still running | Close the old windows, or run `Get-NetTCPConnection -LocalPort 5000` to find the process and end it |
| Sign-in code never arrives | Email is pointed at a dummy server | See **Logging in** |

Two messages are harmless and can be ignored: `npm warn allow-scripts ... esbuild`, and the Prisma notice offering an update to version 8. Do not upgrade Prisma; the project is written for version 5.

## Security note

The repository contains a real Gmail App Password for `CPETORG1@gmail.com`, in `docs\SETUP.md` and as a fallback default in `backend\src\config\index.ts`. If `SMTP_PASS` is ever left empty, the backend uses that account to send email.

- [ ] Account owner cancels that App Password in the Google account
- [ ] Remove the password and address from `docs\SETUP.md` and `backend\src\config\index.ts`
- [ ] Keep real SMTP settings only in each developer's own `backend\.env`

The local setup in this guide never uses that account, because `backend\.env` sets its own SMTP values.
