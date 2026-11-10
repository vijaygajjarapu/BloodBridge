/** Communities v1: a tag donors add to themselves. Other people only ever see counts (small counts hidden). */
export type CommunityType = 'gated' | 'villa' | 'apartment' | 'college' | 'company' | 'worship' | 'club' | 'whatsapp' | 'association' | 'other';

export const COMMUNITY_TYPE_LABELS: Record<CommunityType, string> = {
  gated: 'Gated community',
  villa: 'Villa community',
  apartment: 'Apartment',
  college: 'College / university',
  company: 'Company / office',
  worship: 'Place of worship',
  club: 'Club / group',
  whatsapp: 'WhatsApp / family group',
  association: 'Association / union / alumni',
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

/** A group's shareable invite link (e.g. to post in a WhatsApp group) */
export interface GroupInvite {
  code: string;
  url: string;
  whatsappUrl: string;
  message: string;
}

/** What someone sees when they open a group's invite link */
export interface GroupInvitePreview extends Community {
  members: SafeCount;
  isMember: boolean;
  /** WhatsApp group, association, club, place of worship: people who know each other */
  peopleGroup: boolean;
}
