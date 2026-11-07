import type { AdminService } from '../contracts';
import type { PaginatedResult } from '../../../types/api';
import type { DonorListParams } from '../../../types/donor';
import type {
  AdminOverviewMetrics,
  AdminUser,
  AdminDonor,
  AdminReferralItem,
  AuditLogEntry,
  OrganizationSettings,
} from '../../../types/admin';
import { apiClient } from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';

export class HttpAdminService implements AdminService {
  async getOverviewMetrics(country?: string): Promise<AdminOverviewMetrics> {
    const qs = country && country !== 'ALL' ? `?country=${encodeURIComponent(country)}` : '';
    return apiClient.get<AdminOverviewMetrics>(`${ENDPOINTS.ADMIN_METRICS}${qs}`);
  }

  async listUsers(params: {
    search?: string;
    status?: string;
    country?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<AdminUser>> {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.country && params.country !== 'ALL') q.set('country', params.country);
    if (params.status) q.set('status', params.status);
    if (params.page) q.set('page', params.page.toString());
    if (params.pageSize) q.set('pageSize', params.pageSize.toString());
    const qs = q.toString();
    return apiClient.get<PaginatedResult<AdminUser>>(`${ENDPOINTS.ADMIN_USERS}${qs ? `?${qs}` : ''}`);
  }

  async updateUserStatus(userId: string, status: 'active' | 'suspended' | 'pending'): Promise<AdminUser> {
    return apiClient.patch<AdminUser>(ENDPOINTS.ADMIN_USER_STATUS(userId), { status });
  }

  async listDonors(params: DonorListParams): Promise<PaginatedResult<AdminDonor>> {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.bloodGroup && params.bloodGroup !== 'ALL') q.set('bloodGroup', params.bloodGroup);
    if (params.status && params.status !== 'ALL') q.set('status', params.status);
    if (params.country && params.country !== 'ALL') q.set('country', params.country);
    if (params.state) q.set('state', params.state);
    if (params.district) q.set('district', params.district);
    if (params.page) q.set('page', params.page.toString());
    if (params.pageSize) q.set('pageSize', params.pageSize.toString());
    const qs = q.toString();
    return apiClient.get<PaginatedResult<AdminDonor>>(`${ENDPOINTS.ADMIN_DONORS}${qs ? `?${qs}` : ''}`);
  }

  async updateDonorRecord(donorId: string, updates: Partial<AdminDonor>): Promise<AdminDonor> {
    return apiClient.patch<AdminDonor>(ENDPOINTS.ADMIN_DONOR_UPDATE(donorId), updates);
  }

  async listReferrals(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    country?: string;
  }): Promise<PaginatedResult<AdminReferralItem>> {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.country && params.country !== 'ALL') q.set('country', params.country);
    if (params.page) q.set('page', params.page.toString());
    if (params.pageSize) q.set('pageSize', params.pageSize.toString());
    const qs = q.toString();
    return apiClient.get<PaginatedResult<AdminReferralItem>>(`${ENDPOINTS.ADMIN_REFERRALS}${qs ? `?${qs}` : ''}`);
  }

  async toggleReferralCode(referralId: string, isActive: boolean): Promise<AdminReferralItem> {
    return apiClient.patch<AdminReferralItem>(ENDPOINTS.ADMIN_REFERRAL_TOGGLE(referralId), { isActive });
  }

  async listAuditLogs(params: {
    entityType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<AuditLogEntry>> {
    const q = new URLSearchParams();
    if (params.entityType && params.entityType !== 'ALL') q.set('entityType', params.entityType);
    if (params.page) q.set('page', params.page.toString());
    if (params.pageSize) q.set('pageSize', params.pageSize.toString());
    const qs = q.toString();
    return apiClient.get<PaginatedResult<AuditLogEntry>>(`${ENDPOINTS.ADMIN_AUDIT_LOGS}${qs ? `?${qs}` : ''}`);
  }

  async getSettings(): Promise<OrganizationSettings> {
    return apiClient.get<OrganizationSettings>(ENDPOINTS.ADMIN_SETTINGS);
  }

  async updateSettings(settings: Partial<OrganizationSettings>): Promise<OrganizationSettings> {
    return apiClient.put<OrganizationSettings>(ENDPOINTS.ADMIN_SETTINGS, settings);
  }
}

export const httpAdminService = new HttpAdminService();
