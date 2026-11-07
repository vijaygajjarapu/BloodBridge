# BloodBridge — “Be a Donor. Be a Savior.”

BloodBridge is a responsive, production-quality **frontend-only blood donation web application** built with React, Vite, TypeScript, and Tailwind CSS.

It features complete workflows for public outreach, referral-based donor registration, a donor management dashboard, and an isolated administrator operations portal. The entire architecture is decoupled from backend specifics using an Anti-Corruption Layer (ACL) with pluggable typed service contracts.

---

## 🌟 Key Capabilities

1. **34 Full Screens Implemented:**
   - **Public Pages (4):** Landing with Hero & How-It-Works (`/`), About (`/about`), Privacy Policy (`/privacy`), Terms of Service (`/terms`).
   - **Authentication (6):** Onboarding Welcome (`/auth/welcome`), Login with show/hide password (`/auth/login`), Registration (`/auth/register`), Simulated 6-digit OTP verification (`/auth/verify-otp`), Forgot Password (`/auth/forgot-password`), Reset Password (`/auth/reset-password`).
   - **Referral Onboarding Flow (4):** Referral Validation Landing (`/join/:referralCode`), Donor Registration with Cascading Geography & Non-Preselected Consent (`/join/:referralCode/register`), Registration Review (`/join/:referralCode/review`), Registration Success Confirmation (`/join/success`).
   - **Donor Application (11):** Personalized Dashboard with metrics (`/app/dashboard`), My Donors with search, antigen filters, and responsive mobile cards / desktop table (`/app/donors`), Donor Details with authorization-gated contact masking (`/app/donors/:id`), Referral Center with metrics and live link generators (`/app/referrals`), Share Invitation Hub (`/app/referrals/share`), Notifications (`/app/notifications`), Profile View (`/app/profile`), Profile Editor (`/app/profile/edit`), Privacy & Consent Settings (`/app/settings/privacy`), Account Settings (`/app/settings`), Help & Support with Ticket Submission (`/app/help`).
   - **Administrator Console (8):** Dedicated Admin Login (`/admin/login`), Executive Overview with Recharts trends & antigen breakdown (`/admin/dashboard`), User Management with status toggles (`/admin/users`), Donor Registry with corrective workflows (`/admin/donors`), Referral Management (`/admin/referrals`), Consent & GDPR Audit (`/admin/consents`), Immutable Administrative Audit Logs (`/admin/audit-logs`), Platform Settings (`/admin/settings`).
   - **Error Screens (2):** 404 Not Found (`*`) and 403 Forbidden (`/unauthorized`).

2. **Strict Privacy & Contact Masking:**
   - Raw donor phone numbers are **never exposed** unless explicitly authorized by the service layer (`canAccessContact: true`).
   - Registration consent checkboxes are **strictly unselected by default** to ensure compliance with privacy regulations.
   - All OTP verifications and simulation notices explicitly inform users that no real SMS transmission occurred.

3. **Pluggable Architecture (Mock ⇄ Live API):**
   - Built on strict TypeScript service interfaces (`AuthService`, `DonorService`, `ReferralService`, `NotificationService`, `ProfileService`, `ConsentService`, `AdminService`, `SupportService`).
   - Preconfigured with an in-memory **Mock Adapter** (`src/services/adapters/mock/`) with realistic simulated latency and dynamic state.
   - Ready-to-connect **HTTP Adapter** (`src/services/adapters/http/`) with centralized client, request timeouts, and error normalization.
   - Simply toggle `VITE_APP_MODE=api` in `.env` to connect to a live backend.

4. **Multi-Device Responsive Design:**
   - Works seamlessly across Mobile (320px–430px), Tablet (768px–1024px), and Desktop (1280px–1920px).
   - Mobile includes an intuitive bottom navigation bar (`UserBottomNav`), touch-friendly targets (≥ 44×44 CSS pixels), safe-bottom padding, and card layouts instead of overflowing tables.
   - Desktop offers a spacious sidebar, responsive data tables, metrics cards, and interactive charts.

---

## 🛠 Technology Stack

