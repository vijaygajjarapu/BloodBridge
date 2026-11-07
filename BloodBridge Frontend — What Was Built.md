# BloodBridge Frontend — What Was Built

Nov 6, 2026 · @Vijay

## Summary

The BloodBridge frontend is a complete, clickable web app built around **one idea: donors join only by referral invitation and control who sees their phone number**. It has 36 routes and 36 screen files across a public site, sign-in, a referral sign-up flow, a donor app and an admin portal.

| Measure | Value |
| --- | --- |
| Routes | 36 (4 public, 4 referral, 7 sign-in, 11 donor app, 8 admin, 2 error) |
| Screen files | 36 in `src/pages`, about 7,600 lines |
| Service areas | 8: auth, donors, referrals, notifications, profile, consent, admin, support |
| Run modes | Demo (in-browser sample data) and API (live backend), switched by `VITE_APP_MODE` |
| Automated tests | 22 (Vitest), per the project's own task list |
| Target region in content | United States (California, Texas, New York, Illinois, Washington; +1 phone numbers) |

What it does **not** have: emergency blood requests, a donor search for people in need, memberships or payments, family and allies, real-time updates, Google sign-in on screen, or any Indian locations. Details are in **Gaps and issues** at the end.

## Architecture

Screens never call the network directly: each goes through one of 8 service contracts, and a single setting decides whether those use sample data or the real backend.

&#91;embedded content: frontend layers · demo and live modes\]

Stack: React 19, TypeScript, Vite 8, Tailwind CSS 3, React Router 7, React Hook Form + Zod, Recharts, Lucide icons. TanStack Query is set up in `providers.tsx` but no screen uses it yet; screens load data with plain `useEffect` calls.

## Screens and routes

Every route from `src/app/router.tsx`. "Signed in" means a donor or admin session; "Admin" means the role must be admin, otherwise the guard sends the user to `/admin/login`.

| Area | Route | Screen | Who can open it |
| --- | --- | --- | --- |
| Public | `/` | Landing page | Anyone |
| Public | `/about` | About | Anyone |
| Public | `/privacy` | Privacy policy | Anyone |
| Public | `/terms` | Terms of use | Anyone |
| Referral | `/join/:referralCode` | Invitation landing (checks the code) | Anyone |
| Referral | `/join/:referralCode/register` | Donor registration form | Anyone with a valid code |
| Referral | `/join/:referralCode/review` | Review before submit | Anyone with a valid code |
| Referral | `/join/success` | Registration success | Anyone |
| Sign-in | `/auth`, `/auth/login` | Sign-in (tabbed page: Sign In, Sign Up, Referral) | Anyone |
| Sign-in | `/auth/register` | Same tabbed page, Sign Up tab | Anyone |
| Sign-in | `/auth/welcome` | Welcome | Anyone |
| Sign-in | `/auth/verify-otp` | Enter 6-digit email code | Anyone |
| Sign-in | `/auth/forgot-password` | Forgot password | Anyone |
| Sign-in | `/auth/reset-password` | Set new password from a reset link | Anyone |
| Donor app | `/app/dashboard` | Donor dashboard | Signed in |
| Donor app | `/app/donors` | My donors (people I referred) | Signed in |
| Donor app | `/app/donors/:id` | Donor details | Signed in |
| Donor app | `/app/referrals` | Referral center | Signed in |
| Donor app | `/app/referrals/share` | Share my referral link | Signed in |
| Donor app | `/app/notifications` | Notifications | Signed in |
| Donor app | `/app/profile` | My profile | Signed in |
| Donor app | `/app/profile/edit` | Edit profile | Signed in |
| Donor app | `/app/settings` | Settings | Signed in |
| Donor app | `/app/settings/privacy` | Privacy and consent | Signed in |
| Donor app | `/app/help` | Help and support | Signed in |
| Admin | `/admin/login` | Admin sign-in | Anyone |
| Admin | `/admin/dashboard` | Overview metrics and charts | Admin |
| Admin | `/admin/users` | Users | Admin |
| Admin | `/admin/donors` | Donors | Admin |
| Admin | `/admin/referrals` | Referral codes | Admin |
| Admin | `/admin/consents` | Consent records | Admin |
| Admin | `/admin/audit-logs` | Audit log | Admin |
| Admin | `/admin/settings` | Organization settings | Admin |
| Error | `/unauthorized` | Not allowed | Anyone |
| Error | any other path | Page not found | Anyone |

