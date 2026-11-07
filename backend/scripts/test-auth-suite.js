import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Reverse sha256 for 6 digit OTP (100000 - 999999)
function findOtpForHash(targetHash) {
  for (let i = 100000; i <= 999999; i++) {
    const code = i.toString();
    if (hashToken(code) === targetHash) {
      return code;
    }
  }
  return null;
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    passedTests++;
    console.log(`✅ PASS: ${message}`);
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('  BloodConnect Authentication System Verification Test Suite');
  console.log('======================================================\n');

  const testEmail = `donor_${Date.now()}@bloodbridge.org`;
  const testUsername = `user_${Date.now()}`;
  const testPassword = 'SecurePassword2026!';

  // SCENARIO 0: Server Health Check
  console.log('--- Step 0: Server Health Check ---');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const healthData = await healthRes.json();
  assert(healthRes.status === 200 && healthData.status === 'healthy', 'Server is online and healthy');

  // SCENARIO 3: Invalid Email and Weak Password Rejected
  console.log('\n--- Scenario 3: Invalid Email & Weak Password Validation ---');
  const invalidRegRes = await fetch(`${BASE_URL}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'ab', // too short (<3)
      dateOfBirth: '2000-01-01',
      email: 'not-an-email',
      password: '123', // weak (<8, no letters/numbers)
      confirmPassword: '456', // mismatch
    }),
  });
  assert(invalidRegRes.status === 400, 'Rejects invalid email, weak password, and password mismatch with 400');

  // SCENARIO 1: Successful Registration
  console.log('\n--- Scenario 1: Successful Registration & Verification Flow ---');
  const regRes = await fetch(`${BASE_URL}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testUsername,
      dateOfBirth: '2002-05-14', // 24 years old -> eligible donor
      email: testEmail,
      password: testPassword,
      confirmPassword: testPassword,
      termsAccepted: true,
    }),
  });
  const regData = await regRes.json();
  assert(regRes.status === 201, 'Registration returns 201 Created');
  assert(regData.requiresVerification === true, 'Registration flags requiresVerification = true');
  assert(regData.isEligibleDonor === true, 'Calculates donor eligibility (age >= 18) correctly');
  assert(!regData.token, 'No access token is issued prior to email verification');

  // SCENARIO 7: Unverified Account Cannot Complete Sign-In
  console.log('\n--- Scenario 7: Unverified Account Sign-In Blocked ---');
  const unverifiedSignInRes = await fetch(`${BASE_URL}/api/v1/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });
  const unverifiedSignInData = await unverifiedSignInRes.json();
  assert(unverifiedSignInData.requiresEmailVerification === true, 'Unverified account signin returns requiresEmailVerification = true');
  assert(!unverifiedSignInData.token, 'Unverified signin does NOT return an access token');

  // SCENARIO 2: Duplicate Email Registration Rejected
  console.log('\n--- Scenario 2: Duplicate Email Registration Handling ---');
  // First, let's verify this account so it's a verified duplicate
  const regChallenge = await prisma.emailOtpChallenge.findFirst({
    where: { email: testEmail, purpose: 'registration', consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  assert(regChallenge !== null, 'Found registration OTP challenge in database');
  const regOtpCode = findOtpForHash(regChallenge.hashedOtp);
  assert(regOtpCode !== null, `Cracked sha256 to retrieve generated OTP (${regOtpCode})`);

  // SCENARIO 6 (Part A): Invalid OTP rejected
  console.log('\n--- Scenario 6 (Part A): Invalid Verification OTP Rejected ---');
  const badOtpRes = await fetch(`${BASE_URL}/api/v1/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      code: '000000',
    }),
  });
  assert(badOtpRes.status === 400, 'Wrong verification code rejected with 400');

  // Complete email verification with correct code
  console.log('\n--- Completing Account Email Verification ---');
  const verifyRes = await fetch(`${BASE_URL}/api/v1/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      code: regOtpCode,
    }),
  });
  const verifyData = await verifyRes.json();
  assert(verifyRes.status === 200, 'Email verification succeeds with 200 OK');
  assert(verifyData.user && verifyData.user.isVerified === true, 'User is marked isVerified = true');
  assert(Boolean(verifyData.token), 'Valid access token issued upon successful verification');

  // Test duplicate email on now-verified account
  const dupRegRes = await fetch(`${BASE_URL}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `another_${Date.now()}`,
      dateOfBirth: '2001-01-01',
      email: testEmail,
      password: 'AnotherPassword123!',
      confirmPassword: 'AnotherPassword123!',
    }),
  });
  assert(dupRegRes.status === 409, 'Duplicate verified email registration rejected with 409 Conflict');

  // SCENARIO 4: Incorrect Password does NOT trigger a Login OTP
  console.log('\n--- Scenario 4: Incorrect Password Rejection (No OTP Dispatched) ---');
  const initialOtpCount = await prisma.emailOtpChallenge.count({
    where: { email: testEmail, purpose: 'login' },
  });

  const badPasswordRes = await fetch(`${BASE_URL}/api/v1/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'WrongPassword!',
    }),
  });
  assert(badPasswordRes.status === 401, 'Bad password rejected with 401 Unauthorized');

  const afterBadPassOtpCount = await prisma.emailOtpChallenge.count({
    where: { email: testEmail, purpose: 'login' },
  });
  assert(afterBadPassOtpCount === initialOtpCount, 'Incorrect password did NOT generate or dispatch any login OTP');

  // SCENARIO 5: Correct Password triggers a Login OTP (2FA challenge)
  console.log('\n--- Scenario 5: Correct Password Triggers Single-Use Login OTP ---');
  const goodSignInRes = await fetch(`${BASE_URL}/api/v1/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });
  const goodSignInData = await goodSignInRes.json();
  assert(goodSignInRes.status === 200, 'Valid credentials return 200');
  assert(goodSignInData.requiresOtp === true, 'Returns requiresOtp = true');
  assert(!goodSignInData.token, 'Zero tokens issued prior to 2FA OTP verification');

  // SCENARIO 9: Resend Cooldown (60s rate limit)
  console.log('\n--- Scenario 9: Resend Cooldown Rate Limit ---');
  const quickResendRes = await fetch(`${BASE_URL}/api/v1/auth/resend-login-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail }),
  });
  assert(quickResendRes.status === 429, 'Immediate resend within cooldown rejected with 429 Rate Limit Exceeded');

  // SCENARIO 6 (Part B): Incorrect, Expired, Excessive, and Reused OTP handling
  console.log('\n--- Scenario 6 (Part B): Login OTP Security Controls ---');
  const loginChallenge = await prisma.emailOtpChallenge.findFirst({
    where: { email: testEmail, purpose: 'login', consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  assert(loginChallenge !== null, 'Active login OTP challenge found in DB');
  const validLoginOtp = findOtpForHash(loginChallenge.hashedOtp);
  assert(validLoginOtp !== null, `Recovered login OTP from DB challenge (${validLoginOtp})`);

  // Incorrect OTP verification attempt
  const wrongLoginOtpRes = await fetch(`${BASE_URL}/api/v1/auth/verify-login-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      code: '999999',
    }),
  });
  assert(wrongLoginOtpRes.status === 400, 'Wrong login OTP rejected with 400');

  // Check attempt increment
  const updatedChallenge = await prisma.emailOtpChallenge.findUnique({
    where: { id: loginChallenge.id },
  });
  assert(updatedChallenge.attemptCount === 1, 'Attempt counter incremented to 1');

  // SCENARIO 8: Successful OTP verification grants authenticated access
  console.log('\n--- Scenario 8: Successful OTP Grants Authenticated Token ---');
  const correctLoginOtpRes = await fetch(`${BASE_URL}/api/v1/auth/verify-login-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      code: validLoginOtp,
    }),
  });
  const correctLoginOtpData = await correctLoginOtpRes.json();
  assert(correctLoginOtpRes.status === 200, 'Login OTP verification returns 200 OK');
  assert(Boolean(correctLoginOtpData.token), 'Issues valid JWT access token');
  assert(Boolean(correctLoginOtpData.refreshToken), 'Issues secure refresh token');

  const authToken = correctLoginOtpData.token;

  // Replay attempt with same consumed OTP
  console.log('\n--- Replay Protection: Reusing Consumed OTP Rejected ---');
  const replayRes = await fetch(`${BASE_URL}/api/v1/auth/verify-login-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      code: validLoginOtp,
    }),
  });
  assert(replayRes.status === 400, 'Reused single-use OTP is rejected');

  // SCENARIO 10: Logout and Protected Route (/api/v1/auth/me)
  console.log('\n--- Scenario 10: Protected Routes and Logout ---');
  const meRes = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const meData = await meRes.json();
  assert(meRes.status === 200, 'GET /api/v1/auth/me returns 200 with authenticated user');
  assert(meData.user.email === testEmail, 'User profile matches authenticated session');

  const logoutRes = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ refreshToken: correctLoginOtpData.refreshToken }),
  });
  assert(logoutRes.status === 200, 'POST /api/v1/auth/logout succeeds with 200');

  // SCENARIO 11: Existing BloodConnect Functionality Preserved
  console.log('\n--- Scenario 11: Existing BloodConnect Features Preserved ---');
  // Seeded admin signin test
  const adminSignInRes = await fetch(`${BASE_URL}/api/v1/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@bloodbridge.org',
      password: 'AdminPassword2026!',
    }),
  });
  assert(adminSignInRes.status === 200, 'Seeded admin account authenticates successfully');

  // Public referral code validation (used when a potential donor opens /join/:code)
  const referralRes = await fetch(`${BASE_URL}/api/v1/referrals/validate/SAVIOR-MV2026`);
  const referralData = await referralRes.json();
  assert(referralRes.status === 200 && referralData.valid === true, 'Existing referral validation endpoint /api/v1/referrals/validate/SAVIOR-MV2026 functional');

  console.log('\n======================================================');
  console.log(`  ALL ${passedTests}/${totalTests} INTEGRATION TEST SCENARIOS PASSED!`);
  console.log('======================================================\n');
}

runTests()
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
