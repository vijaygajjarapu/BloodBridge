import { prisma } from '../../config/database.js';
import { requireCountry, requirePhone, validateLocation, findPhoneCandidates, maskPhone } from '../../shared/location.js';
import { smsService } from '../../shared/sms.service.js';
import { hashPassword, verifyPassword, generateSecureOtp, hashToken, generateRandomToken } from '../../shared/password.js';
import { signAccessToken, signRefreshToken } from '../../shared/jwt.js';
import { emailService } from '../../shared/email.service.js';
import { parseAdultDateOfBirth } from '../../shared/age.js';
import { AppError } from '../../shared/types.js';
import { config } from '../../config/index.js';
import { logger } from '../../shared/logger.js';
import { emitToUser, emitAdminEvent } from '../../sockets/socket.server.js';
import type { LoginInput, RegisterInput, VerifyOtpInput, ForgotPasswordInput, ResetPasswordInput } from './auth.schemas.js';

/** "priya.sharma@gmail.com" -> "pr•••••••••@gmail.com" (shown when someone signs in with their phone) */
function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  return `${name.slice(0, 2)}${'•'.repeat(Math.max(3, name.length - 2))}@${domain}`;
}

export class AuthService {
  async signin(input: { email?: string; identifier?: string; password: string; ipAddress?: string }) {
    const identifier = (input.identifier || input.email || '').trim();

    if (!identifier) {
      throw new AppError('Email address or mobile number is required.', 400, 'VALIDATION_FAILED');
    }

    // An identifier with "@" is an email; otherwise try it as a mobile number (e.g. "98765 43210" -> "+919876543210")
    const isEmail = identifier.includes('@');
    const lookup = isEmail
      ? [{ email: identifier.toLowerCase() }]
      : [...findPhoneCandidates(identifier).map((phone) => ({ phone })), { username: identifier }];

    const user = await prisma.user.findFirst({
      where: { OR: lookup },
      include: {
        donorProfile: true,
      },
    });

    // Step 1 & 2: Validate credentials against existing account. If incorrect password, reject without sending login OTP
    if (!user || !user.passwordHash) {
      throw new AppError(
        user && !user.passwordHash
          ? 'This account uses Google sign-in. Please choose "Continue with Google".'
          : 'Invalid email / mobile number or password.',
        401,
        'UNAUTHORIZED',
      );
    }

    if (user.status === 'suspended') {
      throw new AppError('Your account has been suspended. Please contact support.', 403, 'FORBIDDEN');
    }

    let isMatch = await verifyPassword(input.password, user.passwordHash);

    if (!isMatch) {
      throw new AppError('Invalid email / mobile number or password.', 401, 'UNAUTHORIZED');
    }

    // Step 3: If account is not email-verified, prevent login and provide way to complete verification
    if (!user.isEmailVerified) {
      try {
        await this.sendEmailOtp(user.email, 'registration', user.id, user.username || user.fullName || undefined);
      } catch (err: any) {
        logger.debug(`Verification OTP not redispatched during signin: ${err?.message}`);
      }
      return {
        success: false,
        requiresEmailVerification: true,
        email: user.email,
        message: 'Your email address is not verified yet. Please enter the verification code sent to your email.',
      };
    }

    // Step 4: Verified members sign in with email/phone + password only (no login code).
    // Sign-up still needs the emailed code (Step 3), and the session ends after the idle timeout.
    return this.issueSession(user.id, 'Signed in successfully. Welcome back!');
  }

  /** Creates a signed-in session: short-lived access token (idle timeout) + user details */
  async issueSession(userId: string, message = 'Authentication successful. Welcome to BloodConnect!') {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User account not found.', 404, 'NOT_FOUND');
    }
    if (user.status === 'suspended') {
      throw new AppError('Your account has been suspended. Please contact support.', 403, 'FORBIDDEN');
    }

    const accessToken = signAccessToken({ userId: user.id, email: user.email, role: user.role });
    const idleSeconds = config.session.idleMinutes * 60;

    const userReferral = await prisma.referral.findFirst({
      where: { referrerUserId: user.id, status: 'active' },
      select: { referralCode: true },
    });

