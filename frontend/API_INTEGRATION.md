# BloodBridge API Integration Guide

This guide documents the technical contracts, schemas, security standards, and conventions required for a backend engineering team to integrate their API services seamlessly with the BloodBridge frontend application.

The frontend has been built with an **Anti-Corruption Layer (ACL)**: pages and components interact exclusively with typed TypeScript service interfaces, never with raw `fetch` calls or backend database entities.

---

## 1. Architecture & Adapter Model

The application includes two swappable service adapter implementations adhering to identical contracts defined in `src/services/adapters/contracts.ts`:

- **Mock Adapter (`src/services/adapters/mock/`)**: Active during prototype/demo mode. Uses an in-memory reactive store (`mockStore.ts`) with realistic simulated latency and seeded demonstration records.
- **HTTP Adapter (`src/services/adapters/http/`)**: Connects to your backend REST API using the centralized client (`src/services/api/client.ts`).

### Switching to Live Backend API

To switch the frontend to communicate with your backend API:

1. Update your `.env` file (or deployment environment variables):
   ```env
   VITE_APP_MODE=api
   VITE_API_BASE_URL=https://api.yourdomain.org/api/v1
   ```
2. Re-run or build the application:
   ```bash
   npm run dev
   # or
   npm run build
   ```

No React components, pages, forms, or routing structures need to be modified.

---

## 2. Global HTTP Conventions

### Base URL
All endpoint paths documented below are relative to `VITE_API_BASE_URL` (e.g., `https://api.yourdomain.org/api/v1`).

