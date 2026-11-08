import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/types.js';
import { validateLocation, requirePhone } from '../../shared/location.js';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { subscriptionService } from '../subscriptions/subscriptions.service.js';

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

  /**
   * "Download my data": everything this person gave us or created, as one JSON file.
   * Never includes password hashes, tokens, or other people's private details.
   */
  async exportData(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        donorProfile: true,
        consentRecords: { orderBy: { grantedAt: 'asc' } },
        createdReferrals: { select: { referralCode: true, status: true, createdAt: true, completedAt: true, referredUserId: true } },
        receivedReferral: { select: { referralCode: true, completedAt: true } },
        familyMembers: true,
        pledgesGiven: { select: { bloodGroup: true, status: true, createdAt: true, shareContact: true, allowRequestAlerts: true, shareAvailability: true } },
        pledgesReceived: { select: { bloodGroup: true, status: true, createdAt: true } },
        subscriptions: { select: { plan: true, amountPaise: true, currency: true, status: true, startsAt: true, endsAt: true, autoRenew: true, createdAt: true } },
        bloodRequests: {
          select: {
            publicCode: true, patientName: true, bloodGroup: true, unitsNeeded: true, hospitalName: true, hospitalArea: true,
            state: true, district: true, city: true, urgency: true, status: true, createdAt: true, closedAt: true,
          },
        },
        requestResponses: { select: { status: true, createdAt: true, request: { select: { publicCode: true, bloodGroup: true, hospitalName: true } } } },
        notifications: { select: { title: true, message: true, createdAt: true, isRead: true }, orderBy: { createdAt: 'desc' }, take: 500 },
      },
    });
    if (!user) throw new AppError('Account not found.', 404, 'NOT_FOUND');

    await prisma.auditLog.create({
      data: { actorId: userId, action: 'DATA_EXPORTED', entityType: 'User', entityId: userId },
    });

    return {
      downloadUrl: '',
      generatedAt: new Date().toISOString(),
      data: {
        about: 'Your BloodBridge data. Keep this file private.',
        account: {
          name: user.fullName,
          username: user.username,
          email: user.email,
          phone: user.phone,
          dateOfBirth: user.dateOfBirth,
          country: user.country,
          role: user.role,
          status: user.status,
          emailVerified: user.isEmailVerified,
          createdAt: user.createdAt,
        },
        donorProfile: user.donorProfile
          ? (({ id: _id, userId: _u, ...rest }) => rest)(user.donorProfile)
          : null,
        consents: user.consentRecords.map((c) => ({ purpose: c.purpose, granted: c.isGranted, policyVersion: c.policyVersion, at: c.grantedAt, revokedAt: c.revokedAt })),
        referrals: {
          myCodes: user.createdReferrals.filter((r) => !r.referredUserId).map((r) => ({ code: r.referralCode, status: r.status, createdAt: r.createdAt })),
          peopleWhoJoinedWithMyLink: user.createdReferrals.filter((r) => r.referredUserId).length,
          iJoinedWithCode: user.receivedReferral?.referralCode ?? null,
        },
        family: {
          members: user.familyMembers.map(({ id: _id, ownerUserId: _o, ...m }) => m),
          pledgesIGave: user.pledgesGiven,
          pledgesToMyFamily: user.pledgesReceived,
        },
        subscriptions: user.subscriptions.map((s) => ({ ...s, amountInr: s.amountPaise / 100 })),
        bloodRequestsIPosted: user.bloodRequests,
        requestsIRespondedTo: user.requestResponses,
        notifications: user.notifications,
      },
    };
  }

  /**
   * "Delete my account": removes the account and everything linked to it, so the email and mobile number can be used again.
   * Before deleting: open requests are cancelled (donors who accepted are told not to go), automatic renewal is stopped,
   * and uploaded patient documents are removed. Only a minimal audit note without personal details is kept.
   */
  async requestAccountDeletion(userId: string, reason: string, confirm?: string) {
    if (confirm !== 'DELETE') {
      throw new AppError('Type DELETE to confirm that you want to delete your account.', 400, 'CONFIRMATION_REQUIRED');
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { subscriptions: { select: { providerPaymentId: true, status: true } } } });
    if (!user) throw new AppError('Account not found.', 404, 'NOT_FOUND');
    if (user.role === 'admin') {
      throw new AppError('Admin accounts cannot be deleted from here.', 400, 'NOT_ALLOWED');
    }

    // 1. Open requests: cancel and tell donors who accepted not to go (the request itself is deleted with the account)
    const live = await prisma.bloodRequest.findMany({
      where: { requesterUserId: userId, status: { notIn: ['fulfilled', 'cancelled', 'expired', 'closed'] } },
      include: { responses: { where: { status: 'accepted' }, select: { donorUserId: true } } },
    });
    for (const r of live) {
      for (const x of r.responses) {
        await prisma.notification.create({
          data: {
            recipientId: x.donorUserId,
            notificationType: 'request_update',
            title: 'Request cancelled: please don’t go',
            message: `The ${r.bloodGroup} request at ${r.hospitalName} was cancelled by the family. Thank you for offering to help.`,
          },
        });
      }
    }

    // 2. Stop automatic renewal (Razorpay) if any
    await subscriptionService.setAutoRenew(userId, false).catch(() => undefined);

    // 3. Uploaded patient documents on disk
    const myRequests = await prisma.bloodRequest.findMany({ where: { requesterUserId: userId }, select: { id: true } });
    for (const r of myRequests) {
      await rm(resolve(process.cwd(), 'uploads', 'requests', r.id), { recursive: true, force: true }).catch(() => undefined);
    }

    // 4. Delete the account (profile, family, pledges, referrals, requests, notifications, tokens are removed with it)
    await prisma.$transaction([
      prisma.emailOtpChallenge.deleteMany({ where: { OR: [{ userId }, { email: user.email }] } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    // 5. Minimal record without personal details (payment ids only, for tax/refund records)
    await prisma.auditLog.create({
      data: {
        actorId: null,
        action: 'ACCOUNT_DELETED',
        entityType: 'User',
        entityId: userId,
        details: JSON.stringify({
          reason: reason.slice(0, 300),
          cancelledRequests: live.length,
          paymentIds: user.subscriptions.map((s) => s.providerPaymentId).filter(Boolean),
        }),
      },
    });

    return {
      success: true,
      deleted: true,
      message: 'Your account and data have been deleted. Your email and mobile number can be used again.',
    };
  }
}

export const usersService = new UsersService();
