# BloodBridge Implementation Plan — Frontend Architecture

**Application Name:** BloodBridge  
**Tagline:** “Be a Donor. Be a Savior.”  
**Scope:** 100% Frontend Only (Strictly decoupled, ready for backend API integration)

---

## 1. Architectural Strategy & Design Principles

1. **Strict Separation of Concerns:**
   - Domain Types & DTOs (`src/types/`)
   - Service Contracts / Interfaces (`src/services/adapters/contracts.ts`)
   - Pluggable Adapters:
     - `services/adapters/mock/*` (Rich in-memory reactive state with realistic simulated latency)
     - `services/adapters/http/*` (Production-ready typed fetch adapter pointing to `VITE_API_BASE_URL`)
   - Centralized Configuration (`src/constants/config.ts`) selecting adapter via `VITE_APP_MODE` (`demo` | `api`)
   - UI components never make direct `fetch()` calls or touch raw database schemas.

2. **Healthcare Aesthetic & Design Tokens:**
   - Primary Red: `#B91C2C`
   - Dark Red: `#8F1724`
   - Light Background: `#F7F8FA`
   - Main Ink: `#20252B`
   - Secondary Ink: `#69717D`
   - Border: `#E6E8EC`
   - Success: `#18794E`, Warning: `#A15C07`, Error: `#B42318`
   - Accessible touch targets (>= 44px), WCAG 2.2 AA contrast compliance, zero horizontal overflows.

3. **Responsive Viewport Target Matrix:**
   - Mobile: 320px, 360px, 375px, 390px, 430px (Single-column, bottom navigation, responsive cards, safe-area inset)
   - Tablet: 768px, 1024px (Balanced two-column, adaptive navigation)
   - Desktop: 1280px, 1440px, 1920px (Sidebar, multi-column forms, data tables, metrics charts)

---

## 2. Directory Structure

```text
src/
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   ├── guards.tsx
│   └── providers.tsx
├── components/
│   ├── ui/ (Button, Input, Select, Checkbox, Badge, Modal, Card, Table, Pagination, Skeleton, DemoBanner, StatCard, EmptyState, ErrorBanner)
│   ├── navigation/ (PublicNavbar, PublicFooter, UserNavbar, UserBottomNav, AdminSidebar, AdminHeader, Breadcrumbs)
│   ├── feedback/ (ConfirmDialog)
│   ├── donors/
│   ├── referrals/
│   └── admin/
├── layouts/
│   ├── PublicLayout.tsx
│   ├── AuthLayout.tsx
│   ├── UserLayout.tsx
│   └── AdminLayout.tsx
├── pages/
│   ├── public/ (LandingPage, AboutPage, PrivacyPage, TermsPage)
│   ├── auth/ (WelcomePage, LoginPage, RegisterPage, VerifyOtpPage, ForgotPasswordPage, ResetPasswordPage)
│   ├── app/ (DonorDashboardPage, MyDonorsPage, DonorDetailsPage, ReferralCenterPage, ShareReferralPage, NotificationsPage, ProfilePage, EditProfilePage, PrivacySettingsPage, SettingsPage, HelpSupportPage)
│   ├── registration/ (ReferralLandingPage, DonorRegistrationPage, RegistrationReviewPage, RegistrationSuccessPage)
│   ├── admin/ (AdminLoginPage, AdminDashboardPage, AdminUsersPage, AdminDonorsPage, AdminReferralsPage, AdminConsentsPage, AdminAuditLogsPage, AdminSettingsPage)
│   └── errors/ (NotFoundPage, UnauthorizedPage)
├── services/
│   ├── api/ (client.ts, endpoints.ts)
│   ├── adapters/
│   │   ├── contracts.ts
│   │   ├── mock/ (mockStore.ts, mockData.ts, mockAuthService.ts, mockDonorService.ts, mockReferralService.ts, mockAdminService.ts, mockNotificationService.ts, mockConsentService.ts, mockSupportService.ts)
│   │   └── http/ (httpAuthService.ts, httpDonorService.ts, httpReferralService.ts, httpAdminService.ts, httpNotificationService.ts, httpConsentService.ts, httpSupportService.ts)
│   └── index.ts
├── hooks/ (useAuth.tsx, useServices.ts, useDebounce.ts)
├── schemas/ (authSchemas.ts, donorSchemas.ts, supportSchemas.ts)
├── types/ (auth.ts, donor.ts, referral.ts, notification.ts, consent.ts, admin.ts, api.ts, index.ts)
├── constants/ (bloodGroups.ts, locations.ts, config.ts)
└── utils/ (formatters.ts, validation.ts)
```

---

## 3. Milestones & Phases

- [x] **Phase 1: Environment & Tooling Verification** (Vite, React, TS, Tailwind CSS, Lucide, React Hook Form, Zod, TanStack Query, Recharts, Vitest)
- [x] **Phase 2: Types, Schemas, & Service Contracts** (All 8 service contracts + DTOs)
- [x] **Phase 3: Mock Adapter & In-Memory Store** (Realistic, fictional demo data + dynamic reactive operations)
- [x] **Phase 4: Design System & Core UI Components** (Buttons, Cards, Inputs, Modals, Badges, Banners, Navbars)
- [x] **Phase 5: Layouts & Routing Hierarchy** (Public, Auth, Donor App with mobile bottom bar, Admin with sidebar)
- [x] **Phase 6: Public & Auth Screens** (Landing, About, Privacy, Terms, Welcome, Login, Register, OTP, Forgot, Reset)
- [x] **Phase 7: Referral Registration Flow** (`/join/:code`, Register, Review, Success)
- [x] **Phase 8: Donor Application Screens** (Dashboard, My Donors, Donor Details, Referral Center, Share, Notifications, Profile, Edit, Privacy Settings, Settings, Help)
- [x] **Phase 9: Admin Dashboard Screens** (Overview, Users, Donors, Referrals, Consents, Audit Logs, Settings)
- [x] **Phase 10: Testing, Verification, Responsive Polish & Documentation** (Vitest test suite 22/22, `README.md`, `API_INTEGRATION.md`, `.env.example`, `TASKS.md`, Production build verified)
