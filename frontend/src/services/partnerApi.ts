/** Partner programmes: insurers, banks, colleges and big groups sponsor Family Safety Circle (needs the live backend) */
import { apiClient } from './api/client';
import type { SafeCount } from '../types/community';

export type PartnerType = 'insurer' | 'term_insurer' | 'bank' | 'college' | 'employer' | 'group' | 'ngo' | 'other';

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  insurer: 'Health insurer',
  term_insurer: 'Term / life insurer',
  bank: 'Bank',
  college: 'College / university',
  employer: 'Employer',
  group: 'Large group / association',
  ngo: 'NGO / foundation',
  other: 'Other',
};

export interface PartnerCodeInfo {
  code: string;
  name: string;
  partnerType: PartnerType;
  monthsFree: number;
  available: boolean;
  reason: string | null;
}

export interface PartnerProgram {
  id: string;
  name: string;
  partnerType: PartnerType;
  code: string;
  seats: number;
  monthsFree: number;
  startsAt: string;
  endsAt: string | null;
  active: boolean;
  contactName: string | null;
  contactEmail: string | null;
  createdAt: string;
  redeemed: number;
  status: 'open' | 'full' | 'ended' | 'paused';
  endingSoon: boolean;
}

export interface PartnerReport {
  id: string;
  name: string;
  partnerType: PartnerType;
  code: string;
  seats: number;
  redeemed: number;
  familiesSetUp: SafeCount;
  donorsPledged: SafeCount;
  emergenciesPosted: SafeCount;
  emergenciesFulfilled: SafeCount;
  generatedAt: string;
}

export const partnerApi = {
  lookup: (code: string) => apiClient.get<PartnerCodeInfo>(`/partners/code/${encodeURIComponent(code.trim())}`),
  redeem: (code: string) => apiClient.post<{ success: boolean; sponsoredBy: string; startsAt: string; endsAt: string }>('/partners/redeem', { code }),
  mine: () => apiClient.get<{ name: string; partnerType: PartnerType; endsAt: string } | null>('/partners/mine'),
  // BloodBridge staff
  adminList: () => apiClient.get<PartnerProgram[]>('/partners/admin'),
  adminCreate: (input: { name: string; partnerType: PartnerType; code?: string; seats: number; monthsFree?: number; endsAt?: string | null; contactName?: string; contactEmail?: string }) =>
    apiClient.post<PartnerProgram>('/partners/admin', input),
  adminUpdate: (id: string, change: { active?: boolean; seats?: number; monthsFree?: number; endsAt?: string | null }) =>
    apiClient.patch<PartnerProgram>(`/partners/admin/${id}`, change),
  report: (id: string) => apiClient.get<PartnerReport>(`/partners/admin/${id}/report`),
};
