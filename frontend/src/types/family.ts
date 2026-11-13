import type { BloodGroup } from './donor';

export type FamilyRelation =
  | 'self'
  | 'spouse'
  | 'son'
  | 'daughter'
  | 'father'
  | 'mother'
  | 'brother'
  | 'sister'
  | 'grandparent'
  | 'other';

export interface FamilyMember {
  id: string;
  name: string;
  relation: FamilyRelation;
  bloodGroup: BloodGroup;
  dateOfBirth: string | null;
  /** Optional: this family member (18+) is willing to donate blood */
  willingToDonate: boolean;
  /** Reach them on the account owner's mobile number */
  useOwnerPhone: boolean;
  /** Their own mobile ("+919876543210") when not using the owner's */
  donorPhone: string | null;
  /** They agreed that their name and number may be shown to someone whose blood request they match */
  contactConsent: boolean;
  contactConsentAt: string | null;
  createdAt: string;
}

export interface FamilyMemberInput {
  name: string;
  relation: FamilyRelation;
  bloodGroup: BloodGroup;
  dateOfBirth?: string | null;
  willingToDonate?: boolean;
  useOwnerPhone?: boolean;
  donorPhone?: string | null;
  contactConsent?: boolean;
}

export interface FamilyInviteInfo {
  code: string;
  bloodGroups: BloodGroup[];
}

/** What anyone opening an invite link sees: first name + blood groups only */
export interface FamilyInvitePublic {
  code: string;
  inviterFirstName: string;
  bloodGroups: BloodGroup[];
  isOwnInvite: boolean;
  myPledgedGroups: BloodGroup[];
  myBloodGroup: BloodGroup | null;
}

export interface CircleDonor {
  pledgeId: string;
  /** null for a family member (no account) */
  donorUserId: string | null;
  /** "pledge": pledged through your invite; "family": a family member who ticked "Eligible to donate blood?" */
  source?: 'pledge' | 'family' | 'pledger_family';
  /** For "pledger_family": the first name of the person who pledged to you (it's their family member) */
  via?: string;
  /** For "pledger_family": how they are related to that person, e.g. "brother" */
  relation?: FamilyRelation;
  familyMemberId?: string;
  donorBloodGroup?: BloodGroup;
  name: string;
  /** Only when the donor allows calls (and only the inviter sees it) */
  phone: string | null;
  canCall: boolean;
  /** Only when the donor shares availability */
  availability: 'available' | 'recently_donated' | 'unavailable' | null;
  getsRequestAlerts: boolean;
  pledgedAt: string;
}

export interface PledgePermissions {
  /** The family owner may see my number and call me */
  shareContact: boolean;
  /** This family's emergency requests reach me wherever I live */
  allowRequestAlerts: boolean;
  /** The family owner may see whether I can donate right now */
  shareAvailability: boolean;
}

export interface CircleMember {
  memberId: string;
  name: string;
  relation: FamilyRelation;
  bloodGroup: BloodGroup;
  donorCount: number;
  /** How many of donorCount are your own family members */
  familyDonorCount?: number;
  /** Pledged donors only with an active subscription; your own family members always */
  donors: CircleDonor[];
}

/** A family member who can donate, and who in the family they can give to */
export interface FamilyDonorSummary {
  memberId: string;
  name: string;
  relation: FamilyRelation;
  bloodGroup: BloodGroup;
  phone: string | null;
  /** They agreed their name and number may be shown to people near you whose blood request they match */
  sharedOutsideFamily: boolean;
  canGiveTo: string[];
}

export interface FamilyCircle {
  locked: boolean;
  totalDonors: number;
  members: CircleMember[];
  familyDonors?: FamilyDonorSummary[];
}

export interface MyPledge {
  ownerUserId: string;
  familyOf: string;
  inviteCode: string | null;
  bloodGroups: BloodGroup[];
  since: string;
  permissions: PledgePermissions;
}

export interface SubscriptionPlan {
  plan: string;
  amountInr: number;
  currency: 'INR';
  periodMonths: number;
  paymentsConfigured: boolean;
  devSimulation: boolean;
  purchaseChannel: 'web';
  autoRenewDefault?: boolean;
  /** Razorpay charges renewals automatically (a Subscriptions plan is configured) */
  recurring?: boolean;
}

/** Corporate: the company pays for the Donor Circle (or the 30-day free period after leaving it) */
export type CompanyCoverage =
  | { kind: 'company'; orgId: string; orgName: string; since: string }
  | { kind: 'grace'; orgId: string; orgName: string; exitDate: string; until: string };

export type UnlockOptionId = 'prorated' | 'anniversary';

export interface UnlockQuote {
  orgName: string;
  lockedSince: string;
  lockedDays: number;
  options: (
    | { id: 'prorated'; amountPaise: number; amountInr: number; endsAt: string; lockedDays: number }
    | { id: 'anniversary'; amountPaise: number; amountInr: number; endsAt: string; baseInr: number; gstPercent: number }
  )[];
}

export interface MySubscription {
  active: boolean;
  company?: CompanyCoverage | null;
  /** Locked after the company stopped paying: the two ways to unlock */
  unlock?: UnlockQuote | null;
  startsAt: string | null;
  endsAt: string | null;
  provider: string | null;
  autoRenew: boolean;
  renewalMode: 'automatic' | 'reminder' | null;
  renewsOn: string | null;
  cancelledAt: string | null;
  plan: SubscriptionPlan;
}

export interface PaymentOrder {
  /** order = one-time payment; subscription = Razorpay charges every year */
  mode: 'order' | 'subscription';
  subscriptionId: string | null;
  orderId: string | null;
  keyId: string;
  amountPaise: number;
  currency: 'INR';
  name: string;
  email: string;
  phone: string;
}
