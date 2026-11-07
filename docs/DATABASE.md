# BloodBridge PostgreSQL Database Architecture

## 1. Relational Design Principles

BloodBridge is engineered exclusively on **PostgreSQL 16** with a normalized relational schema managed via Prisma ORM.

- **Zero NoSQL Policy:** No MongoDB, Firebase, or in-memory stores are used as primary stores. PostgreSQL is the single source of truth.
- **UUID Primary Keys:** All entity primary keys use UUID strings (`@default(uuid())`) to prevent ID enumeration attacks.
- **Referential Integrity:** Foreign keys enforce explicit cascade behavior (`onDelete: Cascade` or `onDelete: SetNull`).
- **Transactional Consistency:** Critical multi-table mutations (e.g. registration with referral attribution and consent grants) execute inside `prisma.$transaction`.

---

## 2. Relational Schema Summary

| Table | Purpose | Key Indexes |
| :--- | :--- | :--- |
| `User` | Authentication identity, role, and verification status | `email` (unique), `role`, `status` |
| `DonorProfile` | Clinical blood antigen, geography, and availability | `userId` (unique), `bloodGroup`, `city`, `isAvailable` |
| `OAuthAccount` | Federated Google OpenID identity mapping | `[provider, providerSubjectId]` (unique), `userId` |
| `EmailOtpChallenge` | Cryptographically hashed one-time verification passcodes | `[email, purpose]`, `expiresAt` |
| `PasswordResetToken` | Hashed single-use password recovery tokens | `tokenHash` (unique), `userId` |
| `RefreshToken` | Rotated long-term session tokens with revocation | `tokenHash` (unique), `userId` |
| `Referral` | Invitation tracking and donor attribution | `referralCode` (unique), `referrerUserId`, `status` |
| `ConsentRecord` | GDPR compliance audit trail for contact sharing & alerts | `[userId, purpose]`, `policyVersion` |
| `Notification` | Persistent in-app notifications | `recipientId`, `isRead`, `createdAt` |
| `SupportTicket` | Clinical and technical support inquiries | `userId`, `email`, `status` |
| `AuditLog` | Append-only administrative governance log | `actorId`, `action`, `entityType`, `createdAt` |
| `OrganizationSettings` | Operational configuration (emergency lines, points) | `id` (default singleton) |

---

## 3. Database Maintenance & Seed

### Local Database Cluster Management
The local PostgreSQL 16 server is hosted portably under `C:\Users\varsh\pgsql`:
- **Start Server:**
  ```powershell
  & "C:\Users\varsh\pgsql\bin\pg_ctl.exe" -D "C:\Users\varsh\pgsql\data" -l "C:\Users\varsh\pgsql\server.log" start
  ```
- **Stop Server:**
  ```powershell
  & "C:\Users\varsh\pgsql\bin\pg_ctl.exe" -D "C:\Users\varsh\pgsql\data" stop
  ```

### Migrations & Seeding
- Push schema changes:
  ```bash
  npm run prisma:generate --workspace=backend
  npm run db:push --workspace=backend
  ```
- Seed initial data:
  ```bash
  npm run prisma:seed --workspace=backend
  ```
The seed script safely populates verified accounts for Dr. Evelyn Reed (`admin@bloodbridge.org`), Marcus Vance (`marcus.vance@example.org`), and a sample donor network.
