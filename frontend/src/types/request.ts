import type { BloodGroup } from './donor';

export type RequestStatus =
  | 'submitted'
  | 'open'
  | 'donors_notified'
  | 'donor_found'
  | 'in_progress'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'cancelled'
  | 'expired'
  | 'closed';

export type VerificationStatus = 'unverified' | 'pending_review' | 'verified' | 'rejected';
export type Urgency = 'critical' | 'urgent' | 'planned';
export type BloodComponent = 'whole_blood' | 'red_cells' | 'platelets' | 'plasma';

export interface RequestResponseItem {
  id: string;
  donorFirstName: string;
  donorBloodGroup: BloodGroup | null;
  /** Blood group confirmed by our team */
  donorBloodGroupVerified?: boolean;
  status: 'accepted' | 'donated';
  /** Hidden unless the donor chose to share their number for this request */
  phone: string | null;
  phoneHidden: boolean;
  respondedAt: string;
}

/** Live progress of smart matching (requester only; counts, never names) */
export interface MatchingSummary {
  wave: number;
  contacted: number;
  viewed: number;
  accepted: number;
  declined: number;
  waiting: number;
  nextWaveAt: string | null;
  /** Donors contacted because of a community (counts only) */
  fromCommunities?: number;
}

export interface BloodRequest {
  id: string;
  publicCode: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  unitsNeeded: number;
  unitsFulfilled: number;
  hospitalName: string;
  hospitalArea: string | null;
  hospitalPinCode: string | null;
  country: string;
  state: string;
  district: string;
  city: string;
  urgency: Urgency;
  neededBy: string | null;
  notes: string | null;
  status: RequestStatus;
  verificationStatus: VerificationStatus;
  onHold: boolean;
  holdReason: string | null;
  donorsNotified: number;
  /** Patient document checks: none, checking, passed, warnings, failed */
  documentStatus?: 'none' | 'checking' | 'passed' | 'warnings' | 'failed';
  // Fraud details (admin only)
  riskScore?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  riskFlags?: { code: string; label: string; points: number }[];
  reportCount?: number;
  /** Only right after posting: how many of your saved donors were alerted */
  savedDonorsAlerted?: number;
  createdAt: string;
  updatedAt: string;
  allowedNextStatuses: RequestStatus[];
  // requester view
  patientName?: string;
  isRequester?: boolean;
  acceptedCount?: number;
  matching?: MatchingSummary;
  responses?: RequestResponseItem[];
  // donor view
  requesterFirstName?: string;
  myResponse?: { status: string; shareDirectNumber: boolean } | string | null;
  canRespond?: boolean;
  cannotRespondReason?: string | null;
  requesterPhone?: string | null;
  // admin view
  requesterName?: string;
  requesterEmail?: string;
  requesterPhoneAdmin?: string;
}

export interface CreateRequestInput {
  patientName: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  unitsNeeded: number;
  hospitalName: string;
  hospitalArea?: string;
  hospitalPinCode?: string;
  country: string;
  state: string;
  district: string;
  city: string;
  urgency: Urgency;
  neededBy?: string | null;
  notes?: string;
  /** Communities near the hospital to alert too */
  alertCommunityIds?: string[];
}

export interface DonorCounts {
  bloodGroup: BloodGroup;
  area: { country: string; state: string; district: string | null };
  exactMatch: number;
  compatible: number;
  availableNow: number;
  compatibleGroups: BloodGroup[];
}

export interface PublicRequest {
  publicCode: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  unitsNeeded: number;
  unitsFulfilled: number;
  hospitalName: string;
  hospitalArea: string | null;
  hospitalPinCode: string | null;
  city: string;
  district: string;
  state: string;
  urgency: Urgency;
  neededBy: string | null;
  status: RequestStatus;
  isLive: boolean;
  paused: boolean;
  compatibleDonorGroups: BloodGroup[];
  createdAt: string;
  viewer: {
    signedIn: boolean;
    isRequester?: boolean;
    canRespond?: boolean;
    cannotRespondReason?: string | null;
    requestId?: string;
  };
}

export interface DocumentCheck {
  code: string;
  label: string;
  outcome: 'pass' | 'warn' | 'fail' | 'info';
}

export interface RequestDocumentItem {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  result: 'checking' | 'passed' | 'warnings' | 'failed';
  checks: DocumentCheck[];
  uploadedAt: string;
}

export type ReportReason = 'money_demanded' | 'fake_request' | 'wrong_number' | 'other';

export interface HospitalSuggestion {
  id: string;
  name: string;
  area: string | null;
  city: string | null;
  district: string;
  state: string;
  pinCode: string | null;
  /** Hospital in the PIN code that was typed */
  samePin: boolean;
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: 'Submitted',
  open: 'Open',
  donors_notified: 'Donors alerted',
  donor_found: 'Donor found',
  in_progress: 'In progress',
  partially_fulfilled: 'Partly fulfilled',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  expired: 'Expired',
  closed: 'Closed',
};

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  unverified: 'Not verified yet',
  pending_review: 'Under review',
  verified: 'Verified',
  rejected: 'Not approved',
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  critical: 'Critical (within hours)',
  urgent: 'Urgent (within 1–2 days)',
  planned: 'Planned (surgery / scheduled)',
};

export const COMPONENT_LABELS: Record<BloodComponent, string> = {
  whole_blood: 'Whole blood',
  red_cells: 'Red cells (PRBC)',
  platelets: 'Platelets',
  plasma: 'Plasma',
};
