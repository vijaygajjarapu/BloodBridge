import type { SafeCount } from './community';

export type OrgType = 'company' | 'college' | 'ngo' | 'hospital_group' | 'other';

export interface Organisation {
  id: string;
  name: string;
  type: OrgType;
  city: string;
  district: string;
  state: string;
  verified: boolean;
  emailDomains: string[];
}

export interface MyOrganisation extends Organisation {
  membership: { role: 'member' | 'admin'; status: 'pending_email' | 'active'; workEmail: string; countInImpact: boolean; joinedAt: string };
  /** Only for admins */
  inviteCode?: string;
}

export interface OrgDashboard {
  org: Organisation & { inviteCode: string; plan: string };
  people: { members: number; donors: number; waitingForEmailCheck: number };
  readyToDonateNow: SafeCount;
  bloodGroups: Record<string, SafeCount>;
  last90Days: { requests: number; fulfilled: number; colleagueHelps: number; remoteDonations: number };
}

export interface OrgMemberRow {
  id: string;
  name: string;
  workEmail: string;
  employeeId: string | null;
  role: 'member' | 'admin';
  status: 'pending_email' | 'active';
  joinedAt: string;
}

export interface OrgAnnouncement {
  id: string;
  kind: 'announcement' | 'camp';
  title: string;
  body: string;
  campDate: string | null;
  place: string | null;
  createdAt: string;
  sentTo?: number;
}

export interface PartnerBloodBank {
  id: string;
  name: string;
  address: string | null;
  city: string;
  district: string;
  state: string;
  phone: string | null;
  sameDistrict?: boolean;
  licenceNo?: string | null;
  active?: boolean;
}

export interface RemoteSummary {
  pledged: number;
  donated: number;
  confirmed: number;
  mine: { id: string; status: 'pledged' | 'donated' | 'confirmed'; bloodBank: string; donationRef: string | null } | null;
}

export interface RemoteCredit {
  id: string;
  status: 'donated' | 'confirmed';
  bloodBank: string;
  donationRef: string | null;
  donatedAt: string | null;
}
