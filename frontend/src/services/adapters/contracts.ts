import type { PaginatedResult } from '../../types/api';
import type {
  User,
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
} from '../../types/auth';
import type {
  DonorSummary,
  DonorDetails,
  DonorRegistrationInput,
  DonorRegistrationResult,
  DonorListParams,
  UpdateDonorProfileInput,
} from '../../types/donor';
import type {
  ReferralCodeValidation,
  ReferralStats,
  ShareInvitationPayload,
} from '../../types/referral';
import type { AppNotification } from '../../types/notification';
import type {
  UserConsentPreferences,
  ConsentRecord,
} from '../../types/consent';
import type {
  AdminOverviewMetrics,
  AdminUser,
  AdminDonor,
  AdminReferralItem,
  AuditLogEntry,
  OrganizationSettings,
} from '../../types/admin';

export interface AuthService {
  signin(credentials: SignInCredentials): Promise<SignInResponse>;
  signup(input: SignUpInput): Promise<SignUpResponse>;
  signupWithReferral(input: SignupReferralInput): Promise<AuthSession>;
  verifyLoginOtp(input: { email: string; code: string }): Promise<AuthSession>;
  resendLoginOtp(input: { email: string }): Promise<{ success: boolean; message: string }>;
  requestPhoneLoginOtp(input: { phone: string }): Promise<PhoneLoginOtpResponse>;
  verifyPhoneLoginOtp(input: { phone: string; code: string }): Promise<AuthSession>;
  /** Fresh short-lived token while the person is active (idle timeout) */
  refreshSessionToken(): Promise<{ token: string; expiresAt: string; idleTimeoutSeconds: number }>;
  verifyEmail(input: { email: string; code: string }): Promise<AuthSession>;
  resendVerification(input: { email: string }): Promise<{ success: boolean; message: string }>;

  login(credentials: LoginCredentials): Promise<AuthSession>;
  register(input: RegisterInput): Promise<AuthSession>;
  verifyOtp(input: VerifyOtpInput): Promise<boolean>;
  requestOtp(identifier: string): Promise<{ success: boolean; message: string }>;
  forgotPassword(input: ForgotPasswordInput): Promise<{ success: boolean; message: string }>;
  verifyResetToken(token: string): Promise<{ valid: boolean; email?: string; message: string }>;
  resetPassword(input: ResetPasswordInput): Promise<{ success: boolean; message: string }>;
  changePassword(input: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }>;
  getCurrentSession(): Promise<AuthSession | null>;
  logout(): Promise<void>;
}

export interface DonorService {
  listMyDonors(params: DonorListParams): Promise<PaginatedResult<DonorSummary>>;
  getDonorById(id: string): Promise<DonorDetails>;
  registerDonor(input: DonorRegistrationInput): Promise<DonorRegistrationResult>;
  updateDonor(id: string, input: Partial<DonorDetails>): Promise<DonorDetails>;
  reportIncorrectInfo(donorId: string, reason: string): Promise<{ success: boolean; message: string }>;
}

export interface ReferralService {
  validateReferralCode(code: string): Promise<ReferralCodeValidation>;
  getReferralStats(): Promise<ReferralStats>;
  shareReferral(payload: ShareInvitationPayload): Promise<{ success: boolean; shareUrl: string }>;
}

export interface NotificationService {
  getNotifications(): Promise<AppNotification[]>;
  markAsRead(notificationId: string): Promise<void>;
  markAllAsRead(): Promise<void>;
}

export interface ProfileService {
  getProfile(): Promise<User>;
  updateProfile(input: UpdateDonorProfileInput): Promise<User>;
  requestDataExport(): Promise<{ downloadUrl: string; generatedAt: string; data?: unknown }>;
  /** confirm must be the word DELETE, typed by the person */
  requestAccountDeletion(reason: string, confirm?: string): Promise<{ success: boolean; message: string; deleted?: boolean }>;
}

export interface ConsentService {
  getConsentPreferences(): Promise<UserConsentPreferences>;
  updateConsent(update: {
    contactSharingAllowed?: boolean;
    emergencyBroadcastAllowed?: boolean;
    smsNotificationsAllowed?: boolean;
  }): Promise<UserConsentPreferences>;
  listConsentsAdmin(params: {
    status?: string;
    country?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<ConsentRecord>>;
}

export interface AdminService {
  getOverviewMetrics(country?: string): Promise<AdminOverviewMetrics>;
  listUsers(params: { search?: string; status?: string; country?: string; page?: number; pageSize?: number }): Promise<PaginatedResult<AdminUser>>;
  updateUserStatus(userId: string, status: 'active' | 'suspended' | 'pending'): Promise<AdminUser>;
  listDonors(params: DonorListParams): Promise<PaginatedResult<AdminDonor>>;
  updateDonorRecord(donorId: string, updates: Partial<AdminDonor>): Promise<AdminDonor>;
  listReferrals(params: { page?: number; pageSize?: number; search?: string; country?: string }): Promise<PaginatedResult<AdminReferralItem>>;
  toggleReferralCode(referralId: string, isActive: boolean): Promise<AdminReferralItem>;
  listAuditLogs(params: { entityType?: string; page?: number; pageSize?: number }): Promise<PaginatedResult<AuditLogEntry>>;
  getSettings(): Promise<OrganizationSettings>;
  updateSettings(settings: Partial<OrganizationSettings>): Promise<OrganizationSettings>;
}

export interface SupportService {
  submitInquiry(inquiry: {
    name: string;
    email: string;
    subject: string;
    message: string;
    category: string;
  }): Promise<{ ticketId: string; message: string }>;
  getFaqs(): Promise<{ question: string; answer: string; category: string }[]>;
}
