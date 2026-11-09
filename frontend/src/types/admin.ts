import type { BloodGroup, DonorStatus } from './donor';
import type { ConsentStatus } from './consent';

export interface AdminOverviewMetrics {
  totalUsers: number;
  totalDonors: number;
  verifiedContacts: number;
  referralRegistrations: number;
  activeReferralCodes: number;
  consentGrantedRate: number; // percentage
  emergencyReadyCount: number;
  registrationTrends: {
    month: string;
    registrations: number;
    referrals: number;
  }[];
  bloodGroupDistribution: {
    group: BloodGroup;
    count: number;
  }[];
}

export interface AdminUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'donor' | 'admin';
  status: 'active' | 'suspended' | 'pending';
  referralCode: string;
  referralCount: number;
  createdAt: string;
  lastActiveAt: string;
  /** ISO country code, e.g. "IN" */
  country?: string;
}

export interface AdminDonor {
  id: string;
  name: string;
  phone: string;
  country?: string;
  postalCode?: string;
  email?: string;
  bloodGroup: BloodGroup;
  state: string;
  district: string;
  city: string;
  status: DonorStatus;
  consentStatus: ConsentStatus;
  referredBy?: string;
  registeredAt: string;
  notes?: string;
  bloodGroupVerified?: boolean;
  bloodGroupVerifiedAt?: string | null;
  bloodGroupVerifySource?: string | null;
  onCall?: boolean;
}

export interface AdminReferralItem {
  id: string;
  code: string;
  country?: string;
  ownerName: string;
  ownerPhone: string;
  totalInvites: number;
  successfulRegistrations: number;
  isActive: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: 'donor' | 'user' | 'referral' | 'consent' | 'system';
  entityId: string;
  details: string;
  timestamp: string;
  ipAddress: string;
}

export interface OrganizationSettings {
  orgName: string;
  supportEmail: string;
  supportPhone: string;
  emergencyHelpline: string;
  policyVersion: string;
  enablePublicRegistration: boolean;
  requireReferralCode: boolean;
  maintenanceMode: boolean;
}
