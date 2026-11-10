/** Emergency blood requests (needs the live backend, VITE_APP_MODE=api) */
import { apiClient } from './api/client';
import type {
  BloodRequest,
  CreateRequestInput,
  DonorCounts,
  HospitalSuggestion,
  PublicRequest,
  ReportReason,
  RequestDocumentItem,
  RequestStatus,
} from '../types/request';
import { appConfig } from '../constants/config';

const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });

export const requestApi = {
  create: (input: CreateRequestInput) => apiClient.post<BloodRequest>('/requests', input),
  mine: () => apiClient.get<BloodRequest[]>('/requests/mine'),
  forMe: () => apiClient.get<{ hasProfile: boolean; myBloodGroup?: string; items: BloodRequest[] }>('/requests/for-me'),
  get: (id: string) => apiClient.get<BloodRequest>(`/requests/${id}`),
  /** Requester: contact the next group of ranked donors now */
  alertMore: (id: string) => apiClient.post<BloodRequest>(`/requests/${id}/alert-more`),
  respond: (id: string, action: 'accept' | 'decline' | 'withdraw', shareDirectNumber = false) =>
    apiClient.post<BloodRequest>(`/requests/${id}/respond`, { action, shareDirectNumber }),
  setStatus: (id: string, status: RequestStatus) => apiClient.patch<BloodRequest>(`/requests/${id}/status`, { status }),
  markDonated: (id: string, responseId: string) => apiClient.post<BloodRequest>(`/requests/${id}/responses/${responseId}/donated`),
  donorCounts: (q: { bloodGroup: string; country: string; state: string; district?: string }) => {
    const params = new URLSearchParams({ bloodGroup: q.bloodGroup, country: q.country, state: q.state });
    if (q.district) params.set('district', q.district);
    return apiClient.get<DonorCounts>(`/requests/donor-counts?${params.toString()}`);
  },
  hospitals: (q: { country: string; state: string; district?: string; pinCode?: string; search?: string }) => {
    const params = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v && params.set(k, v));
    return apiClient.get<HospitalSuggestion[]>(`/requests/hospitals?${params.toString()}`);
  },
  uploadDocument: async (id: string, file: File) =>
    apiClient.post<RequestDocumentItem[]>(`/requests/${id}/documents`, {
      fileName: file.name,
      mimeType: file.type,
      dataBase64: await readAsBase64(file),
    }),
  documents: (id: string) => apiClient.get<RequestDocumentItem[]>(`/requests/${id}/documents`),
  adminDocuments: (id: string) => apiClient.get<RequestDocumentItem[]>(`/requests/admin/${id}/documents`),
  /** Opens a document in a new tab (the file needs the sign-in token, so it is fetched first) */
  openDocument: async (id: string, docId: string) => {
    const win = window.open('', '_blank');
    const res = await fetch(`${appConfig.apiBaseUrl}/requests/${id}/documents/${docId}/file`, {
      headers: { Authorization: `Bearer ${apiClient.getToken() || localStorage.getItem('bloodbridge_auth_token') || ''}` },
    });
    if (!res.ok) {
      win?.close();
      throw new Error('Could not open the document.');
    }
    const url = URL.createObjectURL(await res.blob());
    if (win) win.location.href = url;
    else window.open(url, '_blank');
  },
  report: (id: string, reason: ReportReason, details?: string) =>
    apiClient.post<{ success: boolean; alreadyReported: boolean; message: string }>(`/requests/${id}/report`, { reason, details }),
  getPublic: (code: string) => apiClient.get<PublicRequest>(`/requests/public/${encodeURIComponent(code)}`),
  // admin
  adminList: (q: { status?: string; verification?: string; country?: string; page?: number; pageSize?: number }) => {
    const params = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== undefined && v !== '' && params.set(k, String(v)));
    return apiClient.get<{ items: BloodRequest[]; total: number; page: number; totalPages: number }>(`/requests/admin/all?${params.toString()}`);
  },
  adminVerify: (id: string, verificationStatus: string, note?: string) =>
    apiClient.patch<{ success: boolean }>(`/requests/admin/${id}/verification`, { verificationStatus, note }),
  adminHold: (id: string, onHold: boolean, reason?: string) =>
    apiClient.patch<{ success: boolean }>(`/requests/admin/${id}/hold`, { onHold, reason }),
};