    return {
      success: true,
      requiresOtp: false,
      message,
      user: {
        id: user.id,
        name: user.fullName || user.username || 'Savior',
        username: user.username,
        email: user.email,
        phone: user.phone,
        country: user.country,
        role: user.role,
        referralCode: userReferral?.referralCode,
        isVerified: user.isEmailVerified,
        createdAt: user.createdAt.toISOString(),
      },
      token: accessToken,
      idleTimeoutSeconds: idleSeconds,
      expiresAt: new Date(Date.now() + idleSeconds * 1000).toISOString(),
    };
  }

  /** Called by the website while the person is active: a fresh token, so the idle clock restarts */
  async refreshSession(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'active') {
      throw new AppError('Your session has ended. Please sign in again.', 401, 'UNAUTHORIZED');
    }
    const idleSeconds = config.session.idleMinutes * 60;
    return {
      token: signAccessToken({ userId: user.id, email: user.email, role: user.role }),
      idleTimeoutSeconds: idleSeconds,
      expiresAt: new Date(Date.now() + idleSeconds * 1000).toISOString(),
    };
  }

  async verifyLoginOtp(input: { email: string; code: string }) {
    const email = input.email.toLowerCase().trim();
    const code = (input.code || '').trim();

    if (!code || code.length !== 6) {
      throw new AppError('Verification code must be exactly 6 digits.', 400, 'VALIDATION_FAILED');
    }

    const hashedOtp = hashToken(code);

    const challenge = await prisma.emailOtpChallenge.findFirst({
      where: {
        email,
        purpose: 'login',
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new AppError('No active login verification request found. Please sign in again.', 400, 'VALIDATION_FAILED');
    }

    // Expiry check
    if (challenge.expiresAt < new Date()) {
      await prisma.emailOtpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw new AppError('Verification code has expired. Please sign in again to request a new code.', 400, 'OTP_EXPIRED');
    }

    // Max attempts check (5 attempts)
    if (challenge.attemptCount >= config.otp.maxAttempts) {
      await prisma.emailOtpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw new AppError('Maximum verification attempts exceeded. For security, please sign in again.', 429, 'MAX_ATTEMPTS_EXCEEDED');
    }

    // Hash comparison
    if (challenge.hashedOtp !== hashedOtp) {
      const updated = await prisma.emailOtpChallenge.update({
        where: { id: challenge.id },
        data: { attemptCount: { increment: 1 } },
      });
      const remaining = config.otp.maxAttempts - updated.attemptCount;
      throw new AppError(`Incorrect verification code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : 'Please sign in again.'}`, 400, 'INVALID_OTP');
    }

    // Atomic consumption
    const consumption = await prisma.emailOtpChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
        verifiedAt: new Date(),
      },
    });

    if (consumption.count === 0) {
      throw new AppError('Verification code has already been consumed.', 409, 'CONFLICT');
    }

    // Retrieve user and issue tokens
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(challenge.userId ? [{ id: challenge.userId }] : []),
          { email },
        ],
      },
      include: { donorProfile: true },
    });

    if (!user) {
      throw new AppError('User account not found.', 404, 'NOT_FOUND');
    }

    return this.issueSession(user.id);
  }

  /**
   * "Login with mobile number": step 1 — send a 6-digit code for the account with this phone.
   * The code goes by SMS when an SMS provider is configured; until then it goes to the account's email.
   */
  async requestPhoneLoginOtp(input: { phone: string; ipAddress?: string }) {
    const candidates = findPhoneCandidates(input.phone || '');
    if (candidates.length === 0) {
      throw new AppError('Please enter a valid 10-digit mobile number.', 400, 'VALIDATION_FAILED', { phone: 'Please enter a valid 10-digit mobile number.' });
    }
    const user = await prisma.user.findFirst({ where: { OR: candidates.map((phone) => ({ phone })) } });
    if (!user) {
      throw new AppError('No account is registered with this mobile number. Please sign up first.', 404, 'NOT_FOUND', { phone: 'No account is registered with this mobile number. Please sign up first.' });
    }
    if (user.status === 'suspended') {
      throw new AppError('Your account has been suspended. Please contact support.', 403, 'FORBIDDEN');
    }
    if (!user.isEmailVerified) {
      throw new AppError('Please finish sign-up first: verify your email with the code we sent, then try again.', 400, 'EMAIL_NOT_VERIFIED');
    }

    const recent = await prisma.emailOtpChallenge.findFirst({
      where: {
        email: user.email,
        purpose: 'phone_login',
        createdAt: { gte: new Date(Date.now() - config.otp.resendCooldownSeconds * 1000) },
      },
    });
    if (recent && !recent.consumedAt) {
      // A code was sent moments ago and is still valid: let them enter it instead of showing an error
      const waitSeconds = Math.max(
        1,
        Math.ceil((recent.createdAt.getTime() + config.otp.resendCooldownSeconds * 1000 - Date.now()) / 1000),
      );
      const sms = smsService.isConfigured();
      return {
        success: true,
        alreadySent: true,
        deliveredVia: sms ? 'sms' : 'email',
        maskedPhone: maskPhone(user.phone!),
        maskedEmail: maskEmail(user.email),
        message: `We already sent you a code${sms ? '' : ` at ${maskEmail(user.email)}`}. Enter it below, or request a new one in ${waitSeconds}s.`,
        expiresInSeconds: config.otp.ttlSeconds,
        resendCooldownSeconds: waitSeconds,
      };
    }
    if (recent) {
      throw new AppError(`Please wait ${config.otp.resendCooldownSeconds} seconds before requesting a new code.`, 429, 'RATE_LIMIT_EXCEEDED');
    }

    await prisma.emailOtpChallenge.updateMany({
      where: { email: user.email, purpose: 'phone_login', consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const otpCode = generateSecureOtp();
    await prisma.emailOtpChallenge.create({
      data: {
        email: user.email,
        userId: user.id,
        hashedOtp: hashToken(otpCode),
        purpose: 'phone_login',
        expiresAt: new Date(Date.now() + config.otp.ttlSeconds * 1000),
        attemptCount: 0,
      },
    });

    const sentBySms = await smsService.sendLoginOtp(user.phone!, otpCode);
    if (!sentBySms) {
      await emailService.sendLoginOtpEmail(user.email, otpCode, input.ipAddress);
    }
    if (config.env === 'development') {
      logger.info(`[dev] Mobile login code for ${maskPhone(user.phone!)}: ${otpCode}`);
    }

    return {
      success: true,
      deliveredVia: sentBySms ? 'sms' : 'email',
      maskedPhone: maskPhone(user.phone!),
      maskedEmail: maskEmail(user.email),
      message: sentBySms
        ? `We sent a 6-digit code by SMS to ${maskPhone(user.phone!)}.`
        : `We sent a 6-digit code to your registered email ${maskEmail(user.email)}.`,
      expiresInSeconds: config.otp.ttlSeconds,
      resendCooldownSeconds: config.otp.resendCooldownSeconds,
    };
  }

  /** "Login with mobile number": step 2 — check the code and sign the person in */
  async verifyPhoneLoginOtp(input: { phone: string; code: string }) {
    const code = (input.code || '').trim();
    if (!/^\d{6}$/.test(code)) {
      throw new AppError('Please enter the 6-digit code.', 400, 'VALIDATION_FAILED', { code: 'Please enter the 6-digit code.' });
    }
    const candidates = findPhoneCandidates(input.phone || '');
    const user = candidates.length
      ? await prisma.user.findFirst({ where: { OR: candidates.map((phone) => ({ phone })) } })
      : null;
    if (!user) {
      throw new AppError('No account is registered with this mobile number.', 404, 'NOT_FOUND');
    }

    const challenge = await prisma.emailOtpChallenge.findFirst({
      where: { email: user.email, purpose: 'phone_login', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) {
      throw new AppError('This code is no longer active. Please request a new code.', 400, 'VALIDATION_FAILED');
    }
    if (challenge.expiresAt < new Date()) {
      await prisma.emailOtpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
      throw new AppError('This code has expired. Please request a new code.', 400, 'OTP_EXPIRED');
    }
    if (challenge.attemptCount >= config.otp.maxAttempts) {
      await prisma.emailOtpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
      throw new AppError('Too many wrong attempts. Please request a new code.', 429, 'MAX_ATTEMPTS_EXCEEDED');
    }
    if (challenge.hashedOtp !== hashToken(code)) {
      const updated = await prisma.emailOtpChallenge.update({
        where: { id: challenge.id },
        data: { attemptCount: { increment: 1 } },
      });
      const remaining = config.otp.maxAttempts - updated.attemptCount;
      const msg = remaining > 0 ? `That code is not correct. ${remaining} attempt(s) left.` : 'That code is not correct. Please request a new code.';
      throw new AppError(msg, 400, 'INVALID_OTP', { code: msg });
    }

    const consumed = await prisma.emailOtpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: new Date(), verifiedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw new AppError('This code has already been used. Please request a new code.', 409, 'CONFLICT');
    }

    return this.issueSession(user.id, 'Signed in successfully. Welcome back!');
  }

  async resendLoginOtp(input: { email: string; ipAddress?: string }) {
    const email = input.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('Account not found.', 404, 'NOT_FOUND');
    }

    if (!user.isEmailVerified) {
      throw new AppError('Account email is not verified.', 400, 'EMAIL_NOT_VERIFIED');
    }

    const recent = await prisma.emailOtpChallenge.findFirst({
      where: {
        email,
        purpose: 'login',
        createdAt: {
          gte: new Date(Date.now() - config.otp.resendCooldownSeconds * 1000),
        },
      },
    });

    if (recent) {
      throw new AppError(`Please wait ${config.otp.resendCooldownSeconds} seconds before requesting a new code.`, 429, 'RATE_LIMIT_EXCEEDED');
    }

    await prisma.emailOtpChallenge.updateMany({
      where: { email, purpose: 'login', consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const otpCode = generateSecureOtp();
    const hashedOtp = hashToken(otpCode);
    const expiresAt = new Date(Date.now() + config.otp.ttlSeconds * 1000);

    await prisma.emailOtpChallenge.create({
      data: {
        email,
        userId: user.id,
        hashedOtp,
        purpose: 'login',
        expiresAt,
        attemptCount: 0,
      },
    });

    await emailService.sendLoginOtpEmail(email, otpCode, input.ipAddress);

    return {
      success: true,
      message: 'A fresh login verification code has been dispatched to your email.',
      expiresInSeconds: config.otp.ttlSeconds,
      resendCooldownSeconds: config.otp.resendCooldownSeconds,
    };
  }

  async signup(input: {
    username: string;
    dateOfBirth: string;
    email: string;
    password: string;
    confirmPassword?: string;
    role?: string;
    referralCode?: string;
    termsAccepted?: boolean;
    phone?: string;
    country?: string;
  }) {
    const email = input.email.toLowerCase().trim();
    const username = input.username.trim();
    const country = requireCountry(input.country).code;
    const phone = requirePhone(country, input.phone);

    // Adults only: refuses anyone under 18 before anything is stored
    const birthDate = parseAdultDateOfBirth(input.dateOfBirth);

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Check duplicate email
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    // The mobile number signs people in too, so it must belong to one account only
    const phoneOwner = await prisma.user.findFirst({ where: { phone } });
    if (phoneOwner && phoneOwner.id !== existing?.id) {
      throw new AppError('This mobile number is already registered. Please sign in instead.', 409, 'CONFLICT', {
        phone: 'This mobile number is already registered.',
      });
    }

    if (existing) {
      if (existing.isEmailVerified) {
        throw new AppError('An account with this email address already exists. Please sign in.', 409, 'CONFLICT', {
          email: 'This email address is already registered. Please sign in instead.',
        });
      }

      // Safe verification-resend flow for unverified account
      const passwordHash = await hashPassword(input.password);
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          username,
          fullName: username,
          dateOfBirth: birthDate,
          passwordHash,
          country,
          phone,
        },
      });

      await this.sendEmailOtp(email, 'registration', existing.id, username);

      return {
        success: true,
        requiresVerification: true,
        email,
        username,
        age,
        isEligibleDonor: age >= 18,
        message: 'An unverified account with this email already exists. A fresh verification code has been dispatched to your email.',
      };
    }

    // Check username uniqueness
    const existingUsername = await prisma.user.findFirst({
      where: { username },
    });
    if (existingUsername) {
      throw new AppError('This username is already taken. Please choose another username.', 409, 'CONFLICT', {
        username: 'This username is already taken. Please choose another one.',
      });
    }

    const passwordHash = await hashPassword(input.password);
    const userReferralCode = 'SAVIOR-' + generateRandomToken(4).toUpperCase();

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          fullName: username,
          dateOfBirth: birthDate,
          email,
          phone,
          country,
          passwordHash,
          role: input.role || 'donor',
          status: 'active',
          isEmailVerified: false,
        },
      });

      await tx.referral.create({
        data: {
          referrerUserId: user.id,
          referralCode: userReferralCode,
          status: 'active',
        },
      });

      // Record who invited this person as its own row. The inviter's code row stays unchanged,
      // so one savior link can count every person who joins with it (not just the latest one).
      if (input.referralCode) {
        const parentReferral = await tx.referral.findUnique({
          where: { referralCode: input.referralCode.toUpperCase() },
        });
        if (parentReferral && parentReferral.status === 'active' && parentReferral.referrerUserId !== user.id) {
          await tx.referral.create({
            data: {
              referrerUserId: parentReferral.referrerUserId,
              referralCode: `${parentReferral.referralCode}-${generateRandomToken(4).toUpperCase()}`,
              referredUserId: user.id,
              status: 'completed',
              completedAt: new Date(),
            },
          });
        }
      }

      await tx.consentRecord.create({
        data: {
          userId: user.id,
          purpose: 'terms_and_privacy',
          policyVersion: 'v2.4-2026',
          isGranted: input.termsAccepted ?? true,
        },
      });

      return user;
    });

    await this.sendEmailOtp(email, 'registration', newUser.id, username);

    return {
      success: true,
      requiresVerification: true,
      email: newUser.email,
      username: newUser.username,
      age,
      isEligibleDonor: age >= 18,
      message: 'Account created successfully. Please enter the 6-digit verification code sent to your email.',
    };
  }

  async signupWithReferral(input: {
    referralCode: string;
    name?: string;
    fullName?: string;
    phone?: string;
    phoneNumber?: string;
    bloodGroup?: string;
    city?: string;
    state?: string;
    district?: string;
    country?: string;
    postalCode?: string;
  }) {
    // Every new account must confirm an emailed code, so the no-code shortcut is switched off.
    // New donors join through /join/<code>/register (donors.service registerDonor), which sends the code.
    void input;
    throw new AppError(
      'Please complete registration from the invitation page and confirm the code we email you.',
      410,
      'GONE',
    );
  }

  async verifyEmail(input: { email: string; code: string }) {
    const email = input.email.toLowerCase().trim();
    const code = (input.code || '').trim();

    if (!code || code.length !== 6) {
      throw new AppError('Verification code must be exactly 6 digits.', 400, 'VALIDATION_FAILED');
    }

    const hashedOtp = hashToken(code);

    const challenge = await prisma.emailOtpChallenge.findFirst({
      where: {
        email,
        purpose: 'registration',
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new AppError('No pending verification code found for this email. Please request a new code.', 400, 'VALIDATION_FAILED');
    }

    if (challenge.expiresAt < new Date()) {
      await prisma.emailOtpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw new AppError('Verification code has expired. Please request a new code.', 400, 'OTP_EXPIRED');
    }

    if (challenge.attemptCount >= config.otp.maxAttempts) {
      await prisma.emailOtpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw new AppError('Maximum verification attempts exceeded. Please request a new code.', 429, 'MAX_ATTEMPTS_EXCEEDED');
    }

    if (challenge.hashedOtp !== hashedOtp) {
      const updated = await prisma.emailOtpChallenge.update({
        where: { id: challenge.id },
        data: { attemptCount: { increment: 1 } },
      });
      const remaining = config.otp.maxAttempts - updated.attemptCount;
      throw new AppError(`Incorrect verification code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : 'Please request a new code.'}`, 400, 'INVALID_OTP');
    }

    await prisma.$transaction(async (tx) => {
      await tx.emailOtpChallenge.update({
        where: { id: challenge.id },
        data: {
          consumedAt: new Date(),
          verifiedAt: new Date(),
        },
      });

      await tx.user.updateMany({
        where: challenge.userId ? { id: challenge.userId } : { email },
        data: {
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
    });

    const user = await prisma.user.findUnique({
      where: { email },
      include: { donorProfile: true },
    });

    if (!user) {
      throw new AppError('User account not found.', 404, 'NOT_FOUND');
    }

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshTokenString = generateRandomToken(40);
    const refreshTokenHash = hashToken(refreshTokenString);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const userReferral = await prisma.referral.findFirst({
      where: { referrerUserId: user.id, status: 'active' },
      select: { referralCode: true },
    });

    return {
      success: true,
      message: 'Email verified successfully! Welcome to BloodConnect.',
      user: {
        id: user.id,
        name: user.username || user.fullName || 'Savior',
        username: user.username,
        email: user.email,
        phone: user.phone,
        country: user.country,
        role: user.role,
        referralCode: userReferral?.referralCode || undefined,
        isVerified: true,
        createdAt: user.createdAt.toISOString(),
      },
      token: accessToken,
      refreshToken: refreshTokenString,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async resendVerification(input: { email: string }) {
    const email = input.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('Account not found.', 404, 'NOT_FOUND');
    }

    if (user.isEmailVerified) {
      throw new AppError('This account is already verified. Please sign in.', 400, 'ALREADY_VERIFIED');
    }

    return await this.sendEmailOtp(email, 'registration', user.id, user.username || user.fullName || undefined);
  }

  // Alias wrappers for backwards compatibility
  async login(input: LoginInput) {
    const rawEmail = input.email || input.identifier || '';
    return this.signin({ email: rawEmail, password: input.password || '' });
  }

  async register(input: RegisterInput) {
    return this.signup({
      username: input.username || input.fullName || input.email.split('@')[0],
      // No default: a real date of birth is needed to confirm the person is 18 or older
      dateOfBirth: input.dateOfBirth || '',
      email: input.email,
      password: input.password,
      confirmPassword: input.password,
      role: input.role,
      referralCode: input.referralCode,
      termsAccepted: input.termsAccepted,
      phone: input.phone,
      country: input.country,
    });
  }

  async sendEmailOtp(email: string, purpose: string = 'registration', userId?: string, username?: string) {
    const normalizedEmail = email.toLowerCase().trim();

    if (!normalizedEmail) {
      throw new AppError('A valid email address is required for verification.', 400, 'VALIDATION_FAILED');
    }

    // Check resend cooldown
    const recentChallenge = await prisma.emailOtpChallenge.findFirst({
      where: {
        email: normalizedEmail,
        purpose,
        createdAt: {
          gte: new Date(Date.now() - config.otp.resendCooldownSeconds * 1000),
        },
      },
    });

    if (recentChallenge) {
      throw new AppError(
        `Please wait ${config.otp.resendCooldownSeconds} seconds before requesting a new verification code.`,
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    // Invalidate previous unconsumed challenges of same purpose for this email
    await prisma.emailOtpChallenge.updateMany({
      where: { email: normalizedEmail, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const otpCode = generateSecureOtp();
    const hashedOtp = hashToken(otpCode);
    const expiresAt = new Date(Date.now() + config.otp.ttlSeconds * 1000);

    // Save OTP challenge to DB first
    await prisma.emailOtpChallenge.create({
      data: {
        email: normalizedEmail,
        userId: userId || null,
        hashedOtp,
        purpose,
        expiresAt,
        attemptCount: 0,
      },
    });

    // Send email via Gmail SMTP (or branded template)
    if (purpose === 'login') {
      await emailService.sendLoginOtpEmail(normalizedEmail, otpCode);
    } else {
      await emailService.sendAccountVerificationEmail(normalizedEmail, otpCode, username);
    }

    return {
      success: true,
      message: `A 6-digit verification code has been dispatched to ${normalizedEmail}.`,
      expiresInSeconds: config.otp.ttlSeconds,
      resendCooldownSeconds: config.otp.resendCooldownSeconds,
    };
  }

  async verifyOtp(input: VerifyOtpInput): Promise<boolean> {
    const otpValue = input.otp || input.code;
    if (!otpValue || otpValue.length !== 6) {
      throw new AppError('Verification code must be exactly 6 digits.', 400, 'VALIDATION_FAILED');
    }

    let normalizedEmail = input.email ? input.email.toLowerCase().trim() : '';

    // If email is not supplied but phone was, attempt resolving user email
    if (!normalizedEmail && input.phone) {
      const existingUser = await prisma.user.findFirst({
        where: { phone: input.phone },
        select: { email: true },
      });
      if (existingUser) {
        normalizedEmail = existingUser.email;
      }
    }

    const hashedOtp = hashToken(otpValue);
    const purpose = input.purpose || 'registration';

    // 1. Locate valid unconsumed challenge
    const challenge = await prisma.emailOtpChallenge.findFirst({
      where: {
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        purpose,
        consumedAt: null,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new AppError('Invalid or expired verification code.', 400, 'VALIDATION_FAILED');
    }

    // 2. Lockout on maximum attempt threshold
    if (challenge.attemptCount >= config.otp.maxAttempts) {
      throw new AppError(
        'Too many failed attempts. For security, please request a new verification code.',
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    // 3. Compare hash; persist attemptCount increment to DB on mismatch
    if (challenge.hashedOtp !== hashedOtp) {
      await prisma.emailOtpChallenge.update({
        where: { id: challenge.id },
        data: { attemptCount: { increment: 1 } },
      });
      throw new AppError('Incorrect verification code. Please check and try again.', 400, 'VALIDATION_FAILED');
    }

    // 4. Atomically consume challenge in transaction to prevent replay and double verification
    return await prisma.$transaction(async (tx) => {
      const consumption = await tx.emailOtpChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
        },
        data: {
          consumedAt: new Date(),
          verifiedAt: new Date(),
        },
      });

      if (consumption.count === 0) {
        throw new AppError('Verification code has already been consumed or processed.', 409, 'CONFLICT');
      }

      // Mark user as verified in database
      const targetEmail = challenge.email || normalizedEmail;
      if (challenge.userId || targetEmail) {
        await tx.user.updateMany({
          where: challenge.userId ? { id: challenge.userId } : { email: targetEmail },
          data: {
            isEmailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });
      }

      return true;
    });
  }

  async requestPasswordReset(input: ForgotPasswordInput) {
    const rawIdentifier = input.email || input.identifier || '';
    const normalizedIdentifier = rawIdentifier.toLowerCase().trim();

    let user = null;
    if (normalizedIdentifier.includes('@')) {
      user = await prisma.user.findUnique({ where: { email: normalizedIdentifier } });
    } else if (normalizedIdentifier) {
      user = await prisma.user.findFirst({ where: { phone: normalizedIdentifier } });
    }

    // Always respond generically without disclosing whether the account exists
    const genericResponse = {
      success: true,
      message: 'If an account exists with that email, password reset instructions have been sent.',
    };

    if (!user || !user.email) {
      return genericResponse;
    }

    // Generate cryptographically secure reset token
    const resetToken = generateRandomToken(32);
    const tokenHash = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + config.passwordReset.ttlSeconds * 1000);

    // Store only token hash in PostgreSQL
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Reset link uses configured frontend URL, NOT untrusted request headers
    const resetLink = `${config.frontendUrl}/auth/reset-password?token=${resetToken}`;
    await emailService.sendPasswordResetEmail(user.email, resetLink);

    return genericResponse;
  }

  async verifyResetToken(token: string) {
    if (!token || typeof token !== 'string') {
      throw new AppError('Password reset token is required.', 400, 'VALIDATION_FAILED');
    }

    const tokenHash = hashToken(token);
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: { email: true, status: true },
        },
      },
    });

    if (!resetRecord || resetRecord.consumedAt || resetRecord.expiresAt < new Date()) {
      throw new AppError('Password reset link is invalid or has expired. Please request a new one.', 400, 'VALIDATION_FAILED');
    }

    if (resetRecord.user.status === 'suspended') {
      throw new AppError('Your account has been suspended. Please contact support.', 403, 'FORBIDDEN');
    }

    // Obfuscate email for safe UI display
    const email = resetRecord.user.email;
    const atIdx = email.indexOf('@');
    const masked = atIdx > 2
      ? `${email[0]}***${email[atIdx - 1]}${email.slice(atIdx)}`
      : `***${email.slice(atIdx)}`;

    return {
      valid: true,
      email: masked,
      message: 'Password reset token is valid.',
    };
  }

  async resetPassword(input: ResetPasswordInput) {
    if (!input.token) {
      throw new AppError('Reset token is required.', 400, 'VALIDATION_FAILED');
    }
    if (!input.newPassword || input.newPassword.length < 8) {
      throw new AppError('Password must be at least 8 characters long.', 400, 'VALIDATION_FAILED');
    }

    const tokenHash = hashToken(input.token);
    const newHash = await hashPassword(input.newPassword);

    const userEmail = await prisma.$transaction(async (tx) => {
      const resetRecord = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!resetRecord || resetRecord.consumedAt || resetRecord.expiresAt < new Date()) {
        throw new AppError('Password reset link is invalid or has expired. Please request a new one.', 400, 'VALIDATION_FAILED');
      }

      // Atomically consume token
      const consumption = await tx.passwordResetToken.updateMany({
        where: {
          id: resetRecord.id,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });

      if (consumption.count === 0) {
        throw new AppError('Password reset token has already been consumed.', 409, 'CONFLICT');
      }

      // Update password
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newHash },
      });

      // Revoke all active refresh tokens/sessions
      await tx.refreshToken.updateMany({
        where: { userId: resetRecord.userId, isRevoked: false },
        data: { isRevoked: true },
      });

      return resetRecord.user.email;
    });

    // Notify account owner of password change via CPET SMTP
    if (userEmail) {
      await emailService.sendPasswordChangedNotificationEmail(userEmail).catch((err) => {
        logger.warn(`Could not send password change confirmation email: ${err.message}`);
      });
    }

    // Do not automatically authenticate a user merely because a reset succeeded
    return {
      success: true,
      message: 'Your password has been successfully reset. You may now sign in with your new password.',
    };
  }

  async changePassword(userId: string, input: { currentPassword: string; newPassword: string }) {
    if (!input.currentPassword || !input.newPassword) {
      throw new AppError('Current password and new password are both required.', 400, 'VALIDATION_FAILED');
    }
    if (input.newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters long.', 400, 'VALIDATION_FAILED');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new AppError('User account not found.', 404, 'NOT_FOUND');
    }

    const isMatch = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Current password does not match.', 400, 'VALIDATION_FAILED');
    }

    const newHash = await hashPassword(input.newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      });

      // Revoke prior refresh tokens
      await tx.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
    });

    // Notify account owner
    if (user.email) {
      await emailService.sendPasswordChangedNotificationEmail(user.email).catch((err) => {
        logger.warn(`Could not send password change confirmation email: ${err.message}`);
      });
    }

    return {
      success: true,
      message: 'Password has been updated successfully.',
    };
  }

  async getCurrentSession(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { donorProfile: true },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    if (user.status === 'suspended') {
      throw new AppError('Your account has been suspended. Please contact support.', 403, 'FORBIDDEN');
    }

    const token = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const userReferral = await prisma.referral.findFirst({
      where: { referrerUserId: user.id, status: 'active' },
      select: { referralCode: true },
    });

    return {
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
        country: user.country,
        role: user.role,
        referralCode: userReferral?.referralCode || undefined,
        isVerified: user.isEmailVerified,
        verified: user.isEmailVerified,
        createdAt: user.createdAt.toISOString(),
      },
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async logout(userId: string) {
    await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }
}

export const authService = new AuthService();
