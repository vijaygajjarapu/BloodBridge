import type { ProfileService } from '../contracts';
import type { User } from '../../../types/auth';
import type { UpdateDonorProfileInput } from '../../../types/donor';
import { mockStore, delay } from './mockStore';

export class MockProfileService implements ProfileService {
  async getProfile(): Promise<User> {
    await delay(150);
    if (!mockStore.currentUser) {
      throw {
        code: 'UNAUTHORIZED',
        message: 'No active session found.',
      };
    }
    return { ...mockStore.currentUser };
  }

  async updateProfile(input: UpdateDonorProfileInput): Promise<User> {
    await delay(300);
    if (!mockStore.currentUser) {
      throw {
        code: 'UNAUTHORIZED',
        message: 'No active session found.',
      };
    }

    mockStore.currentUser = {
      ...mockStore.currentUser,
      name: input.name,
      email: input.email || mockStore.currentUser.email,
      phone: input.phone || mockStore.currentUser.phone,
      bloodGroup: input.bloodGroup,
      country: input.location.country || mockStore.currentUser.country,
      state: input.location.state,
      district: input.location.district,
      city: input.location.city,
      postalCode: input.location.postalCode,
      donationWillingness: input.willingness,
      isAvailable: input.emergencyAvailability,
    };

    // Also update any matching donor entry
    const donorMatch = mockStore.donors.find((d) => d.id === 'dnr_101' || d.name === input.name);
    if (donorMatch) {
      donorMatch.bloodGroup = input.bloodGroup;
      donorMatch.location = input.location;
      donorMatch.willingness = input.willingness;
      donorMatch.emergencyAvailability = input.emergencyAvailability;
      donorMatch.canAccessContact = input.contactSharingConsent;
    }

    return { ...mockStore.currentUser };
  }

  async requestDataExport(): Promise<{ downloadUrl: string; generatedAt: string }> {
    await delay(400);
    return {
      downloadUrl: '#demo-export-ready',
      generatedAt: new Date().toISOString(),
    };
  }

  async requestAccountDeletion(reason: string): Promise<{ success: boolean; message: string }> {
    await delay(300);
    mockStore.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      actorId: mockStore.currentUser?.id || 'demo_user',
      actorName: mockStore.currentUser?.name || 'Marcus Vance',
      actorRole: 'Donor',
      action: 'ACCOUNT_DELETION_REQUESTED',
      entityType: 'user',
      entityId: mockStore.currentUser?.id || 'demo_user',
      details: `Deletion reason: ${reason}`,
      timestamp: new Date().toISOString(),
      ipAddress: '127.0.0.1 (demo)',
    });

    return {
      success: true,
      message: '[Demo Mode] Account deletion request acknowledged. In production, a verification link is dispatched to your verified email/phone.',
    };
  }
}

export const mockProfileService = new MockProfileService();
