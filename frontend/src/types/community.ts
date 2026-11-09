/** Communities v1: a tag donors add to themselves. Other people only ever see counts (small counts hidden). */
export type CommunityType = 'gated' | 'villa' | 'apartment' | 'college' | 'company' | 'worship' | 'club' | 'other';

export const COMMUNITY_TYPE_LABELS: Record<CommunityType, string> = {
  gated: 'Gated community',
  villa: 'Villa community',
  apartment: 'Apartment',
  college: 'College / university',
  company: 'Company / office',
  worship: 'Place of worship',
  club: 'Club / group',
  other: 'Other group',
};

/** Exact count when 3 or more; otherwise null with the label "fewer than 3" */
export interface SafeCount {
  count: number | null;
  label: string;
}

export interface Community {
  id: string;
  name: string;
  type: CommunityType;
  country: string;
  state: string;
  district: string;
  city: string;
  locality: string | null;
  pinCode: string | null;
  claimed: boolean;
}

export interface CommunitySearchResult extends Community {
  members: SafeCount;
}

export interface NearbyCommunity extends Community {
  samePin: boolean;
  /** Members who could donate for this blood group right now */
  ready: SafeCount;
  members: SafeCount;
}

export interface MyCommunity extends Community {
  membership: {
    alertNearby: boolean;
    alertFromMembers: boolean;
    muted: boolean;
    isAlumni: boolean;
    status: 'active' | 'stale';
    confirmedAt: string;
    needsConfirm: boolean;
  };
}

export interface CreateCommunityInput {
  name: string;
  type: CommunityType;
  country?: string;
  state: string;
  district: string;
  city: string;
  locality?: string;
  pinCode?: string;
}
