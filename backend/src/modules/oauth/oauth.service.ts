import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { config } from '../../config/index.js';
import { signAccessToken } from '../../shared/jwt.js';
import { generateRandomToken } from '../../shared/password.js';
import { AppError } from '../../shared/types.js';
import { logger } from '../../shared/logger.js';
import { getCountry, DEFAULT_COUNTRY_CODE } from '../../../../shared/countries.js';

/** Name of the short-lived cookie that ties Google's reply to the browser that started sign-in */
export const OAUTH_STATE_COOKIE = 'bb_google_state';

interface StatePayload {
  nonce: string;
  country: string;
  issuedAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;

function sign(value: string): string {
  return crypto.createHmac('sha256', config.jwt.secret).update(value).digest('base64url');
}

/** state = base64url(payload).signature — tamper-proof and carries the chosen country */
function encodeState(payload: StatePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

function decodeState(state: string | undefined): StatePayload | null {
  if (!state || !state.includes('.')) return null;
  const [body, signature] = state.split('.');
  const expected = sign(body);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as StatePayload;
    if (Date.now() - payload.issuedAt > STATE_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

export class OAuthService {
  isConfigured(): boolean {
    return Boolean(config.oauth.googleClientId && config.oauth.googleClientSecret);
  }

  /** Builds the Google consent URL. Returns the nonce to store in the browser cookie. */
  getGoogleAuthUrl(countryCode?: string): { url: string; nonce: string } {
    if (!this.isConfigured()) {
      logger.warn('Google sign-in requested but GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set in backend/.env');
      throw new AppError(
        'Google sign-in is not set up yet. Please use email sign-up for now.',
        503,
        'OAUTH_NOT_CONFIGURED',
      );
    }

    const country = getCountry(countryCode);
    const nonce = generateRandomToken(16);
    const state = encodeState({
      nonce,
      country: country && country.enabled ? country.code : DEFAULT_COUNTRY_CODE,
      issuedAt: Date.now(),
    });

    const params = new URLSearchParams({
      client_id: config.oauth.googleClientId,
      redirect_uri: config.oauth.googleCallbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });

    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, nonce };
  }

  async handleGoogleCallback(code: string, state: string | undefined, cookieNonce: string | undefined) {
    if (!this.isConfigured()) {
      throw new AppError('Google sign-in is not set up yet.', 503, 'OAUTH_NOT_CONFIGURED');
    }

    // The reply must carry our signed state AND come back to the same browser that started sign-in
    const payload = decodeState(state);
    if (!payload || !cookieNonce || payload.nonce !== cookieNonce) {
      throw new AppError('Google sign-in expired or could not be verified. Please try again.', 400, 'OAUTH_STATE_INVALID');
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.oauth.googleClientId,
        client_secret: config.oauth.googleClientSecret,
        redirect_uri: config.oauth.googleCallbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData: any = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new AppError(tokenData.error_description || 'Failed to exchange authorization code with Google.', 400, 'OAUTH_FAILED');
    }

    // Fetch user profile using access token
    const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userInfo: any = await userInfoResponse.json();
    if (!userInfoResponse.ok || !userInfo.sub) {
      throw new AppError('Failed to fetch your profile from Google.', 400, 'OAUTH_FAILED');
    }

    const googleSub = String(userInfo.sub);
    const email = userInfo.email?.toLowerCase();
    const name = userInfo.name || 'Google Savior';
    const emailVerified = userInfo.email_verified === true;

    if (!email) {
      throw new AppError('Your Google account did not share an email address.', 400, 'OAUTH_FAILED');
    }
    if (!emailVerified) {
      // An unverified Google email could belong to someone else; never link or create on it
      throw new AppError('Your Google email address is not verified. Please verify it with Google or sign up with email.', 400, 'OAUTH_FAILED');
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Already linked to Google
      const existingOAuth = await tx.oAuthAccount.findUnique({
        where: { provider_providerSubjectId: { provider: 'google', providerSubjectId: googleSub } },
        include: { user: true },
      });
      if (existingOAuth) {
        return { user: existingOAuth.user, isNew: false };
      }

      // 2. Existing account with the same (verified) email: link it
      let user = await tx.user.findUnique({ where: { email } });
      let isNew = false;

      if (!user) {
        isNew = true;
        user = await tx.user.create({
          data: {
            fullName: name,
            email,
            country: payload.country,
            role: 'donor',
            status: 'active',
            isEmailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });

        // Location, phone and blood group are completed on the profile page
        await tx.donorProfile.create({
          data: {
            userId: user.id,
            bloodGroup: 'O+',
            country: payload.country,
            state: '',
            district: '',
            city: '',
            isAvailable: true,
          },
        });

        await tx.referral.create({
          data: {
            referrerUserId: user.id,
            referralCode: 'SAVIOR-' + generateRandomToken(4).toUpperCase(),
            status: 'active',
          },
        });
      } else if (!user.isEmailVerified) {
        user = await tx.user.update({
          where: { id: user.id },
          data: { isEmailVerified: true, emailVerifiedAt: new Date() },
        });
      }

      await tx.oAuthAccount.create({
        data: { userId: user.id, provider: 'google', providerSubjectId: googleSub },
      });

      return { user, isNew };
    });

    if (result.user.status === 'suspended') {
      throw new AppError('Your account has been suspended. Please contact support.', 403, 'FORBIDDEN');
    }

    const token = signAccessToken({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
    });

    const profile = await prisma.donorProfile.findUnique({ where: { userId: result.user.id } });
    // Date of birth is asked on the profile page (adults only)
    const needsProfile = !result.user.phone || !result.user.dateOfBirth || !profile?.state || !profile?.district;

    // Token goes in the URL fragment (#...), which browsers never send to servers or write to logs
    const fragment = new URLSearchParams({
      token,
      new: result.isNew ? '1' : '0',
      complete: needsProfile ? '0' : '1',
    });

    return {
      redirectUrl: `${config.frontendUrl}/auth/google/callback#${fragment.toString()}`,
    };
  }

  /** Where to send the browser when Google sign-in fails */
  errorRedirectUrl(message: string): string {
    return `${config.frontendUrl}/auth/google/callback#${new URLSearchParams({ error: message }).toString()}`;
  }
}

export const oauthService = new OAuthService();
