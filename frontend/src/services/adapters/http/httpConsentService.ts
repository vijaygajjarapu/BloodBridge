import type { ConsentService } from '../contracts';
import type { PaginatedResult } from '../../../types/api';
import type { UserConsentPreferences, ConsentRecord } from '../../../types/consent';
import { apiClient } from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';

export class HttpConsentService implements ConsentService {
  async getConsentPreferences(): Promise<UserConsentPreferences> {
    const res = await apiClient.get<any>(ENDPOINTS.CONSENT_PREFERENCES);
    return {
      contactSharingAllowed: Boolean(res.contactSharingAllowed),
      emergencyBroadcastAllowed: Boolean(res.emergencyBroadcastAllowed ?? true),
      smsNotificationsAllowed: Boolean(res.smsNotificationsAllowed ?? true),
      lastUpdated: res.lastUpdated || new Date().toISOString(),
      activePolicyVersion: res.activePolicyVersion || 'v2.4-2026',
      history: Array.isArray(res.history) ? res.history : [],
    };
  }

  async updateConsent(update: {
    contactSharingAllowed?: boolean;
    emergencyBroadcastAllowed?: boolean;
    smsNotificationsAllowed?: boolean;
  }): Promise<UserConsentPreferences> {
    const res = await apiClient.patch<any>(ENDPOINTS.CONSENT_PREFERENCES, update);
    return {
      contactSharingAllowed: Boolean(res.contactSharingAllowed),
      emergencyBroadcastAllowed: Boolean(res.emergencyBroadcastAllowed ?? true),
      smsNotificationsAllowed: Boolean(res.smsNotificationsAllowed ?? true),
      lastUpdated: res.lastUpdated || new Date().toISOString(),
      activePolicyVersion: res.activePolicyVersion || 'v2.4-2026',
      history: Array.isArray(res.history) ? res.history : [],
    };
  }

  async listConsentsAdmin(params: {
    status?: string;
    country?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<ConsentRecord>> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.country && params.country !== 'ALL') query.set('country', params.country);
    if (params.page) query.set('page', params.page.toString());
    if (params.pageSize) query.set('pageSize', params.pageSize.toString());

    const qs = query.toString();
    return apiClient.get<PaginatedResult<ConsentRecord>>(`${ENDPOINTS.ADMIN_CONSENTS}${qs ? `?${qs}` : ''}`);
  }
}

export const httpConsentService = new HttpConsentService();
