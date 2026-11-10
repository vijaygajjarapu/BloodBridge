/** Donor eligibility self-check (needs the live backend) */
import { apiClient } from './api/client';
import type { Eligibility, Sex } from '../types/eligibility';

export const eligibilityApi = {
  mine: () => apiClient.get<Eligibility>('/eligibility/me'),
  saveDetails: (input: { sex?: Sex | null; weightKg?: number | null }) => apiClient.put<Eligibility>('/eligibility/me', input),
  addDeferral: (reason: string, date?: string) => apiClient.post<Eligibility>('/eligibility/me/deferral', { reason, date }),
  clearDeferral: () => apiClient.delete<Eligibility>('/eligibility/me/deferral'),
  goOnCall: (hours: number) => apiClient.post<Eligibility>('/eligibility/me/on-call', { hours }),
  stopOnCall: () => apiClient.delete<Eligibility>('/eligibility/me/on-call'),
  /** days: null = until I turn it back on */
  pause: (days: number | null, reason?: string) => apiClient.post<Eligibility>('/eligibility/me/pause', { days, reason }),
  resume: () => apiClient.delete<Eligibility>('/eligibility/me/pause'),
  addDonation: (date: string, place?: string) => apiClient.post<Eligibility>('/eligibility/me/donations', { date, place }),
  confirmDonation: (id: string, donated: boolean) => apiClient.post<Eligibility>(`/eligibility/me/donations/${id}/confirm`, { donated }),
};
