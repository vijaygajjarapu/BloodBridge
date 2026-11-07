# BloodBridge Security & Compliance Specification

## 1. Zero-Knowledge Contact Masking

Blood donor phone numbers and personal contact information represent protected healthcare data.

### Privacy Enforcement Rules
1. **Masking by Default:** Any query for donor information by unapproved parties returns phone numbers masked with bullet glyphs (`+1 (555) •••-4819`).
2. **Authorization Boundary:** Full raw phone numbers are revealed ONLY if:
   - Requester is an administrator (`role: "admin"`).
   - Requester is viewing their own profile (`req.user.userId === profile.userId`).
   - Requester is the verified referrer AND the donor explicitly opted in (`contact_sharing` consent granted).
3. **No Blind Trust:** Contact authorization is evaluated exclusively in the backend service layer (`DonorService.getDonorById`), never trusted to frontend components.

---

## 2. Cryptographic Standards

- **Password Hashing:** Passwords are hashed using scrypt with 16-byte cryptographically secure random salts and memory-hard parameterization (`N=16384, r=8, p=1`).
- **Timing-Safe Equality:** Password verification employs `crypto.timingSafeEqual` to eliminate side-channel timing attacks.
- **OTP Storage:** Email OTP values are never stored in plaintext. Challenges store only SHA-256 token hashes.
- **Password Reset Tokens:** Single-use reset tokens are hashed before storage in `password_reset_tokens`. Tokens expire automatically after 15 minutes.
- **JWT Protection:** Signed with HS256, verified against strict issuer (`bloodbridge-api`) and audience (`bloodbridge-app`) requirements.

---

## 3. GDPR & Consent Compliance

- **Explicit Opt-In:** All consent checkboxes on registration forms are strictly unselected by default. Pre-checked consent is prohibited.
- **Granular Purposes:** Consent is segregated into discrete purposes (`contact_sharing`, `emergency_broadcast`, `sms_alerts`, `terms_and_privacy`).
- **Right to Erasure & Deactivation:** `/api/v1/profile/delete` and `/api/v1/profile/export` support GDPR compliance for user data rights.
- **Immutable Audit Trail:** All administrative status modifications and consent revocations are written to an append-only `AuditLog` table.

---

## 4. API & Network Defense

- **Helmet:** Sets `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, and `Strict-Transport-Security`.
- **CORS:** Restricts cross-origin requests to configured trusted origins (`FRONTEND_URL`).
- **Rate Limiting:**
  - Authentication routes: 30 requests per 15 minutes (`authLimiter`).
  - General API routes: 300 requests per minute (`apiLimiter`).
- **Input Validation:** Every incoming endpoint payload is validated using Zod schemas to reject injection and malformed inputs.
