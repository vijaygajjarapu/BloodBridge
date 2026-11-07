export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type DonorStatus = 'active' | 'pending' | 'cooling_off' | 'unavailable';

export type DonationWillingness = 'emergency_only' | 'regular' | 'plasma_only' | 'undecided';

export interface LocationInfo {
  /** ISO country code, e.g. "IN" */
  country?: string;
  state: string;
  district: string;
  city: string;
  /** PIN code in India */
  postalCode?: string;
}

export interface DonorSummary {
  id: string;
  name: string;
  bloodGroup: BloodGroup;
  location: LocationInfo;
  status: DonorStatus;
  willingness: DonationWillingness;
  registeredAt: string;
  referredByCode?: string;
  lastDonatedAt?: string;
  isEligibleNow: boolean;
}

export interface DonorDetails extends DonorSummary {
  email?: string;
  // Contact details only available if server/service permits
  canAccessContact: boolean;
  contactNumber?: string;
  contactUnavailableReason?: string;
  contactSharingConsentGranted: boolean;
  notes?: string;
  emergencyAvailability: boolean;
  totalDonationsCount: number;
}

export interface DonorRegistrationInput {
  fullName: string;
  phone: string;
  email?: string;
  /** Password for the new BloodBridge account */
  password?: string;
  bloodGroup: BloodGroup;
  country: string;
  state: string;
  district: string;
  city: string;
  postalCode?: string;
  willingness?: DonationWillingness;
  contactSharingConsent: boolean;
  privacyAcknowledged: boolean;
  termsAccepted: boolean;
  referralCode: string;
}

export interface DonorRegistrationResult {
  success: boolean;
  donorId: string;
  message: string;
  referralCodeCreated?: string;
  /** True when the person must enter the 6-digit code emailed to them to activate the account */
  requiresVerification?: boolean;
  codeSent?: boolean;
  email?: string;
}

export interface DonorListParams {
  search?: string;
  bloodGroup?: BloodGroup | 'ALL';
  status?: DonorStatus | 'ALL';
  country?: string;
  state?: string;
  district?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'registeredAt' | 'bloodGroup';
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateDonorProfileInput {
  name: string;
  email?: string;
  /** Mobile number, stored as +91XXXXXXXXXX */
  phone?: string;
  bloodGroup: BloodGroup;
  location: LocationInfo;
  willingness: DonationWillingness;
  emergencyAvailability: boolean;
  contactSharingConsent: boolean;
}
