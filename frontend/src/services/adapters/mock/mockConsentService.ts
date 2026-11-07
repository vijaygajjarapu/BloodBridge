import type { ConsentService } from '../contracts';
import type { PaginatedResult } from '../../../types/api';
import type {
  UserConsentPreferences,
  ConsentRecord,
  ConsentHistoryItem,
} from '../../../types/consent';
import { mockStore, delay } from './mockStore';
import { appConfig } from '../../../constants/config';

export class MockConsentService implements ConsentService {
  async getConsentPreferences(): Promise<UserConsentPreferences> {
    await delay(150);
    return { ...mockStore.consentPreferences };
  }

  async updateConsent(update: {
    contactSharingAllowed?: boolean;
    emergencyBroadcastAllowed?: boolean;
    smsNotificationsAllowed?: boolean;
  }): Promise<UserConsentPreferences> {
    await delay(250);

    const now = new Date().toISOString();
    const actionDesc =
      update.contactSharingAllowed !== undefined
        ? update.contactSharingAllowed
          ? 'Re-authorized contact access for emergency blood drives'
          : 'Withdrew general contact disclosure consent'
        : 'Updated communication preferences';

    const historyItem: ConsentHistoryItem = {
      id: `csh_${Date.now()}`,
      action: update.contactSharingAllowed === false ? 'withdrawn' : 'updated',
      purpose: actionDesc,
      timestamp: now,
      policyVersion: appConfig.currentPolicyVersion,
      ipAddressMasked: '127.0.***.***',
    };

    mockStore.consentPreferences = {
      ...mockStore.consentPreferences,
      ...update,
      lastUpdated: now,
      history: [historyItem, ...mockStore.consentPreferences.history],
    };

    // If current user is Marcus, update matching donor contact sharing
    const marcusDonor = mockStore.donors.find((d) => d.id === 'dnr_101');
    if (marcusDonor && update.contactSharingAllowed !== undefined) {
      marcusDonor.canAccessContact = update.contactSharingAllowed;
      marcusDonor.contactSharingConsentGranted = update.contactSharingAllowed;
    }

    return { ...mockStore.consentPreferences };
  }

  async listConsentsAdmin(params: {
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<ConsentRecord>> {
    await delay(200);

    const records: ConsentRecord[] = mockStore.donors.map((d, index) => ({
      id: `csr_${d.id}`,
      userId: d.id,
      userName: d.name,
      phoneMasked: d.canAccessContact ? '+91 ••••• •' + (index + 1000) : 'Protected / Masked',
      status: d.contactSharingConsentGranted ? 'granted' : 'withdrawn',
      policyVersion: appConfig.currentPolicyVersion,
      grantedAt: d.registeredAt,
      withdrawnAt: !d.contactSharingConsentGranted ? '2026-03-01T10:00:00Z' : undefined,
      withdrawalReason: !d.contactSharingConsentGranted ? 'Donor chose emergency-only coordinator proxy' : undefined,
    }));

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (page - 1) * pageSize;

    return {
      data: records.slice(startIndex, startIndex + pageSize),
      total: records.length,
      page,
      pageSize,
      totalPages: Math.ceil(records.length / pageSize) || 1,
    };
  }
}

export const mockConsentService = new MockConsentService();
