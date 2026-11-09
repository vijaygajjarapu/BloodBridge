/** Communities (needs the live backend, VITE_APP_MODE=api) */
import { apiClient } from './api/client';
import type { CommunitySearchResult, CreateCommunityInput, MyCommunity, NearbyCommunity, Community } from '../types/community';

const qs = (o: Record<string, string | undefined>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => {
    if (v) p.set(k, v);
  });
  return p.toString();
};

export const communityApi = {
  mine: () => apiClient.get<MyCommunity[]>('/communities/mine'),
  search: (q: { q?: string; country?: string; state?: string; district?: string; pinCode?: string }) =>
    apiClient.get<CommunitySearchResult[]>(`/communities/search?${qs(q)}`),
  /** Communities near a hospital with how many members could donate now (counts only) */
  near: (q: { country?: string; state: string; district: string; pinCode?: string; bloodGroup?: string }) =>
    apiClient.get<NearbyCommunity[]>(`/communities/near?${qs(q)}`),
  create: (input: CreateCommunityInput) => apiClient.post<Community>('/communities', input),
  join: (id: string) => apiClient.post<MyCommunity[]>(`/communities/${id}/join`),
  leave: (id: string) => apiClient.delete<MyCommunity[]>(`/communities/${id}/membership`),
  updatePrefs: (id: string, prefs: Partial<Pick<MyCommunity['membership'], 'alertNearby' | 'alertFromMembers' | 'muted' | 'isAlumni'>>) =>
    apiClient.patch<MyCommunity[]>(`/communities/${id}/membership`, prefs),
  confirm: (id: string, stillHere: boolean) => apiClient.post<MyCommunity[]>(`/communities/${id}/confirm`, { stillHere }),
};
