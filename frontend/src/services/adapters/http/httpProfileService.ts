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

  async requestDataExport(): Promise<{ downloadUrl: string; generatedAt: string }> {
    return apiClient.post<{ downloadUrl: string; generatedAt: string }>(ENDPOINTS.DATA_EXPORT);
  }

  async requestAccountDeletion(reason: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>(ENDPOINTS.DELETE_ACCOUNT, { reason });
  }
}

export const httpProfileService = new HttpProfileService();
