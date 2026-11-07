# BloodBridge REST API Reference

Base URL: `http://localhost:5000/api/v1`

All responses are formatted in JSON. Protected endpoints require the standard header:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

---

## 1. Authentication Endpoints

### `POST /auth/login`
Authenticate existing user via email or phone with password.
- **Request Body:**
  ```json
  {
    "identifier": "marcus.vance@example.org",
    "password": "password123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "user": {
      "id": "usr_uuid",
      "name": "Marcus Vance",
      "email": "marcus.vance@example.org",
      "phone": "+1 555-019-2831",
      "role": "donor",
      "verified": true,
      "createdAt": "2026-01-15T08:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

### `POST /auth/register`
Register new account.
- **Request Body:**
  ```json
  {
    "fullName": "Jane Doe",
    "email": "jane@example.org",
    "phone": "+1 555-123-4567",
    "password": "StrongPassword123!",
    "role": "donor",
    "referralCode": "SAVIOR-MV2026",
    "termsAccepted": true
  }
  ```
- **Response (201 Created):**
  Returns authenticated user session profile and access token.

### `POST /auth/verify-otp`
Verify 6-digit email verification code.
- **Request Body:**
  ```json
  {
    "email": "jane@example.org",
    "otp": "491823",
    "purpose": "registration"
  }
  ```

### `POST /auth/forgot-password`
Request password reset link via Gmail SMTP.
- **Request Body:**
  ```json
  {
    "email": "jane@example.org"
  }
  ```

### `POST /auth/reset-password`
Set new password using secure reset token.
- **Request Body:**
  ```json
  {
    "token": "a4f89b...",
    "newPassword": "NewStrongPassword123!"
  }
  ```

### `GET /auth/me` *(Protected)*
Retrieve current authenticated user session.

### `POST /auth/logout` *(Protected)*
Revoke current refresh token and clear session.

---

## 2. Donor Management Endpoints

### `GET /donors/my-referrals` *(Protected)*
Retrieve donors enrolled through current user's referral code.
- **Query Parameters:** `search`, `bloodGroup`, `status`, `state`, `district`, `page`, `pageSize`, `sortBy`, `sortOrder`.
- **Response (200 OK):**
  ```json
  {
    "items": [
      {
        "id": "dnr_uuid",
        "fullName": "Elena Rostova",
        "bloodGroup": "B+",
        "city": "Santa Monica",
        "state": "California",
        "status": "active",
        "availability": "available",
        "lastDonation": "2026-02-01",
        "totalDonations": 4,
        "registeredAt": "2026-02-01T08:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10,
    "totalPages": 1
  }
  ```

### `GET /donors/:id` *(Authenticated / Optional)*
Retrieve donor details with contact privacy masking evaluation.
- When `canAccessContact` is `false`:
  ```json
  {
    "id": "dnr_uuid",
    "fullName": "David Chen",
    "bloodGroup": "O-",
    "city": "Pasadena",
    "mobileNumber": "+1 (555) •••-9923",
    "canAccessContact": false,
    "contactUnavailableReason": "Direct contact details require verified coordinator authorization or explicit donor contact consent."
  }
  ```

### `POST /donors/register` *(Public)*
Referral-based donor enrollment.
- **Request Body:**
  ```json
  {
    "referralCode": "SAVIOR-MV2026",
    "fullName": "Carlos Mendez",
    "mobileNumber": "+1 555-671-2290",
    "email": "carlos@example.org",
    "bloodGroup": "AB+",
    "state": "California",
    "district": "Los Angeles County",
    "city": "Glendale",
    "donationWillingness": "regular",
    "contactConsent": true,
    "privacyAcknowledged": true,
    "termsAccepted": true
  }
  ```

---

## 3. Referral Endpoints

### `GET /referrals/validate/:code` *(Public)*
Validate referral invitation link for incoming donors.
- **Response (200 OK):**
  ```json
  {
    "valid": true,
    "code": "SAVIOR-MV2026",
    "referrerName": "Marcus Vance",
    "message": "Invitation confirmed. You were invited by Marcus Vance."
  }
  ```

### `GET /referrals/stats` *(Protected)*
Retrieve current user's referral code, share URL, and network metrics.

---

## 4. Notifications Endpoints

### `GET /notifications` *(Protected)*
Retrieve up to 50 recent notifications for user.

### `PATCH /notifications/:id/read` *(Protected)*
Mark a notification as read.

### `POST /notifications/mark-all-read` *(Protected)*
Mark all user notifications as read.

---

## 5. Administration Endpoints *(Admin Role Required)*

- `GET /admin/metrics`: Executive metrics and antigen distributions.
- `GET /admin/users`: User registry with search and status filtering.
- `PATCH /admin/users/:id/status`: Suspend, activate, or update user account status.
- `GET /admin/donors`: Global registry of all registered blood donors.
- `PATCH /admin/donors/:id`: Edit and verify donor parameters.
- `GET /admin/referrals`: Platform-wide referral oversight.
- `PATCH /admin/referrals/:id/toggle`: Activate/deactivate referral code.
- `GET /admin/consents`: GDPR consent audit registry.
- `GET /admin/audit-logs`: Immutable system audit log.
- `GET /admin/settings` & `PUT /admin/settings`: Platform settings.
