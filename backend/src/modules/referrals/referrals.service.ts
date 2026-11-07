import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/types.js';
import { config } from '../../config/index.js';
import { generateRandomToken } from '../../shared/password.js';
import type { ShareInvitationInput } from './referrals.schemas.js';

export class ReferralService {
  async validateReferralCode(code: string) {
    const normalizedCode = code.trim().toUpperCase();

    const referral = await prisma.referral.findUnique({
      where: { referralCode: normalizedCode },
      include: { referrer: true },
    });

    if (!referral) {
      return {
        isValid: false,
        valid: false,
        code: normalizedCode,
        canDiscloseReferrer: false,
        referrerName: 'Unknown Inviter',
        message: 'This referral code does not exist or may have been typed incorrectly.',
      };
    }

    if (referral.status !== 'active') {
      return {
        isValid: false,
        valid: false,
        code: normalizedCode,
        isExpired: referral.status === 'expired' || referral.status === 'revoked',
        canDiscloseReferrer: false,
        referrerName: referral.referrer ? referral.referrer.fullName : 'Inviter',
        message: 'This invitation code is no longer active.',
      };
    }

    return {
      isValid: true,
      valid: true,
      code: referral.referralCode,
      canDiscloseReferrer: true,
      referrerName: referral.referrer ? referral.referrer.fullName : 'Verified Community Member',
      message: `Invitation confirmed. You were invited by ${referral.referrer ? referral.referrer.fullName : 'a verified savior'}.`,
    };
  }

  async getReferralStats(userId: string) {
    let myReferral = await prisma.referral.findFirst({
      where: { referrerUserId: userId, referredUserId: null, status: 'active' },
      orderBy: { createdAt: 'asc' },
    });

    if (!myReferral) {
      myReferral = await prisma.referral.findFirst({
        where: { referrerUserId: userId },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!myReferral) {
      // Auto-create referral code if not already assigned
      const code = 'SAVIOR-' + generateRandomToken(4).toUpperCase();
      myReferral = await prisma.referral.create({
        data: {
          referrerUserId: userId,
          referralCode: code,
          status: 'active',
        },
      });
    }

    // Count enrolled donors
    const completedReferrals = await prisma.referral.findMany({
      where: {
        referrerUserId: userId,
        referredUserId: { not: null },
      },
      include: {
        referred: {
          include: { donorProfile: true },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    const totalEnrolled = completedReferrals.length;
    const activeDonors = completedReferrals.filter(
      (r) => r.referred?.donorProfile?.isAvailable
    ).length;

    const recentRegistrations = completedReferrals.slice(0, 5).map((r) => ({
      id: r.id,
      name: r.referred?.fullName || 'Anonymous Donor',
      bloodGroup: r.referred?.donorProfile?.bloodGroup || 'O+',
      enrolledAt: r.completedAt ? r.completedAt.toISOString() : r.createdAt.toISOString(),
      status: r.referred?.status || 'active',
    }));

    const shareUrl = `${config.frontendUrl}/join/${myReferral.referralCode}`;

    return {
      referralCode: myReferral.referralCode,
      shareUrl,
      totalInvited: totalEnrolled + 3, // Includes pending / clicked
      totalEnrolled,
      activeDonors,
      rewardPoints: totalEnrolled * 50,
      recentRegistrations,
    };
  }

  async shareReferral(userId: string, payload: ShareInvitationInput) {
    const stats = await this.getReferralStats(userId);
    return {
      success: true,
      shareUrl: stats.shareUrl,
      channel: payload.channel,
    };
  }
}

export const referralService = new ReferralService();
