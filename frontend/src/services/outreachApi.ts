/** Phone and SMS outreach: donor choices, one-tap links, masked calls (needs the live backend) */
import { apiClient } from './api/client';

export interface OutreachStatus {
  smsAlerts: boolean;
  maskedCalls: boolean;
  alertCalls: boolean;
}

export interface ReachPrefs {
  alertBySms: boolean;
  alertByCall: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietAllowCritical: boolean;
  available: OutreachStatus;
}

export interface QuickView {
  requestId: string;
  donorFirstName: string;
  requesterFirstName: string;
  bloodGroup: string;
  component: string;
  unitsNeeded: number;
  hospitalName: string;
  hospitalArea: string | null;
  city: string;
  urgency: string;
  neededBy: string | null;
  live: boolean;
  myResponse: string | null;
  requesterPhone: string | null;
  maskedCallAvailable: boolean;
}

export const outreachApi = {
  status: () => apiClient.get<OutreachStatus>('/outreach/status'),
  myPrefs: () => apiClient.get<ReachPrefs>('/outreach/me'),
  savePrefs: (p: Partial<Omit<ReachPrefs, 'available'>>) => apiClient.put<ReachPrefs>('/outreach/me', p),
  quickView: (token: string) => apiClient.get<QuickView>(`/outreach/quick/${encodeURIComponent(token)}`),
  quickRespond: (token: string, action: 'accept' | 'decline') =>
    apiClient.post<QuickView>(`/outreach/quick/${encodeURIComponent(token)}`, { action }),
  callFamily: (requestId: string) => apiClient.post<{ message: string }>(`/outreach/requests/${requestId}/call-family`),
  callDonor: (requestId: string, responseId: string) =>
    apiClient.post<{ message: string }>(`/outreach/requests/${requestId}/responses/${responseId}/call`),
};
