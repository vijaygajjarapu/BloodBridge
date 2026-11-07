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
import { mockStore, delay } from './mockStore';

export class MockAdminService implements AdminService {
  async getOverviewMetrics(): Promise<AdminOverviewMetrics> {
    await delay(200);
    return { ...mockStore.adminMetrics };
  }

  async listUsers(params: {
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<AdminUser>> {
    await delay(200);
    let list = [...mockStore.adminUsers];

    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter((u) => u.name.toLowerCase().includes(q) || u.phone.includes(q) || u.email?.toLowerCase().includes(q));
    }

    if (params.status && params.status !== 'ALL') {
      list = list.filter((u) => u.status === params.status);
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (page - 1) * pageSize;

    return {
      data: list.slice(startIndex, startIndex + pageSize),
      total: list.length,
      page,
      pageSize,
      totalPages: Math.ceil(list.length / pageSize) || 1,
    };
  }

  async updateUserStatus(userId: string, status: 'active' | 'suspended' | 'pending'): Promise<AdminUser> {
    await delay(250);
    const user = mockStore.adminUsers.find((u) => u.id === userId);
    if (!user) {
      throw { code: 'USER_NOT_FOUND', message: `User ${userId} not found.` };
    }
    user.status = status;

    mockStore.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      actorId: mockStore.adminUser.id,
      actorName: mockStore.adminUser.name,
      actorRole: 'Admin',
      action: 'USER_STATUS_CHANGE',
      entityType: 'user',
      entityId: userId,
      details: `Changed account status of ${user.name} to ${status}.`,
      timestamp: new Date().toISOString(),
      ipAddress: '127.0.0.1 (demo)',
    });

    return { ...user };
  }

  async listDonors(params: DonorListParams): Promise<PaginatedResult<AdminDonor>> {
    await delay(200);
    let list: AdminDonor[] = mockStore.donors.map((d) => ({
      id: d.id,
      name: d.name,
      phone: d.contactNumber || '+91 90000 10000',
      email: d.email,
      bloodGroup: d.bloodGroup,
      state: d.location.state,
      district: d.location.district,
      city: d.location.city,
      status: d.status,
      consentStatus: d.contactSharingConsentGranted ? 'granted' : 'withdrawn',
      referredBy: d.referredByCode,
      registeredAt: d.registeredAt,
      notes: d.notes,
    }));

    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter((d) => d.name.toLowerCase().includes(q) || d.city.toLowerCase().includes(q) || d.district.toLowerCase().includes(q));
    }

    if (params.bloodGroup && params.bloodGroup !== 'ALL') {
      list = list.filter((d) => d.bloodGroup === params.bloodGroup);
    }

    if (params.status && params.status !== 'ALL') {
      list = list.filter((d) => d.status === params.status);
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (page - 1) * pageSize;

    return {
      data: list.slice(startIndex, startIndex + pageSize),
      total: list.length,
      page,
      pageSize,
      totalPages: Math.ceil(list.length / pageSize) || 1,
    };
  }

  async updateDonorRecord(donorId: string, updates: Partial<AdminDonor>): Promise<AdminDonor> {
    await delay(250);
    const donor = mockStore.donors.find((d) => d.id === donorId);
    if (!donor) {
      throw { code: 'DONOR_NOT_FOUND', message: `Donor ${donorId} not found.` };
    }

    if (updates.name) donor.name = updates.name;
    if (updates.bloodGroup) donor.bloodGroup = updates.bloodGroup;
    if (updates.status) donor.status = updates.status;
    if (updates.notes) donor.notes = updates.notes;
    if (updates.state || updates.district || updates.city) {
      donor.location = {
        state: updates.state || donor.location.state,
        district: updates.district || donor.location.district,
        city: updates.city || donor.location.city,
      };
    }

    mockStore.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      actorId: mockStore.adminUser.id,
      actorName: mockStore.adminUser.name,
      actorRole: 'Admin',
      action: 'DONOR_RECORD_UPDATED',
      entityType: 'donor',
      entityId: donorId,
      details: `Administrative correction applied for donor ${donor.name}.`,
      timestamp: new Date().toISOString(),
      ipAddress: '127.0.0.1 (demo)',
    });

    return {
      id: donor.id,
      name: donor.name,
      phone: donor.contactNumber || '+91 90000 10000',
      email: donor.email,
      bloodGroup: donor.bloodGroup,
      state: donor.location.state,
      district: donor.location.district,
      city: donor.location.city,
      status: donor.status,
      consentStatus: donor.contactSharingConsentGranted ? 'granted' : 'withdrawn',
      referredBy: donor.referredByCode,
      registeredAt: donor.registeredAt,
      notes: donor.notes,
    };
  }

  async listReferrals(params: {
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<PaginatedResult<AdminReferralItem>> {
    await delay(150);
    let list = [...mockStore.adminReferrals];

    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter((r) => r.code.toLowerCase().includes(q) || r.ownerName.toLowerCase().includes(q));
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (page - 1) * pageSize;

    return {
      data: list.slice(startIndex, startIndex + pageSize),
      total: list.length,
      page,
      pageSize,
      totalPages: Math.ceil(list.length / pageSize) || 1,
    };
  }

  async toggleReferralCode(referralId: string, isActive: boolean): Promise<AdminReferralItem> {
    await delay(200);
    const item = mockStore.adminReferrals.find((r) => r.id === referralId);
    if (!item) {
      throw { code: 'REFERRAL_NOT_FOUND', message: `Referral code ${referralId} not found.` };
    }
    item.isActive = isActive;

    mockStore.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      actorId: mockStore.adminUser.id,
      actorName: mockStore.adminUser.name,
      actorRole: 'Admin',
      action: isActive ? 'REFERRAL_ACTIVATED' : 'REFERRAL_SUSPENDED',
      entityType: 'referral',
      entityId: referralId,
      details: `${isActive ? 'Enabled' : 'Disabled'} referral code ${item.code}.`,
      timestamp: new Date().toISOString(),
      ipAddress: '127.0.0.1 (demo)',
    });

    return { ...item };
  }

  async listAuditLogs(params: {
    entityType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<AuditLogEntry>> {
    await delay(150);
    let list = [...mockStore.auditLogs];

    if (params.entityType && params.entityType !== 'ALL') {
      list = list.filter((l) => l.entityType === params.entityType);
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (page - 1) * pageSize;

    return {
      data: list.slice(startIndex, startIndex + pageSize),
      total: list.length,
      page,
      pageSize,
      totalPages: Math.ceil(list.length / pageSize) || 1,
    };
  }

  async getSettings(): Promise<OrganizationSettings> {
    await delay(150);
    return { ...mockStore.orgSettings };
  }

  async updateSettings(settings: Partial<OrganizationSettings>): Promise<OrganizationSettings> {
    await delay(250);
    mockStore.orgSettings = {
      ...mockStore.orgSettings,
      ...settings,
    };

    mockStore.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      actorId: mockStore.adminUser.id,
      actorName: mockStore.adminUser.name,
      actorRole: 'Admin',
      action: 'ORGANIZATION_SETTINGS_UPDATED',
      entityType: 'system',
      entityId: 'org_settings',
      details: 'Updated organization contact and registration preferences.',
      timestamp: new Date().toISOString(),
      ipAddress: '127.0.0.1 (demo)',
    });

    return { ...mockStore.orgSettings };
  }
}

export const mockAdminService = new MockAdminService();
