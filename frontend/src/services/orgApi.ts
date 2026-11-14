/** Organisations and "donate here, save a life there" (needs the live backend) */
import { apiClient } from './api/client';
import type {
  MyOrganisation, Organisation, OrgDashboard, OrgMemberRow, OrgAnnouncement, PartnerBloodBank, RemoteSummary, RemoteCredit, OrgType,
  EligibilityList, EligibilityUploadResult, LinkCompanyInput,
} from '../types/organisation';

export const orgApi = {
  mine: () => apiClient.get<MyOrganisation[]>('/organisations/mine'),
  byCode: (code: string) => apiClient.get<Organisation>(`/organisations/by-code/${encodeURIComponent(code)}`),
  /** "Bring BloodNation to my company": only a request; staff add the company after the contract */
  requestCompany: (input: { name: string; type: OrgType; contactName: string; contactEmail: string; contactPhone?: string; country?: string; state: string; district: string; city: string }) =>
    apiClient.post<{ requested: boolean; org: Organisation }>('/organisations/request', input),
  /** Link my company: employee ID + date of birth (linked at once), or a code to the work email on the employee list */
  link: (input: LinkCompanyInput) =>
    apiClient.post<MyOrganisation[] | { pending: boolean; workEmail: string; org: Organisation }>('/organisations/link', input),
  verifyEmail: (orgId: string, code: string) => apiClient.post<MyOrganisation[]>(`/organisations/${orgId}/verify-email`, { code }),
  resendCode: (orgId: string) => apiClient.post<{ sent: boolean }>(`/organisations/${orgId}/resend-code`),
  leave: (orgId: string) => apiClient.post<MyOrganisation[]>(`/organisations/${orgId}/leave`),
  setCountInImpact: (orgId: string, countInImpact: boolean) => apiClient.patch<MyOrganisation[]>(`/organisations/${orgId}/me`, { countInImpact }),
  announcements: (orgId: string) => apiClient.get<OrgAnnouncement[]>(`/organisations/${orgId}/announcements`),
  // Organisation admin
  dashboard: (orgId: string) => apiClient.get<OrgDashboard>(`/organisations/${orgId}/dashboard`),
  members: (orgId: string) => apiClient.get<OrgMemberRow[]>(`/organisations/${orgId}/members`),
  updateMember: (orgId: string, memberId: string, change: { role?: 'member' | 'admin'; remove?: boolean }) =>
    apiClient.patch<OrgMemberRow[]>(`/organisations/${orgId}/members/${memberId}`, change),
  eligibility: (orgId: string) => apiClient.get<EligibilityList>(`/organisations/${orgId}/eligibility`),
  uploadEligibility: (orgId: string, rows: { employeeId: string; dateOfBirth: string; workEmail?: string }[], fullList: boolean) =>
    apiClient.post<EligibilityUploadResult>(`/organisations/${orgId}/eligibility`, { rows, fullList }),
  exits: (orgId: string, rows: { key: string; exitDate: string }[]) =>
    apiClient.post<{ results: { key: string; result: string }[]; done: number; problems: number }>(`/organisations/${orgId}/exits`, { rows }),
  announce: (orgId: string, input: { kind: 'announcement' | 'camp'; title: string; body: string; campDate?: string; place?: string }) =>
    apiClient.post<{ id: string; sentTo: number }>(`/organisations/${orgId}/announcements`, input),
  // BloodNation staff
  adminAll: () =>
    apiClient.get<(Organisation & { plan: string; inviteCode: string; members: number; createdAt: string; contact: { name: string | null; email: string | null; phone: string | null } })[]>(
      '/organisations/admin/all',
    ),
  adminAddOrgAdmin: (orgId: string, identifier: string) => apiClient.post<{ added: boolean; name: string }>(`/organisations/admin/${orgId}/admins`, { identifier }),
  adminUpdate: (orgId: string, change: { verified?: boolean; plan?: string; emailDomains?: string[] }) => apiClient.patch<Organisation>(`/organisations/admin/${orgId}`, change),
};

export const remoteApi = {
  banks: (q: { state?: string; district?: string }) =>
    apiClient.get<PartnerBloodBank[]>(`/remote-donations/banks?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString()}`),
  summary: (requestId: string) => apiClient.get<RemoteSummary>(`/remote-donations/requests/${requestId}`),
  credits: (requestId: string) => apiClient.get<RemoteCredit[]>(`/remote-donations/requests/${requestId}/credits`),
  pledge: (requestId: string, bloodBankId: string) => apiClient.post<RemoteSummary>(`/remote-donations/requests/${requestId}/pledge`, { bloodBankId }),
  donated: (requestId: string, donationRef: string) => apiClient.post<RemoteSummary>(`/remote-donations/requests/${requestId}/donated`, { donationRef }),
  cancel: (requestId: string) => apiClient.post<RemoteSummary>(`/remote-donations/requests/${requestId}/cancel`),
  // BloodNation staff
  adminQueue: () =>
    apiClient.get<{ id: string; requestId: string; donor: string; donorPhone: string | null; bloodBank: string; bloodBankPhone: string | null; donationRef: string | null; donatedAt: string }[]>('/remote-donations/admin/queue'),
  adminConfirm: (id: string, ok: boolean) => apiClient.post<{ ok: boolean }>(`/remote-donations/admin/${id}/confirm`, { ok }),
  adminBanks: () => apiClient.get<PartnerBloodBank[]>('/remote-donations/admin/banks'),
  adminSaveBank: (b: Partial<PartnerBloodBank> & { name: string; city: string; district: string; state: string }) =>
    apiClient.post<PartnerBloodBank>('/remote-donations/admin/banks', b),
};