## Features by area

### Public site

- Landing page: "Be a Donor. Be a Savior." hero, a sample invitation card (referral code `SAVIOR-MV2026`), a 3-step "how it works", and privacy promises.
- About, Privacy policy (consent, referral security, data rights, no selling data) and Terms (5 sections).

### Sign-in and sign-up

- One tabbed page (992 lines) with **Sign In**, **Sign Up** and **Referral** tabs; `/auth/login` and `/auth/register` both open it.
- Sign in: email + password, then a 6-digit code sent by email (**Sign In & Send OTP**). Two quick-fill buttons for the test donor and admin.
- Sign up: username, date of birth, email, password, confirm password, optional referral code.
- Referral tab: paste an invitation link or code from the clipboard.
- Verify code, forgot password (mobile or email), reset password from a token link with expired-link handling.

### Referral registration

- `/join/:code` checks the code and shows who invited you; expired and revoked codes get their own messages.
- Registration form: name, mobile, optional email, blood group, willingness to donate, state → district → city, and a contact-sharing consent box that is never pre-ticked.
- Review screen, then success screen with a copy-link button.

### Donor app

- **Dashboard:** urgent shortage banner; 4 cards (circle donors, active saviors, invites shared, emergency readiness); my referral link; recent registrations in my circle.
- **My donors:** list of people I referred, with search by name, city or blood type and paging.
- **Donor details:** the phone number is masked unless that donor consented to share it; "report incorrect information" form.
- **Referral center:** 4 stats (successful registrations, active ready, pending screenings, invites created) and recent activity. **Share** page: copy, phone share sheet, SMS and WhatsApp.
- **Notifications:** list, mark one or all as read; checked every 20 seconds.
- **Profile and edit profile:** name, email, blood group, willingness, location, "ready for emergency dispatch" switch, contact-sharing consent.
- **Settings:** notification channels (urgent SMS, referral activity, monthly eligibility reminders) and log out.
- **Privacy and consent:** current consents, consent history, export my data, request account deletion.
- **Help:** FAQs and a support ticket form (name, email, category, subject, message).

### Admin portal

- Separate sign-in page at `/admin/login`.
- **Dashboard:** 4 cards (enrolled donors, referral sign-ups, consent rate, emergency-ready pool), a growth chart and a blood-group distribution chart.
- **Users:** search; set a user to active, suspended or pending after a confirm step; each change is written to the audit log.
- **Donors:** search by name, city or district; correct a donor record.
- **Referrals:** search codes or owners; switch a code on or off.
- **Consents:** list of consent records with withdrawal details.
- **Audit log:** filterable by record type.
- **Settings:** organization name, support email, helpline, 24/7 emergency line, privacy policy version, and switches for strict referral codes, open public sign-up and maintenance mode.

## Service layer and API contract

Each service is an interface in `src/services/adapters/contracts.ts` with two versions: a mock one (sample data in the browser) and an HTTP one (calls the backend). `src/services/index.ts` picks one per service from `VITE_APP_MODE`. All paths below sit under `/api/v1` (`src/services/api/endpoints.ts`).

| Service | What it covers | Main API paths |
| --- | --- | --- |
| Auth | Sign in with email code, sign up, sign up by referral, verify email, forgot/reset/change password, current session, log out | `/auth/signin`, `/auth/verify-login-otp`, `/auth/signup`, `/auth/signup-referral`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/me`, `/auth/logout` |
| Donors | My referred donors, one donor, register a donor, report wrong details | `/donors/my-referrals`, `/donors/:id`, `/donors/register`, `/donors/:id/report` |
| Referrals | Check a code, my referral stats, share | `/referrals/validate/:code`, `/referrals/stats`, `/referrals/share` |
| Notifications | List, mark read, mark all read | `/notifications`, `/notifications/:id/read`, `/notifications/mark-all-read` |
| Profile | View and update profile, export data, delete account | `/profile`, `/profile/export`, `/profile/delete` |
| Consent | My consent settings and history; admin list | `/profile/consent`, `/admin/consents` |
| Admin | Metrics, users, donors, referral codes, audit log, settings | `/admin/metrics`, `/admin/users`, `/admin/donors`, `/admin/referrals`, `/admin/audit-logs`, `/admin/settings` |
| Support | Submit a ticket, FAQs | `/support/inquire`, `/support/faqs` |

The HTTP client (`src/services/api/client.ts`) adds the sign-in token from `localStorage`, stops after 15 seconds and turns errors into one shape. The full request and response formats are in `frontend/API_INTEGRATION.md`. `/auth/google` is listed but no screen offers Google sign-in.

## UI components and styling

Styling is Tailwind CSS 3 with custom colour tokens: primary red `#B91C2C`, dark red `#8F1724`, light surface `#F7F8FA`, text `#20252B`. Buttons and other tap targets are at least 44 px. Layouts were checked by the original team at phone (390 × 844), tablet (768 × 1024) and desktop (1280 × 800) sizes.

