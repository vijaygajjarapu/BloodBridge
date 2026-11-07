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
  createdAt: string;
}

export interface FamilyMemberInput {
  name: string;
  relation: FamilyRelation;
  bloodGroup: BloodGroup;
  dateOfBirth?: string | null;
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
  donorUserId: string;
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
  /** Empty unless the family has an active subscription */
  donors: CircleDonor[];
}

export interface FamilyCircle {
  locked: boolean;
  totalDonors: number;
  members: CircleMember[];
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

export interface MySubscription {
  active: boolean;
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
