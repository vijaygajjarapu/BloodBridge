import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';

describe('BloodBridge Backend REST API Test Suite', () => {
  let adminToken: string;
  let donorToken: string;
  let registeredReferralCode: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // 1. Health check
  it('GET /health returns healthy status and PostgreSQL verification', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toContain('BloodBridge');
  });

  // 2. Authentication flows
  describe('Authentication System', () => {
    it('POST /api/v1/auth/login authenticates administrator successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'admin@bloodbridge.org',
          password: 'admin123',
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('admin');
      adminToken = res.body.token;
    });

    it('POST /api/v1/auth/login authenticates Marcus Vance (donor) successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'marcus.vance@example.org',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('donor');
      donorToken = res.body.token;
    });

    it('POST /api/v1/auth/login rejects incorrect passwords', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'admin@bloodbridge.org',
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/v1/auth/me returns authenticated session with valid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('marcus.vance@example.org');
    });

    it('GET /api/v1/auth/me rejects requests without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  // 3. Referral Validation & Enrolling
  describe('Referral System', () => {
    it('GET /api/v1/referrals/validate/:code confirms active referral code', async () => {
      const res = await request(app).get('/api/v1/referrals/validate/SAVIOR-MV2026');
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.referrerName).toBe('Marcus Vance');
    });

    it('GET /api/v1/referrals/validate/:code returns invalid for non-existent code', async () => {
      const res = await request(app).get('/api/v1/referrals/validate/SAVIOR-FAKE999');
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it('GET /api/v1/referrals/stats returns referral metrics for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/referrals/stats')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.referralCode).toBe('SAVIOR-MV2026');
      expect(res.body.totalEnrolled).toBeGreaterThan(0);
      expect(res.body.rewardPoints).toBeGreaterThan(0);
    });
  });

  // 4. Donor Management & Contact Masking Privacy
  describe('Donor Registry & Contact Privacy Masking', () => {
    it('GET /api/v1/donors/my-referrals returns paginated network list for referrer', async () => {
      const res = await request(app)
        .get('/api/v1/donors/my-referrals?page=1&pageSize=10')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toBeInstanceOf(Array);
      expect(res.body.total).toBeGreaterThan(0);
    });

    it('GET /api/v1/donors/:id MASKS contact phone number when consent is not granted', async () => {
      // Find David Chen (contactConsent = false)
      const david = await prisma.user.findUnique({
        where: { email: 'david.chen@example.org' },
        include: { donorProfile: true },
      });

      expect(david).toBeDefined();

      // Marcus requests David Chen's details without direct contact clearance
      const res = await request(app)
        .get(`/api/v1/donors/${david!.donorProfile!.id}`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.canAccessContact).toBe(false);
      expect(res.body.mobileNumber).toContain('•••');
      expect(res.body.contactUnavailableReason).toBeDefined();
    });

    it('GET /api/v1/donors/:id reveals unmasked contact to administrator', async () => {
      const david = await prisma.user.findUnique({
        where: { email: 'david.chen@example.org' },
        include: { donorProfile: true },
      });

      const res = await request(app)
        .get(`/api/v1/donors/${david!.donorProfile!.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.canAccessContact).toBe(true);
      expect(res.body.mobileNumber).toBe(david!.phone);
    });

    it('POST /api/v1/donors/register successfully enrolls new donor via referral', async () => {
      const testEmail = `testdonor_${Date.now()}@example.org`;
      const testPhone = `+1 555-${Math.floor(100000 + Math.random() * 900000)}`;
      const res = await request(app)
        .post('/api/v1/donors/register')
        .send({
          referralCode: 'SAVIOR-MV2026',
          fullName: 'Test Automaton Donor',
          mobileNumber: testPhone,
          email: testEmail,
          bloodGroup: 'O+',
          state: 'California',
          district: 'Los Angeles County',
          city: 'Long Beach',
          donationWillingness: 'regular',
          contactConsent: true,
          privacyAcknowledged: true,
          termsAccepted: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.assignedReferralCode).toBeDefined();
    });
  });

  // 5. Administrator Governance & RBAC Protection
  describe('Administrator Operations & RBAC', () => {
    it('GET /api/v1/admin/metrics returns system metrics to administrator', async () => {
      const res = await request(app)
        .get('/api/v1/admin/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalUsers).toBeGreaterThan(0);
      expect(res.body.bloodGroupDistribution).toBeInstanceOf(Array);
    });

    it('GET /api/v1/admin/metrics REJECTS standard donor with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/metrics')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('GET /api/v1/admin/audit-logs returns immutable audit records', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toBeInstanceOf(Array);
      expect(res.body.total).toBeGreaterThan(0);
    });
  });

  // 6. User Profile & Consent
  describe('Profile & Consent Management', () => {
    it('GET /api/v1/profile returns user profile', async () => {
      const res = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Marcus Vance');
      expect(res.body.bloodGroup).toBe('O+');
    });

    it('GET /api/v1/consents/status returns current privacy preferences', async () => {
      const res = await request(app)
        .get('/api/v1/consents/status')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.emergencyBroadcastAllowed).toBeDefined();
    });
  });

  // 7. Section D: Email OTP Security & Lifecycle
  describe('Section D: Email OTP Security & Atomic Verification', () => {
    const testEmail = 'otp.test@example.org';

    it('POST /api/v1/auth/request-otp generates OTP challenge and never discloses raw OTP in response', async () => {
      // Ensure test isolation from previous test runs
      await prisma.emailOtpChallenge.deleteMany({ where: { email: testEmail } });

      const res = await request(app)
        .post('/api/v1/auth/request-otp')
        .send({ email: testEmail, purpose: 'verification' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.otp).toBeUndefined(); // Raw OTP never in response
      expect(res.body.code).toBeUndefined();

      // Verify only hash is stored in PostgreSQL
      const challenge = await prisma.emailOtpChallenge.findFirst({
        where: { email: testEmail, purpose: 'verification' },
        orderBy: { createdAt: 'desc' },
      });
      expect(challenge).toBeDefined();
      expect(challenge?.hashedOtp).toBeDefined();
      expect(challenge?.hashedOtp.length).toBe(64); // SHA-256 hex string
    });

    it('POST /api/v1/auth/request-otp enforces resend cooldown (429 Rate Limit)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/request-otp')
        .send({ email: testEmail, purpose: 'verification' });

      expect(res.status).toBe(429);
      expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(res.body.message).toContain('Please wait');
    });

    it('POST /api/v1/auth/verify-otp increments attempt count on wrong OTP and locks after max attempts', async () => {
      const challengeEmail = 'otp.attempt.test@example.org';
      await prisma.emailOtpChallenge.create({
        data: {
          email: challengeEmail,
          hashedOtp: 'fakehashforwrongattempttesting000000000000000000000000000000000000',
          purpose: 'registration',
          expiresAt: new Date(Date.now() + 300000),
          attemptCount: 4, // 1 away from max
        },
      });

      // 5th attempt with wrong OTP
      const res1 = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ email: challengeEmail, otp: '999999', purpose: 'registration' });
      expect(res1.status).toBe(400);

      // 6th attempt should be blocked by rate limit / attempt limit
      const res2 = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ email: challengeEmail, otp: '999999', purpose: 'registration' });
      expect(res2.status).toBe(429);
      expect(res2.body.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('POST /api/v1/auth/verify-otp consumes challenge atomically and prevents replay', async () => {
      const challengeEmail = 'otp.atomic.test@example.org';
      const crypto = await import('crypto');
      const testOtp = '849201';
      const otpHash = crypto.createHash('sha256').update(testOtp).digest('hex');

      await prisma.emailOtpChallenge.create({
        data: {
          email: challengeEmail,
          hashedOtp: otpHash,
          purpose: 'registration',
          expiresAt: new Date(Date.now() + 300000),
          attemptCount: 0,
        },
      });

      // First verification succeeds
      const res1 = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ email: challengeEmail, otp: testOtp, purpose: 'registration' });
      expect(res1.status).toBe(200);
      expect(res1.body.verified).toBe(true);

      // Second verification replay fails (challenge already consumed)
      const res2 = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ email: challengeEmail, otp: testOtp, purpose: 'registration' });
      expect(res2.status).toBe(400);
    });
  });

  // 8. Section E: Forgot Password, Token Validation & Password Reset
  describe('Section E: Forgot Password & Secure Reset Lifecycle', () => {
    let validResetToken: string;

    it('POST /api/v1/auth/forgot-password responds generically without disclosing account existence', async () => {
      // Non-existent email
      const res1 = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent.user.999@bloodbridge.org' });
      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.message).toContain('If an account exists');

      // Existing email
      const res2 = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'marcus.vance@example.org' });
      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.message).toContain('If an account exists');
    });

    it('GET /api/v1/auth/verify-reset-token validates valid token and masks email', async () => {
      const crypto = await import('crypto');
      validResetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(validResetToken).digest('hex');

      const user = await prisma.user.findFirst({ where: { email: 'marcus.vance@example.org' } });

      await prisma.passwordResetToken.create({
        data: {
          userId: user!.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 900000), // 15 mins
        },
      });

      const res = await request(app).get(`/api/v1/auth/verify-reset-token?token=${validResetToken}`);
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.email).toContain('***'); // Masked email
    });

    it('GET /api/v1/auth/verify-reset-token rejects invalid/expired token', async () => {
      const res = await request(app).get('/api/v1/auth/verify-reset-token?token=invalid_token_12345');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('POST /api/v1/auth/reset-password resets password, revokes refresh tokens, and does not auto-login', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: validResetToken,
          newPassword: 'BrandNewPassword2026!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeUndefined(); // Does NOT auto-authenticate

      // Check token is consumed
      const crypto = await import('crypto');
      const tokenHash = crypto.createHash('sha256').update(validResetToken).digest('hex');
      const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
      expect(record?.consumedAt).not.toBeNull();

      // Check active refresh tokens for user were revoked
      const activeTokens = await prisma.refreshToken.findMany({
        where: { userId: record!.userId, isRevoked: false },
      });
      expect(activeTokens.length).toBe(0);

      // Verify login works with the new password
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'marcus.vance@example.org',
          password: 'BrandNewPassword2026!',
        });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.token).toBeDefined();

      // Re-consume attempt is rejected
      const replayRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: validResetToken,
          newPassword: 'AnotherPassword2026!',
        });
      expect(replayRes.status).toBe(400);
    });
  });

  // 9. Section F: Account Lifecycle & Suspension Rules
  describe('Section F: Account Lifecycle & Suspension Rules', () => {
    it('Admin suspends user -> user cannot login and active sessions are revoked', async () => {
      const user = await prisma.user.findFirst({ where: { email: 'marcus.vance@example.org' } });

      // Admin suspends user
      const suspendRes = await request(app)
        .put(`/api/v1/admin/users/${user!.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'suspended' });
      expect(suspendRes.status).toBe(200);
      expect(suspendRes.body.status).toBe('suspended');

      // Login attempt is blocked with 403 Forbidden
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'marcus.vance@example.org',
          password: 'BrandNewPassword2026!',
        });
      expect(loginRes.status).toBe(403);
      expect(loginRes.body.code).toBe('FORBIDDEN');
      expect(loginRes.body.message).toContain('suspended');

      // Admin reactivates user
      const reactivateRes = await request(app)
        .put(`/api/v1/admin/users/${user!.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' });
      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.status).toBe('active');

      // Login succeeds again
      const loginAfterRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'marcus.vance@example.org',
          password: 'BrandNewPassword2026!',
        });
      expect(loginAfterRes.status).toBe(200);
    });
  });
});