| Group | Components (`src/components`) |
| --- | --- |
| Basic UI | Button (5 styles, loading state), Input (with show/hide password), Select, Checkbox, Card, Badge (blood group and status), Modal (Escape closes), Pagination, StatCard (with trend), Skeleton, EmptyState, ErrorBanner, DemoBanner (demo mode notice and account switcher) |
| Navigation | PublicNavbar (mobile drawer), PublicFooter, UserNavbar (desktop), UserBottomNav (phone), AdminSidebar, AdminHeader, Breadcrumbs |
| Feedback | ConfirmDialog |

Shared constants: 8 blood groups with who can give to and receive from whom (`bloodGroups.ts`), and a state → district → city list (`locations.ts`, US only). There is one language (English) and no dark mode.

## Tests

There are 22 Vitest tests in `src/test`. All of them run against the demo (mock) services, never the real backend: `config.ts` forces demo mode during tests. I read the tests but did not run them.

| File | Tests | What they check |
| --- | --- | --- |
| `components.test.tsx` | 8 | Button size and loading, Input labels and errors, password show/hide, Checkbox, badges, Modal closes on Escape, EmptyState |
| `referralFlow.test.tsx` | 5 | Valid, expired and revoked codes; consent box not pre-ticked; a new donor appears in the referrer's list |
| `privacy.test.tsx` | 4 | Phone masked without consent, shown with consent, consent withdrawal recorded, unknown donor gives an error |
| `admin.test.tsx` | 4 | Overview metrics, user search, status change written to the audit log, switching a referral code |
| `sanity.test.ts` | 1 | Test runner works |

Run them with `npm test --workspace=frontend` from the repository root.

## Gaps and issues

### Problems in the current code

| Issue | Where | Why it matters |
| --- | --- | --- |
| Sign-in accepts easy shared passwords (`password`, `password123`, `admin`, and others) for any donor and for the admin | `backend/src/modules/auth/auth.service.ts`, lines 42–55 | Anyone can sign in as any donor; must go before real use |
| Real Gmail App Password in the code | `backend/src/config/index.ts`, `docs/SETUP.md` | Account can be misused; must be cancelled and removed |
| Test account quick-fill buttons on the live sign-in page | `AuthLandingPage.tsx` | Shows working credentials to every visitor |
| Sign-in token stored in `localStorage` | `httpAuthService.ts` | Readable by any script injected into the page |
| No real-time updates: notifications are checked every 20 seconds | `useNotifications.tsx` | Backend Socket.IO alerts never reach the screen |
| TanStack Query installed but unused | `providers.tsx` | No caching or retry; each screen reloads its own data |
| Two product names | Sign-in page says "BloodConnect", rest says "BloodBridge" | Inconsistent brand |
| Out-of-date credentials in READMEs | `README.md`, `docs/SETUP.md`, `frontend/README.md` | Testers try passwords that only work through the shortcut above |
| Forgot password says "mobile or email", but codes go only by email | `ForgotPasswordPage.tsx` | No SMS or phone sign-in exists |

### Not built yet

- Emergency blood requests (raise, track, close) and matching donors to a request.
- Finding donors by blood group and place for someone in need; the app only lists people you referred.
- Memberships, payments or referral rewards.
- Family members or trusted contacts beyond the referral circle.
- Indian content: states, districts, +91 numbers, ₹, local languages.
- Google sign-in on screen, maps, an installable app (PWA) or native mobile apps.

These are the starting points for the Blood Nation enhancements you will list next.
