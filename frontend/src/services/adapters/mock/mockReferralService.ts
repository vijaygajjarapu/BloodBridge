import type { ReferralService } from '../contracts';
import type {
  ReferralCodeValidation,
  ReferralStats,
  ShareInvitationPayload,
} from '../../../types/referral';
import { mockStore, delay } from './mockStore';

export class MockReferralService implements ReferralService {
  async validateReferralCode(code: string): Promise<ReferralCodeValidation> {
    await delay(250);
    const normalized = code.trim().toUpperCase();

    if (normalized === 'EXPIRED') {
      return {
        isValid: false,
        isExpired: true,
        code: normalized,
        canDiscloseReferrer: false,
        message: 'This referral invitation has expired. Please request a new invitation from your community coordinator.',
      };
    }

    if (normalized === 'INVALID' || normalized.length < 4) {
      return {
        isValid: false,
        code: normalized,
        canDiscloseReferrer: false,
        message: 'The referral code is unrecognized or has been revoked.',
      };
    }

    // Check against known codes
    const knownRef = mockStore.adminReferrals.find((r) => r.code.toUpperCase() === normalized);
    if (knownRef) {
      if (!knownRef.isActive) {
        return {
          isValid: false,
          code: normalized,
          canDiscloseReferrer: false,
          message: 'This referral invitation has been temporarily paused by administration.',
        };
      }
      return {
        isValid: true,
        code: normalized,
        referrerName: knownRef.ownerName,
        canDiscloseReferrer: true,
        message: `You were invited to save lives by ${knownRef.ownerName}.`,
      };
    }

    // Default for demo: any reasonable code format starting with SAVIOR- or valid string
    return {
      isValid: true,
      code: normalized,
      referrerName: 'Marcus Vance',
      canDiscloseReferrer: true,
      message: 'Verified BloodBridge community invitation.',
    };
  }

  async getReferralStats(): Promise<ReferralStats> {
    await delay(200);
    const code = mockStore.currentUser?.referralCode || 'SAVIOR-MV2026';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    const referralUrl = `${origin}/join/${code}`;

    const referredDonors = mockStore.donors.filter(
      (d) => d.referredByCode?.toUpperCase() === code.toUpperCase()
    );

    const activeCount = referredDonors.filter((d) => d.status === 'active').length;
    const pendingCount = referredDonors.filter((d) => d.status === 'pending').length;

    const recentActivity = referredDonors.slice(0, 5).map((d) => ({
      id: d.id,
      donorName: d.name,
      bloodGroup: d.bloodGroup,
      registeredAt: d.registeredAt,
      status: (d.status === 'active' ? 'verified' : 'pending') as 'registered' | 'verified' | 'pending',
    }));

    return {
      code,
      referralUrl,
      totalInvitesSent: 14,
      successfulRegistrations: referredDonors.length,
      pendingRegistrations: pendingCount,
      activeDonorsCount: activeCount,
      recentActivity,
    };
  }

  async shareReferral(payload: ShareInvitationPayload): Promise<{ success: boolean; shareUrl: string }> {
    await delay(200);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    const shareUrl = `${origin}/join/${payload.referralCode}`;

    return {
      success: true,
      shareUrl,
    };
  }
}

export const mockReferralService = new MockReferralService();
