import type { AuthService } from '../contracts';
import type {
  AuthSession,
  LoginCredentials,
  RegisterInput,
  VerifyOtpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  SignInCredentials,
  SignInResponse,
  PhoneLoginOtpResponse,
  SignUpInput,
  SignUpResponse,
  SignupReferralInput,
} from '../../../types/auth';
import { mockStore, delay } from './mockStore';

export class MockAuthService implements AuthService {
  async signin(credentials: SignInCredentials): Promise<SignInResponse> {
    // Demo mode: signs in straight away (a phone number signs in as the demo donor)
    const identifier = credentials.identifier || credentials.email || '';
    const session = await this.login({ identifier, password: credentials.password || '' });
    return {
      success: true,
      requiresOtp: false,
      email: session.user.email || '',
      message: 'Signed in successfully. Welcome back!',
      token: session.token,
      user: session.user,
      expiresAt: session.expiresAt,
      idleTimeoutSeconds: 300,
    };
  }

  async requestPhoneLoginOtp(input: { phone: string }): Promise<PhoneLoginOtpResponse> {
    await delay(200);
    return {
      success: true,
      deliveredVia: 'sms',
      maskedPhone: input.phone,
      message: `Demo mode: enter any 6 digits to sign in as ${input.phone}.`,
      expiresInSeconds: 300,
      resendCooldownSeconds: 60,
    };
  }

  async verifyPhoneLoginOtp(input: { phone: string; code: string }): Promise<AuthSession> {
    await delay(200);
    return this.login({ identifier: input.phone, password: 'Password123!' });
  }

  async refreshSessionToken(): Promise<{ token: string; expiresAt: string; idleTimeoutSeconds: number }> {
    const token = localStorage.getItem('bloodbridge_auth_token') || 'mock-jwt-token-' + Date.now();
    return { token, expiresAt: new Date(Date.now() + 300_000).toISOString(), idleTimeoutSeconds: 300 };
  }

  async signup(input: SignUpInput): Promise<SignUpResponse> {
    await delay(300);
    return {
      success: true,
      requiresVerification: true,
      email: input.email,
      username: input.username,
      message: 'Account created. Verification code sent.',
    };
  }

  async signupWithReferral(input: SignupReferralInput): Promise<AuthSession> {
    await delay(300);
    const name = input.fullName || input.name || 'Savior Friend';
    const phone = input.phoneNumber || input.phone || '+91 90000 23456';
    const user = {
      id: 'usr_ref_' + Math.random().toString(36).substring(7),
      name,
      username: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      phone,
      email: `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@bloodbridge.org`,
      role: 'donor' as const,
      referralCode: 'SAVIOR-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
      createdAt: new Date().toISOString(),
      isVerified: true,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
    };
    const session = {
      user,
      token: 'mock-jwt-token-referral-' + Date.now(),
      refreshToken: 'mock-refresh-token-referral-' + Date.now(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    mockStore.currentUser = session.user;
    localStorage.setItem('bloodbridge_auth_token', session.token);
    return session;
  }

  async verifyLoginOtp(input: { email: string; code: string }): Promise<AuthSession> {
    await delay(200);
    return this.login({ identifier: input.email, password: 'Password123!' });
  }

  async resendLoginOtp(input: { email: string }): Promise<{ success: boolean; message: string }> {
    await delay(200);
    return { success: true, message: `New login OTP sent to ${input.email}` };
  }

  async verifyEmail(input: { email: string; code: string }): Promise<AuthSession> {
    await delay(200);
    return this.login({ identifier: input.email, password: 'Password123!' });
  }

  async resendVerification(input: { email: string }): Promise<{ success: boolean; message: string }> {
    await delay(200);
    return { success: true, message: `New verification code sent to ${input.email}` };
  }
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    await delay(300);

    const identifier = credentials.identifier || credentials.email || 'marcus.vance@example.org';
    const isIdentifierAdmin = identifier.toLowerCase().includes('admin');
    const user = isIdentifierAdmin ? mockStore.adminUser : (mockStore.currentUser || {
      id: 'usr_demo_custom',
      name: 'Demo Donor',
      phone: identifier.includes('@') ? '+91 90000 19283' : identifier,
      email: identifier.includes('@') ? identifier : 'demo.donor@bloodbridge.org',
      role: 'donor' as const,
      referralCode: 'SAVIOR-DEMO',
      createdAt: new Date().toISOString(),
      isVerified: true,
    });

    mockStore.currentUser = user;

    const session: AuthSession = {
      user,
      token: `demo_token_${user.role}_${Date.now()}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    localStorage.setItem('bloodbridge_demo_session', JSON.stringify(session));
    return session;
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    await delay(350);

    const newUser = {
      id: `usr_${Date.now()}`,
      name: input.name,
      phone: input.phone || '',
      email: input.email,
      role: 'donor' as const,
      referralCode: `SAVIOR-${input.name.split(' ')[0].toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString(),
      isVerified: false, // OTP step follows
    };

    mockStore.currentUser = newUser;

    const session: AuthSession = {
      user: newUser,
      token: `demo_token_donor_${Date.now()}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    localStorage.setItem('bloodbridge_demo_session', JSON.stringify(session));
    return session;
  }

  async verifyOtp(input: VerifyOtpInput): Promise<boolean> {
    await delay(250);
    // In demo mode, accept standard '123456' or any 6-digit code
    const code = input.code || input.otp;
    if (code && code.length === 6) {
      if (mockStore.currentUser) {
        mockStore.currentUser.isVerified = true;
      }
      return true;
    }
    throw {
      code: 'INVALID_OTP',
      message: 'Demo Verification Notice: Please enter any valid 6-digit code (e.g., 123456) to proceed.',
    };
  }

  async requestOtp(target: string): Promise<{ success: boolean; message: string }> {
    await delay(200);
    return {
      success: true,
      message: `Verification code (123456) dispatched to ${target}. Enter it to complete verification.`,
    };
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<{ success: boolean; message: string }> {
    await delay(250);
    return {
      success: true,
      message: `Simulated password recovery link generated for ${input.email || input.identifier}.`,
    };
  }

  async verifyResetToken(token: string): Promise<{ valid: boolean; email?: string; message: string }> {
    await delay(150);
    return {
      valid: true,
      email: 'm***s@example.org',
      message: 'Token is valid.',
    };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ success: boolean; message: string }> {
    await delay(300);
    return {
      success: true,
      message: 'Password reset simulation successful. You may now log in with your updated credentials.',
    };
  }

  async changePassword(input: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    await delay(200);
    return {
      success: true,
      message: 'Password updated successfully.',
    };
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    await delay(100);
    const stored = localStorage.getItem('bloodbridge_demo_session');
    if (stored) {
      try {
        const session = JSON.parse(stored) as AuthSession;
        if (session.user) {
          mockStore.currentUser = session.user;
          return session;
        }
      } catch {
        localStorage.removeItem('bloodbridge_demo_session');
      }
    }
    // Default demo session is Marcus Vance
    if (mockStore.currentUser) {
      return {
        user: mockStore.currentUser,
        token: 'demo_token_marcus_vance',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
    }
    return null;
  }

  async logout(): Promise<void> {
    await delay(150);
    localStorage.removeItem('bloodbridge_demo_session');
    mockStore.currentUser = null;
  }
}

export const mockAuthService = new MockAuthService();
