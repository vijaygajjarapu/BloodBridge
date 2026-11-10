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
};
