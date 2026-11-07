import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/types.js';
import { validateLocation, requirePhone } from '../../shared/location.js';

export class UsersService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        donorProfile: true,
        consentRecords: true,
      },
    });

    if (!user) {
      throw new AppError('User profile not found', 404, 'NOT_FOUND');
    }

    return {
      id: user.id,
      name: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      verified: user.isEmailVerified,
      createdAt: user.createdAt.toISOString(),
      country: user.donorProfile?.country || user.country,
      // null = no donor profile yet (never invent a blood group)
      bloodGroup: user.donorProfile?.bloodGroup ?? null,
      hasDonorProfile: Boolean(user.donorProfile),
      city: user.donorProfile?.city || '',
      state: user.donorProfile?.state || '',
      district: user.donorProfile?.district || '',
      postalCode: user.donorProfile?.postalCode || '',
      donationWillingness: user.donorProfile?.donationWillingness || 'regular',
      isAvailable: user.donorProfile?.isAvailable ?? true,
      totalDonations: user.donorProfile?.totalDonations || 0,
      lastDonationDate: user.donorProfile?.lastDonationDate?.toISOString() || null,
    };
  }

  async updateProfile(userId: string, input: any) {
    const current = await prisma.user.findUnique({ where: { id: userId }, include: { donorProfile: true } });
    if (!current) {
      throw new AppError('User profile not found', 404, 'NOT_FOUND');
    }

    const country = input.country || input.location?.country;
    const city = input.city ?? input.location?.city;
    const state = input.state || input.location?.state;
    const district = input.district || input.location?.district;
    const postalCode = input.postalCode ?? input.location?.postalCode;
    const locationTouched = [country, city, state, district, postalCode].some((v) => v !== undefined && v !== null);

    // Location is checked against the chosen country's states and districts
    const location = locationTouched
      ? validateLocation({
          country: country || current.donorProfile?.country || current.country,
          state: state || current.donorProfile?.state,
          district: district || current.donorProfile?.district,
          city: city ?? current.donorProfile?.city,
          postalCode: postalCode ?? current.donorProfile?.postalCode,
        })
      : null;
    const phone = input.phone ? requirePhone(location?.country || current.country, input.phone) : undefined;

    await prisma.$transaction(async (tx) => {
      if (input.fullName || input.name || location || phone) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...((input.fullName || input.name) && { fullName: input.fullName || input.name }),
            ...(location && { country: location.country }),
            ...(phone && { phone }),
          },
        });
      }

      const willingness = input.willingness || input.donationWillingness;
      const isAvailable = input.emergencyAvailability !== undefined ? input.emergencyAvailability : input.isAvailable;

      if (location || input.bloodGroup || willingness || isAvailable !== undefined) {
        await tx.donorProfile.upsert({
          where: { userId },
          create: {
            userId,
            bloodGroup: input.bloodGroup || 'O+',
            country: location?.country || current.country,
            city: location?.city || '',
            state: location?.state || '',
            district: location?.district || '',
            postalCode: location?.postalCode || null,
            donationWillingness: willingness || 'regular',
            isAvailable: isAvailable !== undefined ? isAvailable : true,
          },
          update: {
            ...(location && {
              country: location.country,
              state: location.state,
              district: location.district,
              city: location.city,
              postalCode: location.postalCode,
            }),
            ...(input.bloodGroup && { bloodGroup: input.bloodGroup }),
            ...(willingness && { donationWillingness: willingness }),
            ...(isAvailable !== undefined && { isAvailable }),
          },
        });
      }

      if (input.contactSharingConsent !== undefined) {
        await tx.consentRecord.create({
          data: {
            userId,
            purpose: 'contact_sharing',
            policyVersion: 'v2.4-2026',
            isGranted: input.contactSharingConsent,
            revokedAt: input.contactSharingConsent ? null : new Date(),
          },
        });
      }
    });

    return this.getProfile(userId);
  }

  async exportData(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        donorProfile: true,
        consentRecords: true,
        createdReferrals: true,
        notifications: true,
      },
    });

    return {
      downloadUrl: '#',
      generatedAt: new Date().toISOString(),
      data: user,
    };
  }

  async requestAccountDeletion(userId: string, reason: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'suspended' },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'ACCOUNT_DELETION_REQUESTED',
        entityType: 'User',
        entityId: userId,
        details: JSON.stringify({ reason }),
      },
    });

    return {
      success: true,
      message: 'Account deletion request processed. Your account is now deactivated.',
    };
  }
}

export const usersService = new UsersService();
