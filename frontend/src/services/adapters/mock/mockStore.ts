import {
  INITIAL_CURRENT_USER,
  INITIAL_ADMIN_USER,
  INITIAL_DONORS,
  INITIAL_NOTIFICATIONS,
  INITIAL_CONSENT_PREFERENCES,
  INITIAL_ADMIN_METRICS,
  INITIAL_ADMIN_USERS,
  INITIAL_ADMIN_REFERRALS,
  INITIAL_AUDIT_LOGS,
  INITIAL_ORG_SETTINGS,
  INITIAL_FAQS,
} from './mockData';
import type { User, AuthSession } from '../../../types/auth';
import type { DonorDetails, DonorSummary, DonorRegistrationInput, DonorRegistrationResult } from '../../../types/donor';
import type { AppNotification } from '../../../types/notification';
import type { UserConsentPreferences, ConsentRecord } from '../../../types/consent';
import type { AdminOverviewMetrics, AdminUser, AdminDonor, AdminReferralItem, AuditLogEntry, OrganizationSettings } from '../../../types/admin';

export const delay = (ms: number = 200) => new Promise((resolve) => setTimeout(resolve, ms));

class MockStore {
  public currentUser: User | null = INITIAL_CURRENT_USER;
  public adminUser: User = INITIAL_ADMIN_USER;
  public donors: DonorDetails[] = [...INITIAL_DONORS];
  public notifications: AppNotification[] = [...INITIAL_NOTIFICATIONS];
  public consentPreferences: UserConsentPreferences = { ...INITIAL_CONSENT_PREFERENCES };
  public adminMetrics: AdminOverviewMetrics = { ...INITIAL_ADMIN_METRICS };
  public adminUsers: AdminUser[] = [...INITIAL_ADMIN_USERS];
  public adminReferrals: AdminReferralItem[] = [...INITIAL_ADMIN_REFERRALS];
  public auditLogs: AuditLogEntry[] = [...INITIAL_AUDIT_LOGS];
  public orgSettings: OrganizationSettings = { ...INITIAL_ORG_SETTINGS };
  public faqs = [...INITIAL_FAQS];

  // Reset to initial demo state
  public reset() {
    this.currentUser = INITIAL_CURRENT_USER;
    this.donors = [...INITIAL_DONORS];
    this.notifications = [...INITIAL_NOTIFICATIONS];
    this.consentPreferences = { ...INITIAL_CONSENT_PREFERENCES };
    this.adminMetrics = { ...INITIAL_ADMIN_METRICS };
    this.adminUsers = [...INITIAL_ADMIN_USERS];
    this.adminReferrals = [...INITIAL_ADMIN_REFERRALS];
    this.auditLogs = [...INITIAL_AUDIT_LOGS];
    this.orgSettings = { ...INITIAL_ORG_SETTINGS };
  }

  // Add donor registration
  public registerNewDonor(input: DonorRegistrationInput): DonorRegistrationResult {
    const newDonorId = `dnr_${Date.now()}`;
    const newReferralCode = `SAVIOR-${input.fullName.split(' ')[0].toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`;

    const newDonor: DonorDetails = {
      id: newDonorId,
      name: input.fullName,
      bloodGroup: input.bloodGroup,
      location: {
        state: input.state,
        district: input.district,
        city: input.city,
      },
      status: 'active',
      willingness: input.willingness || 'regular',
      registeredAt: new Date().toISOString(),
      referredByCode: input.referralCode,
      isEligibleNow: true,
      email: input.email,
      canAccessContact: input.contactSharingConsent,
      contactNumber: input.contactSharingConsent ? input.phone : undefined,
      contactSharingConsentGranted: input.contactSharingConsent,
      notes: `Registered via referral code ${input.referralCode}.`,
      emergencyAvailability: true,
      totalDonationsCount: 0,
    };

    // Prepend to donor list so it appears at top of referrals
    this.donors.unshift(newDonor);

    // Update referral counts
    const refItem = this.adminReferrals.find(r => r.code.toUpperCase() === input.referralCode.toUpperCase());
    if (refItem) {
      refItem.successfulRegistrations += 1;
    }

    // Add audit log
    this.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      actorId: this.currentUser?.id || 'guest',
      actorName: input.fullName,
      actorRole: 'Donor',
      action: 'DONOR_REGISTRATION',
      entityType: 'donor',
      entityId: newDonorId,
      details: `New ${input.bloodGroup} donor registered under referral ${input.referralCode}.`,
      timestamp: new Date().toISOString(),
      ipAddress: '127.0.0.1 (simulated)',
    });

    // Add notification to current user if referred under their code
    this.notifications.unshift({
      id: `notif_${Date.now()}`,
      title: 'New Donor Registered!',
      message: `${input.fullName} (${input.bloodGroup}) just completed registration using referral code ${input.referralCode}.`,
      type: 'referral',
      isRead: false,
      createdAt: new Date().toISOString(),
      actionUrl: `/app/donors/${newDonorId}`,
    });

    // Update admin metrics
    this.adminMetrics.totalDonors += 1;
    this.adminMetrics.referralRegistrations += 1;

    return {
      success: true,
      donorId: newDonorId,
      message: 'Donor registered successfully in demo mode.',
      referralCodeCreated: newReferralCode,
    };
  }
}

export const mockStore = new MockStore();
