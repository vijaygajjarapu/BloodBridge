export type ConsentStatus = 'granted' | 'withdrawn' | 'pending';

export interface ConsentHistoryItem {
  id: string;
  action: 'granted' | 'updated' | 'withdrawn';
  purpose: string;
  timestamp: string;
  policyVersion: string;
  ipAddressMasked?: string;
}

export interface UserConsentPreferences {
  contactSharingAllowed: boolean;
  emergencyBroadcastAllowed: boolean;
  smsNotificationsAllowed: boolean;
  lastUpdated: string;
  activePolicyVersion: string;
  history: ConsentHistoryItem[];
}

export interface ConsentRecord {
  id: string;
  userId: string;
  userName: string;
  phoneMasked: string;
  country?: string;
  status: ConsentStatus;
  policyVersion: string;
  grantedAt: string;
  withdrawnAt?: string;
  withdrawalReason?: string;
}
