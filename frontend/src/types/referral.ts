export interface ReferralCodeValidation {
  isValid: boolean;
  code: string;
  referrerName?: string; // Only disclosed if authorized/configured
  canDiscloseReferrer: boolean;
  message?: string;
  isExpired?: boolean;
}

export interface ReferralActivity {
  id: string;
  donorName: string;
  bloodGroup: string;
  registeredAt: string;
  status: 'registered' | 'verified' | 'pending';
}

export interface ReferralStats {
  code: string;
  referralUrl: string;
  totalInvitesSent: number;
  successfulRegistrations: number;
  pendingRegistrations: number;
  activeDonorsCount: number;
  recentActivity: ReferralActivity[];
}

export interface ShareInvitationPayload {
  recipientContact?: string;
  channel: 'whatsapp' | 'sms' | 'copy' | 'native';
  referralCode: string;
  messageText: string;
}