### Authentication Header
For protected endpoints, the frontend sends a standard Bearer token in the `Authorization` header:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```
The token is automatically attached by `src/services/api/client.ts` via the `tokenStorage` utility.

### Request / Response Content-Type
- Requests: `Content-Type: application/json`
- Responses: `Content-Type: application/json`

### Pagination Structure
Paginated responses must conform to the `PaginatedResult<T>` structure:
```json
{
  "items": [ ... ],
  "total": 142,
  "page": 1,
  "pageSize": 10,
  "totalPages": 15
}
```

### Standardized Error Format
When an operation fails (4xx / 5xx), the backend must return a JSON response matching the `ApiError` contract:
```json
{
  "code": "VALIDATION_FAILED",
  "message": "The submitted donor profile failed validation checks.",
  "fieldErrors": {
    "bloodGroup": "Invalid blood antigen type specified",
    "mobileNumber": "Mobile number must be a valid 10-digit format"
  },
  "requestId": "req_88f9a2e37c1"
}
```

Common error codes:
- `UNAUTHORIZED`: Invalid, missing, or expired credentials (frontend redirects to login or clears session).
- `FORBIDDEN`: User lacks administrative or operational privileges.
- `NOT_FOUND`: Requested donor, user, or referral code does not exist.
- `VALIDATION_FAILED`: Request payload contains errors; `fieldErrors` maps field names to user-friendly error messages.
- `CONFLICT`: Resource already exists (e.g., duplicate phone number or email).
- `REFERRAL_EXPIRED`: The provided referral invitation link has lapsed or been revoked.

---

## 3. Critical Privacy & Contact Masking Rules

> **MANDATORY SECURITY REQUIREMENT**:  
> Contact numbers of blood donors must **never** be exposed indiscriminately.  
> The backend authorization layer must evaluate whether the requesting user is allowed to access the donor's raw emergency telephone number.

1. **Permission Flag:** The `DonorDetails` DTO includes a boolean field:
   ```ts
   canAccessContact: boolean;
   ```
2. **Masking:** If `canAccessContact` is `false`, the backend must mask or omit `mobileNumber` in the response:
   ```json
   {
     "id": "dn_001",
     "fullName": "Sarah Jenkins",
     "bloodGroup": "O-",
     "mobileNumber": "+1 (555) •••-4819",
     "canAccessContact": false,
     "contactUnavailableReason": "Direct contact details require verified coordinator authorization or an active emergency request dispatch."
   }
   ```
3. **Explicit Consent:** Registration requires explicit opt-in for contact sharing (`contactConsent: true`). Consent must **never be assumed or pre-selected**.

---

## 4. REST Endpoints Specification

### A. Authentication (`AuthService`)

| Method | Endpoint | Description | Protected |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Authenticate with email/mobile and password | No |
| `POST` | `/auth/register` | Register new user account | No |
| `POST` | `/auth/verify-otp` | Verify 6-digit one-time passcode | No |
| `POST` | `/auth/forgot-password` | Request password reset instructions | No |
| `POST` | `/auth/reset-password` | Reset password using token | No |
| `GET` | `/auth/me` | Fetch authenticated user session profile | Yes |
| `POST` | `/auth/logout` | Revoke session/token | Yes |

#### Login Request Payload
```json
{
  "identifier": "user@example.com",
  "password": "SecurePassword123!"
}
```

#### Login Success Response
```json
{
  "user": {
    "id": "usr_01",
    "name": "Marcus Vance",
    "email": "marcus.vance@example.org",
    "phone": "+1 555-019-2831",
    "role": "donor",
    "verified": true,
    "createdAt": "2026-01-15T08:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### B. Donors (`DonorService`)

| Method | Endpoint | Description | Protected |
| :--- | :--- | :--- | :--- |
| `GET` | `/donors/my-network` | Get paginated list of donors registered via user's referrals | Yes |
| `GET` | `/donors/:id` | Get detailed donor profile (with consent check) | Yes |
| `POST` | `/donors/register` | Register a new donor via referral code | No |
| `POST` | `/donors/:id/report` | Report inaccurate or outdated donor information | Yes |

#### Query Parameters for `/donors/my-network`
- `search`: string (filters by full name or city)
- `bloodGroup`: string (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`)
- `status`: string (`active`, `pending`, `inactive`)
- `availability`: string (`available`, `busy`, `deferred`)
- `page`: integer (default: 1)
- `pageSize`: integer (default: 10)
- `sortBy`: string (`createdAt`, `fullName`, `bloodGroup`)
- `sortOrder`: `asc` | `desc`

#### Donor Registration Request Payload (`POST /donors/register`)
```json
{
  "referralCode": "SAVIOR-MV2026",
  "fullName": "Elena Rostova",
  "mobileNumber": "+1 555-892-4112",
  "email": "elena.rostova@example.org",
  "bloodGroup": "B+",
  "state": "California",
  "district": "Los Angeles County",
  "city": "Santa Monica",
  "donationWillingness": "regular",
  "contactConsent": true,
  "privacyAcknowledged": true,
  "termsAccepted": true
}
```

---

### C. Referrals (`ReferralService`)

| Method | Endpoint | Description | Protected |
| :--- | :--- | :--- | :--- |
| `GET` | `/referrals/my-code` | Retrieve current user's referral code and share URL | Yes |
| `GET` | `/referrals/stats` | Retrieve referral metrics & recent registrations | Yes |
| `GET` | `/referrals/validate/:code` | Validate referral code for onboarding landing page | No |

#### Validation Response (`GET /referrals/validate/:code`)
```json
{
  "valid": true,
  "code": "SAVIOR-MV2026",
  "referrerName": "Marcus Vance",
  "message": "Invitation confirmed. You were invited by Marcus Vance."
}
```

---

### D. Notifications (`NotificationService`)

| Method | Endpoint | Description | Protected |
| :--- | :--- | :--- | :--- |
| `GET` | `/notifications` | List notifications for the authenticated user | Yes |
| `PATCH` | `/notifications/:id/read` | Mark a specific notification as read | Yes |
| `POST` | `/notifications/read-all` | Mark all notifications as read | Yes |

---

### E. User Profile & Settings (`ProfileService`)

| Method | Endpoint | Description | Protected |
| :--- | :--- | :--- | :--- |
| `GET` | `/profile` | Fetch authenticated user's complete profile | Yes |
| `PUT` | `/profile` | Update profile information | Yes |
| `PUT` | `/profile/settings` | Update preferences (email alerts, SMS alerts, dark mode) | Yes |
| `POST` | `/profile/export` | Request copy of personal data (GDPR / privacy compliance) | Yes |
| `DELETE` | `/profile` | Request account deactivation/deletion | Yes |

---

### F. Privacy & Consent Registry (`ConsentService`)

| Method | Endpoint | Description | Protected |
| :--- | :--- | :--- | :--- |
| `GET` | `/consents/status` | Current consent preferences for contact sharing | Yes |
| `GET` | `/consents/history` | Audit log of past consent grants and revocations | Yes |
| `POST` | `/consents/update` | Update contact sharing and willingness preferences | Yes |

---

### G. Administrator Console (`AdminService`)

> Requires user role `admin`.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/admin/dashboard` | Aggregated system metrics, registration trends & activity |
| `GET` | `/admin/users` | Paginated user management list with role/status filters |
| `PATCH` | `/admin/users/:id/status` | Update account status (`active`, `suspended`, `pending`) |
| `GET` | `/admin/donors` | Comprehensive donor registry with antigen & location filters |
| `PATCH` | `/admin/donors/:id` | Update donor verification status or details |
| `GET` | `/admin/referrals` | System-wide referral code monitoring |
| `PATCH` | `/admin/referrals/:id/toggle` | Enable or disable a referral code |
| `GET` | `/admin/consents` | Compliance consent registry and withdrawal audit log |
| `GET` | `/admin/audit-logs` | Filterable, immutable administrative audit logs |
| `GET` | `/admin/settings` | Platform operational settings |
| `PUT` | `/admin/settings` | Update platform operational settings |

#### Admin Dashboard Response Example
```json
{
  "totalUsers": 1284,
  "totalDonors": 856,
  "verifiedContacts": 792,
  "activeReferrals": 312,
  "consentsGranted": 804,
  "consentsWithdrawn": 52,
  "registrationTrends": [
    { "month": "May", "registrations": 45, "donations": 32 },
    { "month": "Jun", "registrations": 68, "donations": 51 },
    { "month": "Jul", "registrations": 94, "donations": 73 },
    { "month": "Aug", "registrations": 118, "donations": 89 },
    { "month": "Sep", "registrations": 156, "donations": 112 },
    { "month": "Oct", "registrations": 204, "donations": 145 }
  ],
  "bloodGroupDistribution": [
    { "group": "O+", "count": 284 },
    { "group": "A+", "count": 242 },
    { "group": "B+", "count": 168 },
    { "group": "AB+", "count": 62 },
    { "group": "O-", "count": 48 },
    { "group": "A-", "count": 32 },
    { "group": "B-", "count": 14 },
    { "group": "AB-", "count": 6 }
  ]
}
```

---

### H. Support (`SupportService`)

| Method | Endpoint | Description | Protected |
| :--- | :--- | :--- | :--- |
| `GET` | `/support/faqs` | Frequently asked questions list | No |
| `POST` | `/support/tickets` | Submit an issue report or inquiry ticket | Optional |

---

## 5. Summary Checklist for Backend Developers

1. [ ] Implement endpoints adhering to the path structure under `VITE_API_BASE_URL`.
2. [ ] Validate requests using the schemas described; return RFC-compliant 400 with `fieldErrors` when payload fails validation.
3. [ ] Protect `/app/*` and `/admin/*` resources with standard JWT Bearer token authentication.
4. [ ] Implement strict role-based access control (RBAC): only `admin` users can access `/admin/*` endpoints.
5. [ ] Guarantee privacy: enforce `canAccessContact` masking so raw phone numbers are never returned without authorized clearance.
6. [ ] Record all administrative operations into an append-only audit log table accessible via `GET /admin/audit-logs`.
7. [ ] Support CORS headers allowing origin of the frontend web application with credentials.
