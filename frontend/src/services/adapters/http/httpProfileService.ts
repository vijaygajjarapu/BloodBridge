import type { ProfileService } from '../contracts';
import type { User } from '../../../types/auth';
import type { UpdateDonorProfileInput } from '../../../types/donor';
import { apiClient } from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';

export class HttpProfileService implements ProfileService {
  async getProfile(): Promise<User> {
    return apiClient.get<User>(ENDPOINTS.PROFILE);
  }

  async updateProfile(input: UpdateDonorProfileInput): Promise<User> {
    return apiClient.put<User>(ENDPOINTS.PROFILE, input);
  }

  async requestDataExport(): Promise<{ downloadUrl: string; generatedAt: string; data?: unknown }> {
    return apiClient.post<{ downloadUrl: string; generatedAt: string; data?: unknown }>(ENDPOINTS.DATA_EXPORT);
  }

  async requestAccountDeletion(reason: string, confirm?: string): Promise<{ success: boolean; message: string; deleted?: boolean }> {
    return apiClient.post<{ success: boolean; message: string; deleted?: boolean }>(ENDPOINTS.DELETE_ACCOUNT, { reason, confirm });
  }
}

export const httpProfileService = new HttpProfileService();