- **Core Framework:** React 19, Vite, TypeScript
- **Styling:** Tailwind CSS v3, PostCSS, Custom Healthcare Design Tokens (`#B91C2C` Primary Red, `#8F1724` Dark Red, `#F7F8FA` Light Surface, `#20252B` Main Ink)
- **Routing:** React Router DOM (v7)
- **Icons:** Lucide React
- **Forms & Validation:** React Hook Form + Zod
- **Server State Readiness:** TanStack Query (v5)
- **Visual Analytics:** Recharts
- **Testing:** Vitest + React Testing Library + `@testing-library/jest-dom`

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18.0.0 or later recommended)
- npm (v9.0.0 or later)

### Installation
Clone the repository and install dependencies:
```bash
cd bftd
npm install
```

### Running Locally in Development Mode
Start the Vite development server:
```bash
npm run dev
```
Open your browser at [http://localhost:5173/](http://localhost:5173/).

### Running Automated Tests
Run unit, component, privacy, and flow tests with Vitest:
```bash
npm test -- --run
```

### Type Checking & Production Build
Validate TypeScript types and compile the optimized production bundle:
```bash
npm run build
```
Preview the built application:
```bash
npm run preview
```

---

## 🎭 Demo Mode Identities

The application runs in **Demo Mode** by default (`VITE_APP_MODE=demo`), featuring simulated authentication, donor networks, and administrative audit trails.

A persistent **Demo Mode banner** at the top of the application allows one-click switching between test identities:

| Role | Name | Email | Password | Details |
| :--- | :--- | :--- | :--- | :--- |
| **Donor / Referrer** | Marcus Vance | `marcus.vance@example.org` | Any (e.g. `password123`) | Referral Code: `SAVIOR-MV2026`, active donor network |
| **Administrator** | Dr. Evelyn Reed | `admin@bloodbridge.org` | Any (e.g. `admin123`) | Complete access to `/admin/*` management portals |

---

## 🧭 Route Directory

```text
Public:
  /                        Landing Page
  /about                   About BloodBridge
  /privacy                 Privacy Policy & Consent Notice
  /terms                   Terms of Service

Authentication:
  /auth/welcome            Onboarding Walkthrough
  /auth/login              Sign In
  /auth/register           Sign Up
  /auth/verify-otp         Simulated 6-digit OTP verification
  /auth/forgot-password    Forgot Password
  /auth/reset-password     Reset Password

Referral Onboarding:
  /join/:referralCode           Referral Verification Page
  /join/:referralCode/register  Donor Enrollment Form
  /join/:referralCode/review    Enrollment Summary & Review
  /join/success                 Enrollment Confirmation

Donor Application:
  /app/dashboard           Personalized Activity Hub
  /app/donors              My Donors Registry (Filter & Search)
  /app/donors/:id          Donor Detail & Privacy Check
  /app/referrals           Referral Statistics & Code
  /app/referrals/share     Invitation Sharing Hub
  /app/notifications       User Notification Center
  /app/profile             Profile Overview
  /app/profile/edit        Profile Information Editor
  /app/settings/privacy    Privacy & Consent Controls
  /app/settings            Account & Alert Preferences
  /app/help                Help Center & Support Ticket

Administrator Console:
  /admin/login             Admin Access Portal
  /admin/dashboard         Metrics & Trend Visualizations
  /admin/users             User Account Governance
  /admin/donors            Comprehensive Donor Registry
  /admin/referrals         Referral Code Oversight
  /admin/consents          Consent Audit & Compliance
  /admin/audit-logs        Administrative Action Log
  /admin/settings          Platform Configuration
```

---

## 🔌 Backend Integration

To connect an independently developed backend API:
1. Refer to [API_INTEGRATION.md](./API_INTEGRATION.md) for full REST endpoints, request/response DTO schemas, and error shapes.
2. Set environment variables in `.env`:
   ```env
   VITE_APP_MODE=api
   VITE_API_BASE_URL=https://api.yourdomain.org/api/v1
   ```
3. Restart the dev server or rebuild.
