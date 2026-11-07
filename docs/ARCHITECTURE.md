# BloodBridge Architecture Documentation

> **Application Name:** BloodBridge  
> **Tagline:** “Be a Donor. Be a Savior.”  
> **Target:** Production-Ready Full-Stack Healthcare Platform  
> **Database:** PostgreSQL (Strictly Relational)

---

## 1. System Topology Overview

```
                      +---------------------------------------+
                      |       Client Browsers & Devices       |
                      |  Mobile (320-430px) | Desktop (1920)  |
                      +-------------------+-------------------+
                                          |
                        HTTPS (REST API)  |  WSS (Socket.IO)
                                          v
                      +---------------------------------------+
                      |         Node.js / Express API         |
                      |  - Helmet & CORS Security             |
                      |  - JWT Bearer Authentication          |
                      |  - Role-Based Access Control (RBAC)   |
                      |  - Zod Request Validation             |
                      |  - Rate Limiting (express-rate-limit) |
                      +-------------------+-------------------+
                                          |
                      +-------------------+-------------------+
                      |      Prisma ORM & Connection Pool     |
                      +-------------------+-------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |         PostgreSQL 16 Database        |
                      |  - ACID Relational Transactions       |
                      |  - Explicit Constraints & Foreign Keys|
                      |  - Optimized Indexes (B-Tree)         |
                      +---------------------------------------+
```

---

## 2. Directory & Component Boundaries

The BloodBridge platform is divided into two distinct, decoupled packages:

### Frontend (`frontend/`)
- **React 19, TypeScript, Tailwind CSS v3**: Modern reactive UI with healthcare aesthetic tokens (`#B91C2C`, `#8F1724`, `#F7F8FA`).
- **Anti-Corruption Layer (ACL)**: UI components interact exclusively with typed TypeScript service interfaces (`src/services/adapters/contracts.ts`), never with raw backend database models.
- **Pluggable Adapters**:
  - `HttpAdapter` (`src/services/adapters/http/*`): Connects to live Express API via centralized client (`src/services/api/client.ts`).
  - `MockAdapter` (`src/services/adapters/mock/*`): In-memory reactive state for demonstration and offline development.
- **Mode Switching**: Toggled via `VITE_APP_MODE=api|demo` in `.env`.

### Backend (`backend/`)
- **Express.js with Node.js & TypeScript**: Modular architecture divided into domain-specific modules:
  - `auth`: Registration, login, OTP verification, password recovery.
  - `donors`: Referral-based registration, network listing, contact privacy masking.
  - `referrals`: Invitation code generation, validation, and analytics.
  - `consent`: GDPR compliance, explicit contact sharing opt-in, audit log.
  - `notifications`: In-app persistent alerts with real-time Socket.IO dispatch.
  - `admin`: Platform metrics, user governance, donor registry, audit trail.
  - `support`: Ticket management and medical FAQs.
  - `oauth`: Google OAuth 2.0 and OpenID Connect with account-linking protection.
- **Socket.IO Real-Time Engine**: Attached to the same HTTP server instance, utilizing authenticated handshakes and server-controlled private rooms (`user:<id>`, `admin:operations`).
- **Prisma ORM**: Type-safe query builder and database client mapped to PostgreSQL.

---

## 3. Data Flow & Security Boundaries

1. **Client Request**: Frontend sends Bearer JWT in `Authorization` header.
2. **Authentication Middleware**: `authenticate` extracts and verifies JWT against `JWT_SECRET`. Attaches `req.user` to request.
3. **Role Authorization**: `requireAdmin` blocks non-admin users from accessing `/api/v1/admin/*` with HTTP 403 Forbidden.
4. **Validation Layer**: Zod middleware validates request payload before controller execution. Returns RFC-compliant 400 Bad Request with granular `fieldErrors` on failure.
5. **Privacy Clearance**: `DonorService.getDonorById` evaluates donor's `contact_sharing` consent and requester identity. If unapproved, raw phone numbers are masked using zero-knowledge masking (`+1 (555) •••-4819`).
6. **Real-Time Dispatch**: On critical mutations (e.g. new donor enrolled via referral), transactional database writes commit first, followed by Socket.IO event emission to the referrer's private room.
