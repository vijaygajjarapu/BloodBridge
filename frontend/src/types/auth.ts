export type UserRole = 'donor' | 'admin';

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  avatarUrl?: string;
  referralCode?: string;
  createdAt: string;
  isVerified: boolean;
  /** ISO country code of the account, e.g. "IN" */
  country?: string;
  // Donor profile details (returned by GET /profile)
  bloodGroup?: string;
  state?: string;
  district?: string;
  city?: string;
  postalCode?: string;
  donationWillingness?: string;
  isAvailable?: boolean;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: string;
  /** Signed-in sessions end after this many seconds with no clicks or typing (default 5 minutes) */
  idleTimeoutSeconds?: number;
}

export interface PhoneLoginOtpResponse {
  success: boolean;
  deliveredVia: 'sms' | 'email';
  maskedPhone?: string;
  maskedEmail?: string;
  message: string;
  expiresInSeconds?: number;
  resendCooldownSeconds?: number;
}

export interface LoginCredentials {
  identifier?: string;
  email?: string;
  password?: string;
  otp?: string;
}

export interface SignInCredentials {
  /** Email address or mobile number */
  identifier: string;
  password: string;
  /** Older clients sent only `email` */
  email?: string;
}

export interface SignInResponse {
  success: boolean;
  requiresOtp?: boolean;
  requiresEmailVerification?: boolean;
  email: string;
  /** e.g. "pr•••••@gmail.com", shown when the person signed in with a phone number */
  maskedEmail?: string;
  expiresInSeconds?: number;
  resendCooldownSeconds?: number;
  message: string;
  /** Present when the person is signed in straight away (verified member, no login code needed) */
  token?: string;
  user?: User;
  expiresAt?: string;
  idleTimeoutSeconds?: number;
}

export interface SignUpInput {
  username: string;
  dateOfBirth: string;
  email: string;
  password: string;
  confirmPassword?: string;
  referralCode?: string;
  termsAccepted?: boolean;
  /** ISO country code, e.g. "IN" */
  country?: string;
  /** Mobile number, stored as +91XXXXXXXXXX */
  phone?: string;
}

export interface SignUpResponse {
  success: boolean;
  requiresVerification: boolean;
  email: string;
  username?: string;
  age?: number;
  isEligibleDonor?: boolean;
  message: string;
}

export interface SignupReferralInput {
  referralCode: string;
  fullName?: string;
  name?: string;
  phone?: string;
  phoneNumber?: string;
  bloodGroup?: string;
  country?: string;
  state?: string;
  district?: string;
  city?: string;
  postalCode?: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  termsAccepted: boolean;
  privacyAcknowledged: boolean;
  referralCodeUsed?: string;
}

export interface VerifyOtpInput {
  phone?: string;
  email?: string;
  code?: string;
  otp?: string;
  purpose?: string;
}

export interface ForgotPasswordInput {
  identifier?: string;
  email?: string;
}

export interface ResetPasswordInput {
  token?: string;
  identifier?: string;
  code?: string;
  newPassword: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mode: 'demo' | 'api';
}
